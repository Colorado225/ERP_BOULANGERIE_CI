/**
 * Service métier des ventes (lot 2).
 *
 * Garanties, toutes dans une même transaction :
 * - prix, TVA, totaux et monnaie calculés depuis la base (`saleCalculation`) ;
 *   les montants du client ne sont jamais lus ;
 * - idempotence : un `id` de vente déjà enregistré renvoie la vente existante,
 *   sans second décompte de stock ni second numéro ;
 * - numérotation continue par boutique (`receipt_sequences`, verrouillée par
 *   l'UPDATE ; un ROLLBACK ne laisse donc aucun trou) ;
 * - décrément du stock des produits verrouillés (`FOR UPDATE`, ordre fixe).
 *
 * Les dépendances SQL sont injectables pour les tests d'intégration.
 */
import { randomUUID } from "node:crypto";
import {
  query as defaultQuery,
  queryOne as defaultQueryOne,
  transaction as defaultTransaction,
  type SqlClient,
} from "../db";
import type { Sale, SaleItem } from "../types/bakery";
import {
  computeSaleTotals,
  formatReceiptNumber,
  SaleRuleError,
  type SalePaymentMethod,
} from "./saleCalculation";

export interface SalesDb extends SqlClient {
  transaction: <T>(fn: (tx: SqlClient) => Promise<T>) => Promise<T>;
}

export const defaultSalesDb: SalesDb = {
  query: defaultQuery,
  queryOne: defaultQueryOne,
  transaction: defaultTransaction,
};

export interface CreateSaleInput {
  /** Identifiant généré côté client (idempotence). Généré ici si absent. */
  id?: string;
  items: { productId: string; quantity: number }[];
  paymentMethod: SalePaymentMethod;
  amountPaid?: number;
  discountPercent?: number;
  customerId?: string;
  notes?: string;
}

export interface CreateSaleContext {
  storeId: string;
  cashierName: string;
}

export interface CreateSaleResult {
  sale: Sale;
  /** false si la vente existait déjà (rejeu d'un même `id`). */
  created: boolean;
}

/** Signal interne : la vente existe déjà, la transaction est annulée. */
class SaleAlreadyRecorded extends Error {}

const toNumber = (value: unknown): number => Number(value ?? 0);

/** Charge une vente complète (en-tête + lignes) telle que renvoyée à l'API. */
export const loadSale = async (
  db: SqlClient,
  saleId: string,
): Promise<Sale | null> => {
  const row = await db.queryOne<Record<string, unknown>>(
    `SELECT id, receipt_number AS "receiptNumber", date,
            subtotal, discount_amount AS "discountAmount",
            vat_amount AS "vatAmount", total,
            payment_method AS "paymentMethod", amount_paid AS "amountPaid",
            change_returned AS "changeReturned", customer_id AS "customerId",
            customer_name AS "customerName", cashier_name AS "cashierName",
            store_id AS "storeId", status
       FROM sales WHERE id = $1`,
    [saleId],
  );
  if (!row) return null;

  const items = await db.query<Record<string, unknown>>(
    `SELECT product_id AS "productId", name, unit_price AS "unitPrice",
            quantity, total
       FROM sale_items WHERE sale_id = $1 ORDER BY id`,
    [saleId],
  );

  return {
    ...row,
    subtotal: toNumber(row.subtotal),
    discountAmount: toNumber(row.discountAmount),
    vatAmount: toNumber(row.vatAmount),
    total: toNumber(row.total),
    amountPaid: toNumber(row.amountPaid),
    changeReturned: toNumber(row.changeReturned),
    items: items.map((item) => ({
      productId: String(item.productId),
      name: String(item.name),
      unitPrice: toNumber(item.unitPrice),
      quantity: toNumber(item.quantity),
      total: toNumber(item.total),
    })) as SaleItem[],
  } as Sale;
};

