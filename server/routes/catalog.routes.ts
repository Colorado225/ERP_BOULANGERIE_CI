/**
 * Routes de référentiel : produits, matières premières, recettes, clients,
 * fournisseurs, boutiques.
 *
 * Convention : lire exige une session ; modifier exige un rôle suffisant.
 * Toutes les écritures sont paramétrées et toutes les opérations retournent
 * l'objet créé/modifié.
 */

import { Router } from "express";
import { query, queryOne, transaction } from "../db";

export const catalogRouter = Router();

const MATERIAL_COLUMNS = `id, code, name, category, current_stock AS "currentStock", unit,
        min_stock_alert AS "minStockAlert", unit_cost AS "unitCost",
        supplier_id AS "supplierId", batch_number AS "batchNumber",
        expiry_date AS "expiryDate", location`;

const RECIPE_COLUMNS = `id, name, product_id AS "productId", product_name AS "productName",
        output_yield AS "outputYield", output_unit AS "outputUnit",
        preparation_time_min AS "preparationTimeMin",
        proofing_time_min AS "proofingTimeMin",
        baking_time_min AS "bakingTimeMin", baking_temp_c AS "bakingTempC",
        instructions, total_cost AS "totalCost", cost_per_unit AS "costPerUnit"`;

/** ------------------------------------------------------------------ */
/**  STORES                                                             */
/** ------------------------------------------------------------------ */

catalogRouter.get("/stores", async (_req, res) => {
  res.json(
    await query(
      `SELECT id, name, location, phone, manager_name AS "managerName", is_main AS "isMain"
         FROM stores ORDER BY is_main DESC, name`,
    ),
  );
});

catalogRouter.post("/stores", async (req, res) => {
  const s = req.body as {
    id?: string; name: string; location: string; phone: string;
    managerName?: string; isMain?: boolean;
  };
  if (!s.name) return res.status(400).json({ error: "Le nom est obligatoire." });
  const row = await queryOne(
    `INSERT INTO stores (id, name, location, phone, manager_name, is_main)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, name, location, phone, manager_name AS "managerName", is_main AS "isMain"`,
    [s.id ?? null, s.name, s.location ?? "", s.phone ?? "", s.managerName ?? null, s.isMain ?? false],
  );
  if (!row) return res.status(500).json({ error: "Erreur interne." });
  res.status(201).json(row);
});

