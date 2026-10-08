/**
 * Requêtes de lecture pour les bons de commande.
 */

import { query, queryOne } from "../db";
import type { PurchaseOrder } from "../types/bakery";

export const getPurchaseOrder = async (id: string): Promise<PurchaseOrder | null> => {
  return queryOne<PurchaseOrder>(
    `SELECT id, order_number AS "orderNumber", supplier_id AS "supplierId",
            supplier_name AS "supplierName", date, status, total_amount AS "totalAmount", notes
       FROM purchase_orders WHERE id = $1`,
    [id],
  );
};

export const getPurchaseOrdersByStore = async (
  storeId: string,
  limit = 50,
): Promise<PurchaseOrder[]> => {
  return query<PurchaseOrder>(
    `SELECT id, order_number AS "orderNumber", supplier_id AS "supplierId",
            supplier_name AS "supplierName", date, status, total_amount AS "totalAmount", notes
       FROM purchase_orders ORDER BY date DESC LIMIT $1`,
    [limit],
  );
};
