/**
 * Service de reporting : statistiques utiles pour le tableau de bord.
 *
 * Toutes les requêtes sont en lecture seule (SELECT) et utilisent le
 * Pool de `db.ts`.
 */

import { query, queryOne } from "../db";
import type { Sale, ProductionOrder, PurchaseOrder } from "../types/bakery";

export interface DashboardStats {
  todaySales: number;
  salesCount: number;
  todayProduction: number;
  productionCount: number;
  todayPurchases: number;
  purchaseCount: number;
  lowStockProducts: number;
  lowStockMaterials: number;
  totalRevenue: number;
  totalProfit: number;
  totalCosts: number;
}

/** ------------------------------------------------------------------ */
/**  Statistiques journalières (aujourd'hui)                           */
/** ------------------------------------------------------------------ */

export const getTodayStats = async (storeId: string): Promise<DashboardStats> => {
  const [salesRes, productionRes, purchasesRes, productsRes, materialsRes] =
    await Promise.all([
      query<Sale>(
        `SELECT COALESCE(SUM(total),0)::numeric AS total, COUNT(*) AS count
           FROM sales WHERE store_id = $1 AND date >= CURRENT_DATE`,
        [storeId],
      ),
      query(
        `SELECT COUNT(*) AS count FROM production_orders
           WHERE store_id = $1 AND status = 'en_cours'`,
        [storeId],
      ),
      query<PurchaseOrder>(
        `SELECT COUNT(*) AS count FROM purchase_orders
           WHERE store_id = $1 AND date >= CURRENT_DATE`,
        [storeId],
      ),
      query(
        `SELECT COUNT(*) AS count FROM products
           WHERE store_id = $1 AND stock <= min_stock`,
        [storeId],
      ),
      query(
        `SELECT COUNT(*) AS count FROM raw_materials
           WHERE store_id = $1 AND current_stock <= min_stock_alert`,
        [storeId],
      ),
    ]);

  const salesToday = salesRes[0] ?? { total: "0", count: 0 };
  const prodToday = productionRes[0] ?? { count: 0 };
  const purchasesToday = purchasesRes[0] ?? { count: 0 };
  const lowStockProducts = productsRes[0]?.count ?? 0;
  const lowStockMaterials = materialsRes[0]?.count ?? 0;

  const todaySales = Number(salesToday.total);
  const salesCount = Number(salesToday.count);
  const todayProduction = Number(prodToday.count);
  const todayPurchases = Number(purchasesToday.count);

  // Revenu total + coût estimé (coût des produits vendus + coût matières premières consommées)
  const [revenueRes, profitRes] = await Promise.all([
    query<{ total: string }>(
      `SELECT COALESCE(SUM(total),0)::numeric AS total FROM sales WHERE store_id = $1`,
      [storeId],
    ),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(p.stock * p.cost_price),0)::numeric AS total
         FROM products p
        WHERE p.store_id = $1`,
      [storeId],
    ),
  ]);

  const totalRevenue = Number(revenueRes[0]?.total ?? 0);
  const totalCosts = Number(profitRes[0]?.total ?? 0);
  const totalProfit = totalRevenue - totalCosts;

  return {
    todaySales,
    salesCount,
    todayProduction,
    productionCount: todayProduction,
    todayPurchases,
    purchaseCount: todayPurchases,
    lowStockProducts,
    lowStockMaterials,
    totalRevenue,
    totalProfit,
    totalCosts,
  };
};

/** ------------------------------------------------------------------ */
/**  Unités de vente plus récentes                                    */
/** ------------------------------------------------------------------ */

export const getRecentSales = async (
  storeId: string,
  limit = 10,
): Promise<Sale[]> => {
  return query<Sale>(
    `SELECT id, receipt_number AS "receiptNumber", date, total,
            payment_method AS "paymentMethod", customer_name AS "customerName",
            cashier_name AS "cashierName"
       FROM sales
      WHERE store_id = $1
      ORDER BY date DESC LIMIT $2`,
    [storeId, limit],
  );
};

/** ------------------------------------------------------------------ */
/**  Liste des produits en rupture                                      */
/** ------------------------------------------------------------------ */

export const getLowStockProducts = async (
  storeId: string,
  threshold = 5,
): Promise<
  { id: string; name: string; price: number; stock: number; min_stock: number }[]
> => {
  return query(
    `SELECT id, name, price, stock, min_stock
       FROM products
      WHERE store_id = $1 AND stock <= GREATEST(min_stock, $2)
      ORDER BY stock ASC
      LIMIT 50`,
    [storeId, threshold],
  );
};

/** ------------------------------------------------------------------ */
/**  Mouvements de stock récents par matière première                   */
/** ------------------------------------------------------------------ */

export const getRecentStockMovements = async (
  materialId: string,
  limit = 10,
): Promise<{ id: string; delta: number; resultingStock: number; source: string; date: string }[]> => {
  return query(
    `SELECT id, delta, resulting_stock AS "resultingStock", source, date
       FROM stock_movements
      WHERE material_id = $1
      ORDER BY date DESC LIMIT $2`,
    [materialId, limit],
  );
};
