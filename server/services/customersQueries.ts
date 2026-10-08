/**
 * Requêtes de lecture pour les clients.
 */

import { query, queryOne } from "../db";
import type { Customer } from "../types/bakery";

export const getCustomer = async (id: string): Promise<Customer | null> => {
  return queryOne<Customer>(
    `SELECT id, name, phone, email, type, address,
            loyalty_points AS "loyaltyPoints",
            credit_balance AS "creditBalance",
            credit_limit AS "creditLimit", notes
       FROM customers WHERE id = $1`,
    [id],
  );
};

export const getCustomersByStore = async (
  storeId: string,
  limit = 100,
): Promise<Customer[]> => {
  return query<Customer>(
    `SELECT id, name, phone, email, type, address,
            loyalty_points AS "loyaltyPoints",
            credit_balance AS "creditBalance",
            credit_limit AS "creditLimit", notes
       FROM customers WHERE store_id = $1 ORDER BY name LIMIT $2`,
    [storeId, limit],
  );
};