export const createSale = async (
  input: CreateSaleInput,
  ctx: CreateSaleContext,
  db: SalesDb = defaultSalesDb,
): Promise<CreateSaleResult> => {
  const saleId = input.id ?? randomUUID();

  try {
    return await db.transaction(async (tx) => {
      // 1. Idempotence : la vente est-elle déjà enregistrée ?
      const existing = await tx.queryOne(
        `SELECT id FROM sales WHERE id = $1`,
        [saleId],
      );
      if (existing) throw new SaleAlreadyRecorded();

      // 2. Produits : prix et TVA lus en base, verrouillés dans un ordre fixe.
      const productIds = [...new Set(input.items.map((i) => i.productId))].sort();
      const products = await tx.query<{
        id: string;
        name: string;
        price: unknown;
        vat_rate: unknown;
        is_active: boolean;
        store_id: string | null;
      }>(
        `SELECT id, name, price, vat_rate, is_active, store_id
           FROM products
          WHERE id = ANY($1::text[])
          ORDER BY id
            FOR UPDATE`,
        [productIds],
      );
      const productById = new Map(products.map((p) => [p.id, p]));

      const lines = input.items.map((item) => {
        const product = productById.get(item.productId);
        if (
          !product ||
          (product.store_id !== null && product.store_id !== ctx.storeId)
        ) {
          throw new SaleRuleError(`Produit introuvable : ${item.productId}`);
        }
        if (!product.is_active) {
          throw new SaleRuleError(`Produit inactif : ${item.productId}`);
        }
        return {
          product,
          quantity: item.quantity,
          unitPrice: toNumber(product.price),
          vatRate: toNumber(product.vat_rate),
        };
      });

      // 3. Client (obligatoire pour un crédit B2B).
      let customerName: string | null = null;
      if (input.customerId) {
        const customer = await tx.queryOne<{ name: string }>(
          `SELECT name FROM customers WHERE id = $1`,
          [input.customerId],
        );
        if (!customer) throw new SaleRuleError("Client introuvable.");
        customerName = customer.name;
      }
      if (input.paymentMethod === "credit_b2b" && !input.customerId) {
        throw new SaleRuleError("Un client est requis pour un crédit B2B.");
      }

      // 4. Totaux recalculés. Aucune valeur client n'est reprise.
      const totals = computeSaleTotals({
        lines: lines.map((l) => ({
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          vatRate: l.vatRate,
        })),
        paymentMethod: input.paymentMethod,
        discountPercent: input.discountPercent,
        amountPaid: input.amountPaid,
      });

      // 5. Numéro de ticket : séquence continue de la boutique.
      const seq = await tx.queryOne<{ last_number: unknown }>(
        `INSERT INTO receipt_sequences (store_id, last_number)
              VALUES ($1, 1)
         ON CONFLICT (store_id)
           DO UPDATE SET last_number = receipt_sequences.last_number + 1
         RETURNING last_number`,
        [ctx.storeId],
      );
      const receiptNumber = formatReceiptNumber(
        ctx.storeId,
        toNumber(seq?.last_number),
      );

      // 6. En-tête de vente. Un conflit d'id (course entre deux requêtes
      //    identiques) annule la transaction : séquence et stock restent intacts.
      const inserted = await tx.queryOne<{ id: string }>(
        `INSERT INTO sales
           (id, receipt_number, date, subtotal, discount_amount, vat_amount,
            total, payment_method, amount_paid, change_returned, customer_id,
            customer_name, cashier_name, store_id, status, notes)
         VALUES ($1,$2,CURRENT_TIMESTAMP,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [
          saleId,
          receiptNumber,
          totals.subtotal,
          totals.discountAmount,
          totals.vatAmount,
          totals.total,
          input.paymentMethod,
          totals.amountPaid,
          totals.changeReturned,
          input.customerId ?? null,
          customerName,
          ctx.cashierName,
          ctx.storeId,
          input.paymentMethod === "credit_b2b" ? "en_attente" : "paye",
          input.notes ?? null,
        ],
      );
      if (!inserted) throw new SaleAlreadyRecorded();

      // 7. Lignes et décrément du stock (dans la même transaction).
      for (const line of lines) {
        await tx.query(
          `INSERT INTO sale_items
             (sale_id, product_id, name, unit_price, quantity, total)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            saleId,
            line.product.id,
            line.product.name,
            line.unitPrice,
            line.quantity,
            line.unitPrice * line.quantity,
          ],
        );
        await tx.query(
          `UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2`,
          [line.quantity, line.product.id],
        );
      }

      const sale = await loadSale(tx, saleId);
      if (!sale) throw new Error("Vente absente après insertion.");
      return { sale, created: true };
    });
  } catch (err) {
    if (!(err instanceof SaleAlreadyRecorded)) throw err;

    // Rejeu : renvoyer la vente existante, uniquement à sa boutique.
    const existing = await loadSale(db, saleId);
    if (!existing || existing.storeId !== ctx.storeId) {
      throw new SaleRuleError("Identifiant de vente déjà utilisé.", 409);
    }
    return { sale: existing, created: false };
  }
};
