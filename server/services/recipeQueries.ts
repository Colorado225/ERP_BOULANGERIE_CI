/**
 * Requêtes de lecture pour les recettes (avec ingrédients).
 */

import { query } from "../db";
import type { Recipe } from "../types/bakery";

export const getRecipesWithIngredients = async (): Promise<Recipe[]> => {
  const recipes = await query<Recipe>(
    `SELECT id, name, product_id AS "productId", product_name AS "productName",
            output_yield AS "outputYield", output_unit AS "outputUnit",
            preparation_time_min AS "preparationTimeMin",
            proofing_time_min AS "proofingTimeMin",
            baking_time_min AS "bakingTimeMin", baking_temp_c AS "bakingTempC",
            instructions, total_cost AS "totalCost", cost_per_unit AS "costPerUnit"
       FROM recipes ORDER BY name`,
  );

  const ingredients = await query<{
    recipe_id: string;
    material_id: string | null;
    material_name: string;
    quantity: number;
    unit: string | null;
    cost: number;
  }>(
    `SELECT recipe_id, material_id, material_name, quantity, unit, cost
       FROM recipe_ingredients ORDER BY recipe_id`,
  );

  const byRecipe = new Map<string, typeof ingredients[0][]>();
  for (const ing of ingredients) {
    const key = ing.recipe_id;
    if (!byRecipe.has(key)) byRecipe.set(key, []);
    byRecipe.get(key)!.push(ing);
  }

  return recipes.map((r) => ({
    ...r,
    ingredients: byRecipe.get(r.id) ?? [],
  }));
};
