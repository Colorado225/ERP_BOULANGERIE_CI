/**
 * Service d'inventaire : ajustements de stock, pertes, mouvements de stock.
 *
 * Toutes les opérations multi-tables utilisent la transaction de `db.ts`
 * pour garantir l'intégrité référentielle (mouvement + mise à jour du stock
 * de la matière première dans la même transaction atomique).
 */

import { query, queryOne, transaction } from "../db";
import { randomUUID as uuid } from "node:crypto";
import type { StockMovement, StockMovementSource } from "../types/bakery";

export type { StockMovement, StockMovementSource };

/**
 * Crée un mouvement de stock (entrée ou sortie) et met à jour le stock
 * de la matière première dans la même transaction.
 */
export const createStockMovement = async (
  input: {
    materialId: string;
    delta: number;
    unit: string;
    source: StockMovementSource;
    reference?: string;
    reason?: string;
    recordedBy: string;
    storeId: string;
    id?: string;
  },
): Promise<StockMovement> => {
  const id = input.id ?? uuid();

  return transaction(async (tx) => {
    const mat = await tx.queryOne<{
      id: string;
      name: string;
      current_stock: number;
      unit: string;
    }>(
      `SELECT id, name, current_stock, unit FROM raw_materials WHERE id = $1`,
      [input.materialId],
    );

    if (!mat) throw new Error(`Matière première introuvable : ${input.materialId}`);

    const resultingStock = mat.current_stock + input.delta;

    if (resultingStock < 0) {
      throw new Error(
        `Stock insuffisant : ${mat.name} n'a que ${mat.current_stock}${mat.unit}, mouvement demandé ${input.delta}${input.unit}.`,
      );
    }

    const movement = await tx.queryOne<StockMovement>(
      `INSERT INTO stock_movements
         (id, material_id, material_name, delta, resulting_stock, unit, source,
          reference, reason, recorded_by, store_id, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
       RETURNING id, material_id AS "materialId", material_name AS "materialName",
                 delta, resulting_stock AS "resultingStock", unit, source, reference,
                 reason, recorded_by AS "recordedBy", store_id AS "storeId", date`,
      [
        id,
        input.materialId,
        mat.name,
        input.delta,
        resultingStock,
        input.unit,
        input.source,
        input.reference ?? null,
        input.reason ?? null,
        input.recordedBy,
        input.storeId,
      ],
    );

    if (!movement) throw new Error("Impossible d'insérer le mouvement.");

    await tx.query(
      `UPDATE raw_materials SET current_stock = $2 WHERE id = $1`,
      [input.materialId, resultingStock],
    );

    return movement;
  });
};

export const adjustMaterialStock = async (
  materialId: string,
  newStock: number,
  recordedBy: string,
  storeId: string,
): Promise<void> => {
  await transaction(async (tx) => {
    const mat = await tx.queryOne<{ current_stock: number; unit: string }>(
      `SELECT current_stock, unit FROM raw_materials WHERE id = $1`,
      [materialId],
    );

    if (!mat) throw new Error(`Matière première introuvable : ${materialId}`);

    if (newStock < 0) {
      throw new Error(`Le stock ne peut pas être négatif pour ${materialId}`);
    }

    const delta = newStock - mat.current_stock;

    await tx.query(
      `UPDATE raw_materials SET current_stock = $2 WHERE id = $1`,
      [materialId, newStock],
    );

    if (delta !== 0) {
      await tx.query(
        `INSERT INTO stock_movements
           (id, material_id, material_name, delta, resulting_stock, unit,
            source, reason, recorded_by, store_id, date)
         VALUES ($1,$2,$3,$4,$5,$6,'ajustement_manuel',$7,$8,$9,now())`,
        [
          uuid(),
          materialId,
          mat.current_stock,
          delta,
          newStock,
          mat.unit,
          mat.unit,
          recordedBy,
          storeId,
        ],
      );
    }
  });
};

export interface LossInput {
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  lossValue: number;
  reason: string;
  destination: string;
  recordedBy: string;
  storeId: string;
  notes?: string;
}

export const createLoss = async (input: LossInput): Promise<void> => {
  const id = uuid();

  await transaction(async (tx) => {
    if (input.productId) {
      const prod = await tx.queryOne<{ stock: number }>(
        `SELECT stock FROM products WHERE id = $1`,
        [input.productId],
      );
      if (!prod) throw new Error(`Produit introuvable : ${input.productId}`);
      const newStock = Math.max(0, prod.stock - input.quantity);
      await tx.query(`UPDATE products SET stock = $2 WHERE id = $1`, [
        input.productId,
        newStock,
      ]);
    }

    await tx.query(
      `INSERT INTO losses
         (id, date, product_id, product_name, quantity, unit, loss_value,
          reason, destination, store_id, recorded_by, notes)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        input.productId,
        input.productName,
        input.quantity,
        input.unit,
        input.lossValue,
        input.reason,
        input.destination,
        input.storeId,
        input.recordedBy,
        input.notes ?? null,
      ],
    );
  });
};

export const getMaterial = async (materialId: string) => {
  return queryOne<StockMovement>(
    `SELECT id, material_id AS "materialId", material_name AS "materialName",
            delta, resulting_stock AS "resultingStock", unit, source, reference,
            reason, recorded_by AS "recordedBy", store_id AS "storeId", date
       FROM stock_movements
      WHERE material_id = $1
      ORDER BY date DESC, id DESC
      LIMIT 1`,
    [materialId],
  );
};
