/**
 * Script de seeds : insère des données fictives dans la base Neon
 * Usage : npm run db:seed
 */
import { pool } from "./db";
import { randomUUID } from "node:crypto";

const runSeeds = async () => {
  console.log("[seeds] Démarrage de l'insertion des données fictives...");

  // 1. Insérer un magasin (Boulangerie Abidjan - Cocody)
  const storeId = randomUUID();
  await pool.query(
    `
    INSERT INTO stores (id, name, location, phone, manager_name, is_main)
    VALUES ($1, 'Boulangerie du Plateau', 'Rue du Commerce, Cocody, Abidjan', '+2250708091011', 'Kouassi Konan', true)
    ON CONFLICT (id) DO NOTHING;
  `,
    [storeId],
  );
  console.log(`[seeds] ✅ Magasin créé : ${storeId}`);

  // 2. Insérer un utilisateur caissier (correspond aux rôles du schema)
  const userId = randomUUID();
  await pool.query(
    `
    INSERT INTO users (id, name, email, password_hash, role, store_id, is_active)
    VALUES ($1, 'Kouassi Konan', 'caissier@boulangerie.ci', '$2a$10$dummyHash', 'caissier', $2, true)
    ON CONFLICT (email) DO NOTHING;
  `,
    [userId, storeId],
  );
  console.log(`[seeds] ✅ Utilisateur caissier créé : ${userId}`);

  // 3. Insérer les paramètres de l'entreprise (conformité DGI)
  await pool.query(`
    INSERT INTO company_settings (id, establishment_name, rccm, taxpayer_account, default_vat_rate, currency)
    VALUES ('default', 'Boulangerie du Plateau SARL', 'CI-ABJ-2024-12345', '0001234567', 18, 'XOF')
    ON CONFLICT (id) DO NOTHING;
  `);
  console.log("[seeds] ✅ Paramètres entreprise créés");

  // 4. Insérer des matières premières (ingrédients) - correspond au schema raw_materials
  const rawMaterials = [
    { name: "Farine de blé", unit: "kg", unitCost: 350 },
    { name: "Sucre cristallisé", unit: "kg", unitCost: 500 },
    { name: "Beurre", unit: "kg", unitCost: 1800 },
    { name: "Levure de boulanger", unit: "kg", unitCost: 2500 },
    { name: "Eau", unit: "L", unitCost: 100 },
    { name: "Sel fin", unit: "kg", unitCost: 300 },
    { name: "Oeufs", unit: "unite", unitCost: 50 },
    { name: "Lait en poudre", unit: "kg", unitCost: 2000 },
  ];

  const rawMaterialIds: Record<string, string> = {};
  for (const rm of rawMaterials) {
    const id = randomUUID();
    rawMaterialIds[rm.name] = id;
    await pool.query(
      `
      INSERT INTO raw_materials (id, code, name, category, unit, unit_cost, current_stock, min_stock_alert, location)
      VALUES ($1, $2, $3, 'ingredient', $4, $5, 100, 20, 'Cocody, Abidjan')
      ON CONFLICT (id) DO NOTHING;
    `,
      [
        id,
        `RM-${rm.name.replace(/\s/g, "-").toUpperCase()}`,
        rm.name,
        rm.unit,
        rm.unitCost,
      ],
    );
  }
  console.log("[seeds] ✅ Matières premières créées");

  // 5. Insérer des produits finis d'abord (car recipes référence product_id)
  const products = [
    {
      name: "Baguette",
      sku: "PROD-BAG-001",
      category: "pain",
      price: 400,
      costPrice: 250,
      stock: 50,
      barcode: "3012345678901",
    },
    {
      name: "Pain au chocolat",
      sku: "PROD-PAC-001",
      category: "viennoiserie",
      price: 700,
      costPrice: 400,
      stock: 30,
      barcode: "3012345678902",
    },
    {
      name: "Croissant",
      sku: "PROD-CRO-001",
      category: "viennoiserie",
      price: 650,
      costPrice: 380,
      stock: 35,
      barcode: "3012345678903",
    },
    {
      name: "Pain de campagne",
      sku: "PROD-PDC-001",
      category: "pain",
      price: 1200,
      costPrice: 700,
      stock: 20,
      barcode: "3012345678904",
    },
    {
      name: "Pain au lait",
      sku: "PROD-PAL-001",
      category: "pain",
      price: 500,
      costPrice: 300,
      stock: 40,
      barcode: "3012345678905",
    },
    {
      name: "Gateau Nokan",
      sku: "PROD-GAT-001",
      category: "patisserie",
      price: 2500,
      costPrice: 1500,
      stock: 15,
      barcode: "3012345678906",
    },
    {
      name: "Café filtre",
      sku: "PROD-CAF-001",
      category: "boisson",
      price: 500,
      costPrice: 150,
      stock: 100,
      barcode: "3012345678907",
    },
  ];

  const productIds: Record<string, string> = {};
  for (const product of products) {
    const id = randomUUID();
    productIds[product.name] = id;
    await pool.query(
      `
      INSERT INTO products (id, sku, name, category, price, cost_price, vat_rate, stock, min_stock, unit, barcode, store_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, 18, $7, 10, 'unite', $8, $9, true)
      ON CONFLICT (id) DO NOTHING;
    `,
      [
        id,
        product.sku,
        product.name,
        product.category,
        product.price,
        product.costPrice,
        product.stock,
        product.barcode,
        storeId,
      ],
    );
  }
  console.log("[seeds] ✅ Produits finis créés");

  // 6. Insérer des recettes (ex: baguette, pain au chocolat) qui référence les produits
  const recipes = [
    {
      productName: "Baguette",
      name: "Recette Baguette tradition",
      ingredients: [
        { name: "Farine de blé", quantity: 0.5, unit: "kg", cost: 175 },
        { name: "Eau", quantity: 0.3, unit: "L", cost: 30 },
        {
          name: "Levure de boulanger",
          quantity: 0.005,
          unit: "kg",
          cost: 12.5,
        },
        { name: "Sel fin", quantity: 0.01, unit: "kg", cost: 3 },
      ],
      totalCost: 220.5,
      costPerUnit: 220.5,
    },
    {
      productName: "Pain au chocolat",
      name: "Recette Pain au chocolat",
      ingredients: [
        { name: "Farine de blé", quantity: 0.4, unit: "kg", cost: 140 },
        { name: "Beurre", quantity: 0.15, unit: "kg", cost: 270 },
        { name: "Sucre cristallisé", quantity: 0.08, unit: "kg", cost: 40 },
        { name: "Oeufs", quantity: 2, unit: "unite", cost: 100 },
        {
          name: "Levure de boulanger",
          quantity: 0.005,
          unit: "kg",
          cost: 12.5,
        },
      ],
      totalCost: 562.5,
      costPerUnit: 562.5,
    },
  ];

  const recipeIds: Record<string, string> = {};
  for (const recipe of recipes) {
    const recipeId = randomUUID();
    recipeIds[recipe.name] = recipeId;
    const productId = productIds[recipe.productName];

    await pool.query(
      `
      INSERT INTO recipes (id, name, product_id, product_name, output_yield, output_unit, preparation_time_min, total_cost, cost_per_unit)
      VALUES ($1, $2, $3, $4, 10, 'unite', 45, $5, $6)
      ON CONFLICT (id) DO NOTHING;
    `,
      [
        recipeId,
        recipe.name,
        productId,
        recipe.productName,
        recipe.totalCost,
        recipe.costPerUnit,
      ],
    );

    // Ajouter les ingrédients de la recette dans recipe_ingredients
    for (const ing of recipe.ingredients) {
      const rmId = rawMaterialIds[ing.name];
      if (rmId) {
        await pool.query(
          `
          INSERT INTO recipe_ingredients (recipe_id, material_id, material_name, quantity, unit, cost)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
          [recipeId, rmId, ing.name, ing.quantity, ing.unit, ing.cost],
        );
      }
    }
  }
  console.log("[seeds] ✅ Recettes créées");
  console.log("[seeds] ✅ Produits finis créés");

  await pool.end();
  console.log(
    "[seeds] 🎉 Toutes les données fictives ont été insérées avec succès !",
  );
};

runSeeds().catch((err) => {
  console.error("[seeds] ❌ Échec des seeds :", err);
  process.exit(1);
});