catalogRouter.put("/stores/:id", async (req, res) => {
  const s = req.body as {
    name?: string; location?: string; phone?: string;
    managerName?: string; isMain?: boolean;
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (s.name !== undefined) { sets.push(`name = $${i++}`); params.push(s.name); }
  if (s.location !== undefined) { sets.push(`location = $${i++}`); params.push(s.location); }
  if (s.phone !== undefined) { sets.push(`phone = $${i++}`); params.push(s.phone); }
  if (s.managerName !== undefined) { sets.push(`manager_name = $${i++}`); params.push(s.managerName); }
  if (s.isMain !== undefined) { sets.push(`is_main = $${i++}`); params.push(s.isMain); }
  if (sets.length === 0) return res.status(400).json({ error: "Aucun champ à mettre à jour." });
  params.push(req.params.id);
  const result = await query(
    `UPDATE stores SET ${sets.join(", ")} WHERE id = $${i}
     RETURNING id, name, location, phone, manager_name AS "managerName", is_main AS "isMain"`,
    params,
  );
  if (result.length === 0) return res.status(404).json({ error: "Boutique introuvable." });
  res.json(result[0]);
});

catalogRouter.delete("/stores/:id", async (req, res) => {
  const result = await query(`DELETE FROM stores WHERE id=$1 RETURNING id`, [req.params.id]);
  if (result.length === 0) return res.status(404).json({ error: "Boutique introuvable." });
  res.json({ deleted: true });
});

/** ------------------------------------------------------------------ */
/**  PRODUCTS                                                           */
/** ------------------------------------------------------------------ */

catalogRouter.get("/products", async (_req, res) => {
  res.json(
    await query(
      `SELECT id, sku, name, category, price, cost_price AS "costPrice",
              vat_rate AS "vatRate", stock, min_stock AS "minStock", unit,
              barcode, image_icon AS "imageIcon", description,
              recipe_id AS "recipeId", store_id AS "storeId", is_active AS "isActive"
         FROM products ORDER BY name`,
    ),
  );
});

catalogRouter.post("/products", async (req, res) => {
  const p = req.body as {
    id?: string; sku: string; name: string; category: string; price: number;
    costPrice?: number; vatRate?: number; stock?: number; minStock?: number;
    unit?: string; barcode?: string; imageIcon?: string; description?: string;
    recipeId?: string; storeId?: string; isActive?: boolean;
  };
  if (!p.name || !p.sku) {
    return res.status(400).json({ error: "Le nom et le SKU sont obligatoires." });
  }
  const row = await queryOne(
    `INSERT INTO products
       (id, sku, name, category, price, cost_price, vat_rate, stock, min_stock,
        unit, barcode, image_icon, description, recipe_id, store_id, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id, sku, name, category, price, cost_price AS "costPrice",
               vat_rate AS "vatRate", stock, min_stock AS "minStock", unit,
               barcode, image_icon AS "imageIcon", description,
               recipe_id AS "recipeId", store_id AS "storeId", is_active AS "isActive"`,
    [
      p.id ?? null, p.sku, p.name, p.category ?? "autre",
      p.price, p.costPrice ?? 0, p.vatRate ?? 0, p.stock ?? 0, p.minStock ?? 0,
      p.unit ?? "unite", p.barcode ?? null, p.imageIcon ?? null, p.description ?? null,
      p.recipeId ?? null, p.storeId ?? null, p.isActive ?? true,
    ],
  );
  if (!row) return res.status(500).json({ error: "Erreur interne." });
  res.status(201).json(row);
});

catalogRouter.put("/products/:id", async (req, res) => {
  const p = req.body as {
    name?: string; sku?: string; category?: string; price?: number;
    costPrice?: number; vatRate?: number; stock?: number; minStock?: number;
    unit?: string; barcode?: string; imageIcon?: string; description?: string;
    recipeId?: string; isActive?: boolean;
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  const push = (col: string, val: unknown) => { sets.push(`${col} = $${i++}`); params.push(val); };
  if (p.name !== undefined) push("name", p.name);
  if (p.sku !== undefined) push("sku", p.sku);
  if (p.category !== undefined) push("category", p.category);
  if (p.price !== undefined) push("price", p.price);
  if (p.costPrice !== undefined) push("cost_price", p.costPrice);
  if (p.vatRate !== undefined) push("vat_rate", p.vatRate);
  if (p.stock !== undefined) push("stock", p.stock);
  if (p.minStock !== undefined) push("min_stock", p.minStock);
  if (p.unit !== undefined) push("unit", p.unit);
  if (p.barcode !== undefined) push("barcode", p.barcode);
  if (p.imageIcon !== undefined) push("image_icon", p.imageIcon);
  if (p.description !== undefined) push("description", p.description);
  if (p.recipeId !== undefined) push("recipe_id", p.recipeId);
  if (p.isActive !== undefined) push("is_active", p.isActive);
  if (sets.length === 0) return res.status(400).json({ error: "Aucun champ à mettre à jour." });
  params.push(req.params.id);
  const result = await query(
    `UPDATE products SET ${sets.join(", ")} WHERE id = $${i}
     RETURNING id, sku, name, category, price, cost_price AS "costPrice",
               vat_rate AS "vatRate", stock, min_stock AS "minStock", unit,
               barcode, image_icon AS "imageIcon", description,
               recipe_id AS "recipeId", store_id AS "storeId", is_active AS "isActive"`,
    params,
  );
  if (result.length === 0) return res.status(404).json({ error: "Produit introuvable." });
  res.json(result[0]);
});

catalogRouter.delete("/products/:id", async (req, res) => {
  const result = await query(`DELETE FROM products WHERE id=$1 RETURNING id`, [req.params.id]);
  if (result.length === 0) return res.status(404).json({ error: "Produit introuvable." });
  res.json({ deleted: true });
});


/** ------------------------------------------------------------------ */
/**  RAW MATERIALS                                                      */
/** ------------------------------------------------------------------ */

catalogRouter.get("/materials", async (_req, res) => {
  res.json(
    await query(
      `SELECT ${MATERIAL_COLUMNS}
         FROM raw_materials ORDER BY name`,
    ),
  );
});

catalogRouter.post("/materials", async (req, res) => {
  const m = req.body as {
    id?: string; code: string; name: string; category?: string;
    currentStock?: number; unit?: string; minStockAlert?: number;
    unitCost?: number; supplierId?: string; batchNumber?: string;
    expiryDate?: string; location?: string;
  };
  if (!m.name || !m.code) {
    return res.status(400).json({ error: "Le nom et le code sont obligatoires." });
  }
  const row = await queryOne(
    `INSERT INTO raw_materials
       (id, code, name, category, current_stock, unit, min_stock_alert,
        unit_cost, supplier_id, batch_number, expiry_date, location)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING ${MATERIAL_COLUMNS}`,
    [
      m.id ?? null, m.code, m.name, m.category ?? "autre",
      m.currentStock ?? 0, m.unit ?? "kg", m.minStockAlert ?? 0,
      m.unitCost ?? 0, m.supplierId ?? null, m.batchNumber ?? null,
      m.expiryDate ?? null, m.location ?? null,
    ],
  );
  if (!row) return res.status(500).json({ error: "Erreur interne." });
  res.status(201).json(row);
});

catalogRouter.put("/materials/:id", async (req, res) => {
  const m = req.body as {
    name?: string; code?: string; category?: string; currentStock?: number;
    unit?: string; minStockAlert?: number; unitCost?: number;
    batchNumber?: string; expiryDate?: string; location?: string;
    supplierId?: string;
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  const push = (col: string, val: unknown) => { sets.push(`${col} = $${i++}`); params.push(val); };
  if (m.name !== undefined) push("name", m.name);
  if (m.code !== undefined) push("code", m.code);
  if (m.category !== undefined) push("category", m.category);
  if (m.currentStock !== undefined) push("current_stock", m.currentStock);
  if (m.unit !== undefined) push("unit", m.unit);
  if (m.minStockAlert !== undefined) push("min_stock_alert", m.minStockAlert);
  if (m.unitCost !== undefined) push("unit_cost", m.unitCost);
  if (m.supplierId !== undefined) push("supplier_id", m.supplierId);
  if (m.batchNumber !== undefined) push("batch_number", m.batchNumber);
  if (m.expiryDate !== undefined) push("expiry_date", m.expiryDate);
  if (m.location !== undefined) push("location", m.location);
  if (sets.length === 0) return res.status(400).json({ error: "Aucun champ à mettre à jour." });
  params.push(req.params.id);
  const result = await query(
    `UPDATE raw_materials SET ${sets.join(", ")} WHERE id = $${i}
     RETURNING ${MATERIAL_COLUMNS}`,
    params,
  );
  if (result.length === 0) return res.status(404).json({ error: "Matière introuvable." });
  res.json(result[0]);
});

catalogRouter.delete("/materials/:id", async (req, res) => {
  const result = await query(`DELETE FROM raw_materials WHERE id=$1 RETURNING id`, [req.params.id]);
  if (result.length === 0) return res.status(404).json({ error: "Matière introuvable." });
  res.json({ deleted: true });
});

