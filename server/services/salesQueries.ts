/**
 * Requêtes de lecture pour les ventes.
 */

import { query, queryOne } from "../db";
import type { Sale } from "../types/bakery";

export const getSale = async (id: string): Promise<Sale | null> => {
  return queryOne<Sale>(
    `SELECT id, receipt_number AS "receiptNumber", date, subtotal, discount_amount AS "discountAmount",
            vat_amount AS "vatAmount", total, payment_method AS "paymentMethod",
            amount_paid AS "amountPaid", change_returned AS "changeReturned",
            customer_id AS "customerId", customer_name AS "customerName",
            cashier_name AS "cashierName", store_id AS "storeId", status, notes
       FROM sales WHERE id = $1`,
    [id],
  );
};

export const getSaleByReceipt = async (receiptNumber: string): Promise<Sale | null> => {
  return queryOne<Sale>(
    `SELECT id, receipt_number AS "receiptNumber", date, subtotal, discount_amount AS "discountAmount",
            vat_amount AS "vatAmount", total, payment_method AS "paymentMethod",
            amount_paid AS "amountPaid", change_returned AS "changeReturned",
            customer_id AS "customerId", customer_name AS "customerName",
            cashier_name AS "cashierName", store_id AS "storeId", status, notes
       FROM sales WHERE receipt_number = $1`,
    [receiptNumber],
  );
};

export const getSalesForStore = async (
  storeId: string,
  limit = 50,
): Promise<Sale[]> => {
  return query<Sale>(
    `SELECT id, receipt_number AS "receiptNumber", date, subtotal, discount_amount AS "discountAmount",
            vat_amount AS "vatAmount", total, payment_method AS "paymentMethod",
            amount_paid AS "amountPaid", change_returned AS "changeReturned",
            customer_id AS "customerId", customer_name AS "customerName",
            cashier_name AS "cashierName", store_id AS "storeId", status, notes
       FROM sales WHERE store_id = $1 ORDER BY date DESC LIMIT $2`,
    [storeId, limit],
  );
};
