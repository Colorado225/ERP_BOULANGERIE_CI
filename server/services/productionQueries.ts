/**
 * Requêtes de lecture pour les fournées.
 */

import { query, queryOne } from "../db";
import type { ProductionOrder } from "../types/bakery";

export const getProductionOrder = async (
  id: string,
): Promise<ProductionOrder | null> => {
  return queryOne<ProductionOrder>(
    `SELECT id, code, recipe_id AS "recipeId", recipe_name AS "recipeName",
            product_id AS "productId", product_name AS "productName",
            batch_multiplier AS "batchMultiplier", target_quantity AS "targetQuantity",
            actual_quantity AS "actualQuantity", status, scheduled_time AS "scheduledTime",
            completed_time AS "completedTime", baker_name AS "bakerName",
            shift AS "shift", store_id AS "storeId", notes
       FROM production_orders WHERE id = $1`,
    [id],
  );
};

export const getProductionOrdersByStore = async (
  storeId: string,
  limit = 50,
): Promise<ProductionOrder[]> => {
  return query<ProductionOrder>(
    `SELECT id, code, recipe_id AS "recipeId", recipe_name AS "recipeName",
            product_id AS "productId", product_name AS "productName",
            batch_multiplier AS "batchMultiplier", target_quantity AS "targetQuantity",
            actual_quantity AS "actualQuantity", status, scheduled_time AS "scheduledTime",
            completed_time AS "completedTime", baker_name AS "bakerName",
            shift AS "shift", store_id AS "storeId", notes
       FROM production_orders WHERE store_id = $1 ORDER BY scheduled_time DESC LIMIT $2`,
    [storeId, limit],
  );
};
