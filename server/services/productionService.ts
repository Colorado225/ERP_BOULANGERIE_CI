/**
 * Service métier des fournées — crée un ordre de production et
 * consomme les ingrédients dans une transaction atomique.
 */

import { query, queryOne, transaction } from "../db";
import { v4 as uuid } from "uuid";
import type { ProductionOrder, ProductionOrderInput } from "../types/bakery";

export const createProductionOrder = async (
  input: ProductionOrderInput,
): Promise<ProductionOrder> => {
  const id = uuid();
  const code = `OF-${Date.now().toString(36).toUpperCase()}`;
  const targetQty = Number(input.targetQuantity ?? 0);

  if (targetQty <= 0) throw new Error("Quantité cible invalide");

  return transaction(async (tx) => {
    const recipe = await tx.queryOne<{
      id: string;
      name: string;
      product_id: string | null;
      product_name: string | null;
    }>(
      `SELECT id, name, product_id, product_name FROM recipes WHERE id = $1`,
      [input.recipeId],
    );

    if (!recipe) throw new Error(`Recette introuvable : ${input.recipeId}`);

    const order = await tx.queryOne<ProductionOrder>(
      `INSERT INTO production_orders
         (id, code, recipe_id, recipe_name, product_id, product_name,
          batch_multiplier, target_quantity, actual_quantity, status,
          scheduled_time, completed_time, baker_name, shift, store_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'en_cours',$10,$11,$12,$13,$14,$15)
       RETURNING id, code, recipe_id AS "recipeId", recipe_name AS "recipeName",
                 product_id AS "productId", product_name AS "productName",
                 batch_multiplier AS "batchMultiplier", target_quantity AS "targetQuantity",
                 actual_quantity AS "actualQuantity", status, scheduled_time AS "scheduledTime",
                 completed_time AS "completedTime", baker_name AS "bakerName",
                 shift AS "shift", store_id AS "storeId", notes`,
      [
        id,
        code,
        input.recipeId,
        recipe.name,
        recipe.product_id ?? null,
        recipe.product_name ?? null,
        input.batchMultiplier ?? 1,
        targetQty,
        null,
        input.scheduledTime ?? null,
        input.completedTime ?? null,
        input.bakerName ?? null,
        input.shift ?? null,
        input.storeId,
        input.notes ?? null,
      ],
    );

    if (!order) throw new Error("Impossible d'insérer la fournée.");

    if (recipe.product_id) {
      const prod = await tx.queryOne<{ stock: number }>(
        `SELECT stock FROM products WHERE id = $1`,
        [recipe.product_id],
      );
      if (prod && prod.stock !== undefined) {
        const ingredientSql = `
          SELECT ri.quantity, ri.unit, ri.material_id, ri.material_name
            FROM recipe_ingredients ri
           WHERE ri.recipe_id = $1
        `;
        const ingredients = await tx.query<{
          quantity: number;
          unit: string | null;
          material_id: string;
          material_name: string;
        }>(ingredientSql, [recipe.id]);

        for (const ing of ingredients) {
          const qtyPerUnit = Number(ing.quantity);
          const totalConsumed = qtyPerUnit * targetQty;
          const matId = ing.material_id;
          if (!matId) continue;

          const mat = await tx.queryOne<{ current_stock: number; unit: string }>(
            `SELECT current_stock, unit FROM raw_materials WHERE id = $1`,
            [matId],
          );
          if (!mat) continue;
          const newStock = mat.current_stock - totalConsumed;
          if (newStock < 0) {
            throw new Error(
              `Stock insuffisant : ${ing.material_name} n'a que ${mat.current_stock}${mat.unit}`,
            );
          }
          await tx.query(
            `UPDATE raw_materials SET current_stock = $1 WHERE id = $2`,
            [newStock, matId],
          );
        }
      }
    }

    return order;
  });
};

export const updateProductionOrder = async (
  orderId: string,
  updates: Partial<{
    status: string;
    actualQuantity: number;
    completedTime: string;
    notes: string;
  }>,
): Promise<ProductionOrder | null> => {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (updates.status !== undefined) {
    sets.push(`status = $${i++}`);
    params.push(updates.status);
  }
  if (updates.actualQuantity !== undefined) {
    sets.push(`actual_quantity = $${i++}`);
    params.push(updates.actualQuantity);
  }
  if (updates.completedTime !== undefined) {
    sets.push(`completed_time = $${i++}`);
    params.push(updates.completedTime);
  }
  if (updates.notes !== undefined) {
    sets.push(`notes = $${i++}`);
    params.push(updates.notes);
  }

  if (sets.length === 0) {
    return getProductionOrder(orderId);
  }

  params.push(orderId);

  const rows = await query<ProductionOrder>(
    `UPDATE production_orders
       SET ${sets.join(", ")}
     WHERE id = $${i} RETURNING id, code, recipe_id AS "recipeId", recipe_name AS "recipeName",
                 product_id AS "productId", product_name AS "productName",
                 batch_multiplier AS "batchMultiplier", target_quantity AS "targetQuantity",
                 actual_quantity AS "actualQuantity", status, scheduled_time AS "scheduledTime",
                 completed_time AS "completedTime", baker_name AS "bakerName",
                 shift AS "shift", store_id AS "storeId", notes`,
    params,
  );

  return rows[0] ?? null;
};
