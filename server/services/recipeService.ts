/**
 * Service métier des recettes — crée/édite une fiche de recette avec ses
 * ingrédients, dans une transaction atomique.
 */

import { query, queryOne, transaction } from "../db";
import { v4 as uuid } from "uuid";
import type { Recipe, RecipeInput } from "../types/bakery";

export const createRecipe = async (input: RecipeInput): Promise<Recipe> => {
  const id = input.id ?? uuid();

  return transaction(async (tx) => {
    const recipe = await tx.queryOne<Recipe>(
      `INSERT INTO recipes
         (id, name, product_id, product_name, output_yield, output_unit,
          preparation_time_min, proofing_time_min, baking_time_min, baking_temp_c,
          instructions, total_cost, cost_per_unit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, name, product_id AS "productId", product_name AS "productName",
                 output_yield AS "outputYield", output_unit AS "outputUnit",
                 preparation_time_min AS "preparationTimeMin",
                 proofing_time_min AS "proofingTimeMin",
                 baking_time_min AS "bakingTimeMin", baking_temp_c AS "bakingTempC",
                 instructions, total_cost AS "totalCost", cost_per_unit AS "costPerUnit"`,
      [
        id,
        input.name,
        input.productId ?? null,
        input.productName ?? null,
        input.outputYield ?? 0,
        input.outputUnit ?? null,
        input.preparationTimeMin ?? 0,
        input.proofingTimeMin ?? 0,
        input.bakingTimeMin ?? 0,
        input.bakingTempC ?? 0,
        input.instructions ?? [],
        input.totalCost ?? 0,
        input.costPerUnit ?? 0,
      ],
    );

    if (!recipe) throw new Error("Impossible d'insérer la recette.");

    for (const ing of input.ingredients ?? []) {
      await tx.query(
        `INSERT INTO recipe_ingredients
           (id, recipe_id, material_id, material_name, quantity, unit, cost)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          ing.id ?? uuid(),
          id,
          ing.materialId ?? null,
          ing.materialName,
          ing.quantity ?? 0,
          ing.unit ?? null,
          ing.cost ?? 0,
        ],
      );
    }

    return recipe;
  });
};

export const updateRecipe = async (
  id: string,
  input: Partial<RecipeInput>,
): Promise<Recipe | null> => {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (input.name !== undefined) {
    sets.push(`name = $${i++}`);
    params.push(input.name);
  }
  if (input.productId !== undefined) {
    sets.push(`product_id = $${i++}`);
    params.push(input.productId ?? null);
  }
  if (input.productName !== undefined) {
    sets.push(`product_name = $${i++}`);
    params.push(input.productName ?? null);
  }
  if (input.outputYield !== undefined) {
    sets.push(`output_yield = $${i++}`);
    params.push(input.outputYield);
  }
  if (input.outputUnit !== undefined) {
    sets.push(`output_unit = $${i++}`);
    params.push(input.outputUnit ?? null);
  }
  if (input.preparationTimeMin !== undefined) {
    sets.push(`preparation_time_min = $${i++}`);
    params.push(input.preparationTimeMin);
  }
  if (input.proofingTimeMin !== undefined) {
    sets.push(`proofing_time_min = $${i++}`);
    params.push(input.proofingTimeMin);
  }
  if (input.bakingTimeMin !== undefined) {
    sets.push(`baking_time_min = $${i++}`);
    params.push(input.bakingTimeMin);
  }
  if (input.bakingTempC !== undefined) {
    sets.push(`baking_temp_c = $${i++}`);
    params.push(input.bakingTempC);
  }
  if (input.instructions !== undefined) {
    sets.push(`instructions = $${i++}`);
    params.push(input.instructions ?? []);
  }
  if (input.totalCost !== undefined) {
    sets.push(`total_cost = $${i++}`);
    params.push(input.totalCost);
  }
  if (input.costPerUnit !== undefined) {
    sets.push(`cost_per_unit = $${i++}`);
    params.push(input.costPerUnit);
  }

  if (sets.length === 0) {
    return getRecipe(id as string);
  }

  params.push(id);

  const rows = await query<Recipe>(
    `UPDATE recipes
       SET ${sets.join(", ")}
     WHERE id = $${i}
     RETURNING id, name, product_id AS "productId", product_name AS "productName",
               output_yield AS "outputYield", output_unit AS "outputUnit",
               preparation_time_min AS "preparationTimeMin",
               proofing_time_min AS "proofingTimeMin",
               baking_time_min AS "bakingTimeMin", baking_temp_c AS "bakingTempC",
               instructions, total_cost AS "totalCost", cost_per_unit AS "costPerUnit"`,
    params,
  );

  return rows[0] ?? null;
};

export const getRecipe = async (id: string): Promise<Recipe | null> => {
  return queryOne<Recipe>(
    `SELECT id, name, product_id AS "productId", product_name AS "productName",
            output_yield AS "outputYield", output_unit AS "outputUnit",
            preparation_time_min AS "preparationTimeMin",
            proofing_time_min AS "proofingTimeMin",
            baking_time_min AS "bakingTimeMin", baking_temp_c AS "bakingTempC",
            instructions, total_cost AS "totalCost", cost_per_unit AS "costPerUnit"
       FROM recipes WHERE id = $1`,
    [id],
  );
};

export const deleteRecipe = async (id: string): Promise<boolean> => {
  await query(`DELETE FROM recipes WHERE id = $1`, [id]);
  return true;
};
