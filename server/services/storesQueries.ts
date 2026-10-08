/**
 * Requêtes de lecture pour les boutiques.
 */

import { query, queryOne } from "../db";
import type { Store } from "../types/bakery";

export const getStore = async (id: string): Promise<Store | null> => {
  return queryOne<Store>(
    `SELECT id, name, location, phone, manager_name AS "managerName", is_main AS "isMain"
       FROM stores WHERE id = $1`,
    [id],
  );
};

export const getStores = async (): Promise<Store[]> => {
  return query<Store>(
    `SELECT id, name, location, phone, manager_name AS "managerName", is_main AS "isMain"
       FROM stores ORDER BY is_main DESC, name`,
  );
};
