/**
 * Routes de reporting : statistiques du tableau de bord.
 *
 * Lecture seule : aucune transaction requise, mais toutes les requêtes
 * sont des SELECT sûrs.
 */

import { Router } from "express";
import { getTodayStats, getRecentSales, getLowStockProducts, getRecentStockMovements } from "../services/reportService";
import { getStores } from "../services/storesQueries";
import { getSuppliers } from "../services/suppliersQueries";
import { getCustomersByStore } from "../services/customersQueries";
import { getRecipesWithIngredients } from "../services/recipeQueries";
import { getProductionOrdersByStore } from "../services/productionQueries";
import { getPurchaseOrdersByStore } from "../services/purchaseQueries";
import { getSalesForStore } from "../services/salesQueries";

export const reportsRouter = Router();

/** StoreId de la requête, avec repli sûr pour les appels sans session. */
const storeOf = (req: unknown): string =>
  (req as { user?: { storeId?: string } }).user?.storeId ?? "store-1";

// ------------------------------------------------------------------
// Dashboard
// ------------------------------------------------------------------

reportsRouter.get("/dashboard/stats", async (_req, res) => {
  res.json(await getTodayStats(storeOf(_req)));
});

reportsRouter.get("/dashboard/recent-sales", async (_req, res) => {
  res.json(await getRecentSales(storeOf(_req)));
});

reportsRouter.get("/dashboard/low-stock-products", async (_req, res) => {
  res.json(await getLowStockProducts(storeOf(_req)));
});

// ------------------------------------------------------------------
// Inventaire & mouvements
// ------------------------------------------------------------------

reportsRouter.get("/inventory/materials/:id/movements", async (req, res) => {
  res.json(await getRecentStockMovements(req.params.id, 50));
});

reportsRouter.get("/inventory/movements/:id", async (req, res) => {
  res.json(await getRecentStockMovements(req.params.id, 50));
});

// ------------------------------------------------------------------
// Références externes
// ------------------------------------------------------------------

reportsRouter.get("/references/stores", async (_req, res) => {
  res.json(await getStores());
});

reportsRouter.get("/references/suppliers", async (_req, res) => {
  res.json(await getSuppliers(storeOf(_req)));
});

reportsRouter.get("/references/customers", async (_req, res) => {
  res.json(await getCustomersByStore(storeOf(_req)));
});

reportsRouter.get("/references/recipes", async (_req, res) => {
  res.json(await getRecipesWithIngredients());
});

reportsRouter.get("/references/production-orders", async (_req, res) => {
  res.json(await getProductionOrdersByStore(storeOf(_req), 500));
});

reportsRouter.get("/references/purchase-orders", async (_req, res) => {
  res.json(await getPurchaseOrdersByStore(storeOf(_req), 500));
});

// ------------------------------------------------------------------
// Ventes historiques (pour les graphiques)
// ------------------------------------------------------------------

reportsRouter.get("/sales/history", async (_req, res) => {
  const storeId = storeOf(_req);
  const sales = await getSalesForStore(storeId, 200);
  // Agrégation mensuelle simplifiée pour le graphique, à défaut
  const monthly = sales.reduce<Record<string, number>>((acc, s) => {
    const month = new Date(s.date).toISOString().slice(0, 7);
    acc[month] = (acc[month] ?? 0) + s.total;
    return acc;
  }, {});
  res.json({ data: monthly, sales });
});
