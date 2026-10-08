/**
 * Service métier des ventes — crée un ticket de caisse + son contenu,
 * met à jour le stock des produits finis.
 *
 * La transaction garantit que le ticket, ses lignes et la réduction de stock
 * sont dans un état cohérent.
 */

import { query, queryOne, transaction } from "../db";
import { randomUUID as uuid } from "node:crypto";
import type { Sale, SaleItem } from "../types/bakery";

/** Ligne de ticket telle qu'écrite en base (avec les colonnes techniques). */
type SaleItemRow = SaleItem & { id: string; saleId: string };

export interface SaleInput {
  items: { productId: string; quantity: number; unitPrice?: number; name?: string }[];
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  changeReturned: number;
  customerId?: string;
  customerName?: string;
  cashierName: string;
  storeId: string;
  notes?: string;
}

export const createSale = async (input: SaleInput): Promise<Sale> => {
  const id = uuid();
  const receiptNumber = `RCPT-${Date.now().toString(36).toUpperCase()}`;

  return transaction(async (tx) => {
    // 1. Valider les produits et calculer le total
    let subtotal = 0;
    const saleItems: SaleItemRow[] = [];
    for (const line of input.items) {
      const prod = await tx.queryOne<{
        id: string;
        name: string;
        price: number;
        unit: string;
        is_active: boolean;
      }>(
        `SELECT id, name, price, unit, is_active FROM products WHERE id = $1`,
        [line.productId],
      );
      if (!prod) throw new Error(`Produit introuvable : ${line.productId}`);
      if (!prod.is_active) throw new Error(`Produit inactif : ${line.productId}`);
      const qty = Number(line.quantity);
      if (qty <= 0) throw new Error(`Quantité invalide pour ${line.productId}`);
      if (!prod.price) throw new Error(`Prix manquant pour ${line.productId}`);

      const unitPrice = line.unitPrice ?? prod.price;
      const itemTotal = unitPrice * qty;
      subtotal += itemTotal;

      saleItems.push({
        id: uuid(),
        saleId: id,
        productId: line.productId,
        name: line.name ?? prod.name,
        unitPrice,
        quantity: qty,
        total: itemTotal,
      });

      // Réduction de stock dans la même transaction
      await tx.query(
        `UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2`,
        [qty, line.productId],
      );
    }

    const discountAmount = Number(input.discountAmount ?? 0);
    const vatAmount = Number(input.vatAmount ?? 0);
    const total = Number(input.total ?? subtotal - discountAmount + vatAmount);
    const amountPaid = Number(input.amountPaid ?? total);
    const changeReturned = amountPaid - total;

    // 2. Insérer la vente
    const sale = await tx.queryOne<Sale>(
      `INSERT INTO sales
         (id, receipt_number, date, subtotal, discount_amount, vat_amount,
          total, payment_method, amount_paid, change_returned, customer_id,
          customer_name, cashier_name, store_id, status, notes)
       VALUES ($1,$2,CURRENT_TIMESTAMP,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'paye',$14)
       RETURNING id, receipt_number AS "receiptNumber", date,
                 subtotal, discount_amount AS "discountAmount",
                 vat_amount AS "vatAmount", total, payment_method AS "paymentMethod",
                 amount_paid AS "amountPaid", change_returned AS "changeReturned",
                 customer_id AS "customerId", customer_name AS "customerName",
                 cashier_name AS "cashierName", store_id AS "storeId", status,
                 notes`,
      [
        id,
        receiptNumber,
        input.subtotal ?? subtotal,
        discountAmount,
        vatAmount,
        total,
        input.paymentMethod,
        amountPaid,
        changeReturned,
        input.customerId ?? null,
        input.customerName ?? null,
        input.cashierName,
        input.storeId,
        input.notes ?? null,
      ],
    );

    if (!sale) throw new Error("Impossible d'insérer la vente.");

    // 3. Insérer les lignes
    for (const item of saleItems) {
      await tx.query(
        `INSERT INTO sale_items (id, sale_id, product_id, name, unit_price, quantity, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [item.id, item.saleId, item.productId, item.name, item.unitPrice, item.quantity, item.total],
      );
    }

    return { ...sale, items: saleItems };
  });
};
