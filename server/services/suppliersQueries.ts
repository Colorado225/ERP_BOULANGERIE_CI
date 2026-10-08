/**
 * Requêtes de lecture pour les fournisseurs.
 */

import { query, queryOne } from "../db";
import type { Supplier } from "../types/bakery";

export const getSupplier = async (id: string): Promise<Supplier | null> => {
  return queryOne<Supplier>(
    `SELECT id, name, contact_name AS "contactName", phone, email, address,
            supplied_materials AS "suppliedMaterials",
            payment_terms AS "paymentTerms",
            pending_balance AS "pendingBalance"
       FROM suppliers WHERE id = $1`,
    [id],
  );
};

export const getSuppliers = async (
  storeId: string,
  limit = 100,
): Promise<Supplier[]> => {
  return query<Supplier>(
    `SELECT id, name, contact_name AS "contactName", phone, email, address,
            supplied_materials AS "suppliedMaterials",
            payment_terms AS "paymentTerms",
            pending_balance AS "pendingBalance"
       FROM suppliers WHERE store_id = $1 ORDER BY name LIMIT $2`,
    [storeId, limit],
  );
};
