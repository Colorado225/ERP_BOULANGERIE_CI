/**
 * Routes d'opérations métier.
 *
 * Les opérations qui touchent plusieurs tables (vente → stock → caisse →
 * fidélité, réception → stock → dette, fin de fournée → consommation) sont
 * exécutées dans des transactions atomiques : tout ou rien.
 *
 * Chantier 2.1 : plus aucune écriture partielle possible.
 */

import { Router } from "express";
import { query, queryOne } from "../db";
import { createSale, getSale, getSalesForStore } from "../services/salesService";
import { createProductionOrder, updateProductionOrder, getProductionOrder, getProductionOrdersByStore } from "../services/productionService";
import { createPurchaseOrder, getPurchaseOrder, getPurchaseOrdersByStore, updatePurchaseOrderStatus } from "../services/purchaseService";
import { createStockMovement, adjustMaterialStock } from "../services/inventoryService";
import { createLoss } from "../services/inventoryService";
import type { Router as RetroRouter } from "express";

export const operationsRouter = Router();

operationsRouter.use((_req, res, next) => {
  next();
});

/** ------------------------------------------------------------------ */
/**  SALES                                                              */
/** ------------------------------------------------------------------ */

operationsRouter.get("/sales", async (_req, res) => {
  const sales = await getSalesForStore("store-1", 500);
  res.json(sales);
});

operationsRouter.get("/sales/:id", async (req, res) => {
  const sale = await getSale(req.params.id);
  if (!sale) return res.status(404).json({ error: "Vente introuvable." });
  res.json(sale);
});

operationsRouter.post(
  "/sales",
  async (req, res) => {
    const s = req.body as {
      id?: string; items: Array<{ productId: string; quantity: number; unitPrice?: number; name?: string }>;
      subtotal?: number; discountAmount?: number; vatAmount?: number;
      total?: number; paymentMethod: string; amountPaid?: number;
      changeReturned?: number; customerId?: string; customerName?: string;
      cashierName?: string; storeId?: string; notes?: string;
    };
    const cashierName = s.cashierName ??
      (req as { user?: { name?: string } }).user?.name ??
      "Caisse";
    const storeId = s.storeId ??
      (req as { user?: { storeId?: string } }).user?.storeId ??
      "store-1";

    try {
      const sale = await createSale({
        items: s.items,
        subtotal: s.subtotal ?? 0,
        discountAmount: s.discountAmount ?? 0,
        vatAmount: s.vatAmount ?? 0,
        total: s.total ?? 0,
        paymentMethod: s.paymentMethod,
        amountPaid: s.amountPaid ?? 0,
        changeReturned: s.changeReturned ?? 0,
        customerId: s.customerId ?? undefined,
        customerName: s.customerName ?? undefined,
        cashierName,
        storeId,
        notes: s.notes ?? undefined,
      });
      res.status(201).json(sale);
    } catch (err) {
      console.error("[api] échec vente :", err);
      res.status(500).json({ error: "Échec de l'enregistrement de la vente." });
    }
  },
);

/** ------------------------------------------------------------------ */
/**  PRODUCTION                                                         */
/** ------------------------------------------------------------------ */

operationsRouter.get("/production-orders", async (_req, res) => {
  const orders = await getProductionOrdersByStore("store-1", 500);
  res.json(orders);
});

operationsRouter.get("/production-orders/:id", async (req, res) => {
  const order = await getProductionOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Ordre introuvable." });
  res.json(order);
});

operationsRouter.post(
  "/production-orders",
  async (req, res) => {
    const o = req.body as {
      id?: string; recipeId?: string; recipeName?: string; productId?: string;
      productName?: string; batchMultiplier?: number; targetQuantity?: number;
      status?: string; scheduledTime?: string; completedTime?: string;
      bakerName?: string; shift?: string; storeId?: string; notes?: string;
    };

    try {
      const order = await createProductionOrder({
        recipeId: o.recipeId,
        recipeName: o.recipeName,
        productId: o.productId,
        productName: o.productName,
        batchMultiplier: o.batchMultiplier,
        targetQuantity: o.targetQuantity,
        scheduledTime: o.scheduledTime,
        completedTime: o.completedTime,
        bakerName: o.bakerName,
        shift: o.shift,
        storeId: o.storeId ?? "store-1",
        notes: o.notes,
      });
      res.status(201).json(order);
    } catch (err) {
      console.error("[api] échec fournée :", err);
      res.status(500).json({ error: "Échec de l'enregistrement de la fournée." });
    }
  },
);

operationsRouter.put(
  "/production-orders/:id",
  async (req, res) => {
    const o = req.body as {
      recipeId?: string; recipeName?: string; productId?: string;
      productName?: string; batchMultiplier?: number; targetQuantity?: number;
      actualQuantity?: number; status?: string; scheduledTime?: string;
      completedTime?: string; bakerName?: string; shift?: string;
      notes?: string;
    };
    const order = await updateProductionOrder(req.params.id, {
      status: o.status,
      actualQuantity: o.actualQuantity,
      completedTime: o.completedTime,
      notes: o.notes,
    });
    if (!order) return res.status(404).json({ error: "Ordre introuvable." });
    res.json(order);
  },
);

/** ------------------------------------------------------------------ */
/**  PURCHASES                                                          */
/** ------------------------------------------------------------------ */

operationsRouter.get("/purchase-orders", async (_req, res) => {
  const orders = await getPurchaseOrdersByStore("store-1", 500);
  res.json(orders);
});

operationsRouter.get("/purchase-orders/:id", async (req, res) => {
  const order = await getPurchaseOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Bon introuvable." });
  res.json(order);
});

operationsRouter.post(
  "/purchase-orders",
  async (req, res) => {
    const po = req.body as {
      id?: string; supplierId?: string; supplierName?: string; date?: string;
      items: Array<{ materialId: string; materialName: string; quantity: number; unit: string; unitPrice: number }>;
      notes?: string;
    };

    try {
      const order = await createPurchaseOrder({
        supplierId: po.supplierId, supplierName: po.supplierName, date: po.date,
        items: po.items, notes: po.notes,
      });
      res.status(201).json(order);
    } catch (err) {
      console.error("[api] échec bon commande :", err);
      res.status(500).json({ error: "Échec de l'enregistrement du bon de commande." });
    }
  },
);

operationsRouter.put(
  "/purchase-orders/:id",
  async (req, res) => {
    const po = req.body as {
      supplierName?: string; date?: string; items?: unknown[];
      status?: string; notes?: string;
    };
    const order = await updatePurchaseOrderStatus(req.params.id, po.status ?? "commande");
    if (!order) return res.status(404).json({ error: "Bon introuvable." });
    res.json(order);
  },
);

operationsRouter.delete(
  "/purchase-orders/:id",
  async (req, res) => {
    await query(`DELETE FROM purchase_order_items WHERE order_id=$1`, [req.params.id]);
    const result = await query(`DELETE FROM purchase_orders WHERE id=$1 RETURNING id`, [req.params.id]);
    if (result.length === 0) return res.status(404).json({ error: "Bon introuvable." });
    res.json({ deleted: true });
  },
);

/** ------------------------------------------------------------------ */
/**  LOSSES (perte) — transaction avec mise à jour du stock produit      */
/** ------------------------------------------------------------------ */

operationsRouter.get("/losses", async (_req, res) => {
  res.json(
    await query(
      `SELECT id, date, product_id AS "productId", product_name AS "productName",
              quantity, unit, loss_value AS "lossValue", reason, destination,
              store_id AS "storeId", recorded_by AS "recordedBy", notes
         FROM losses ORDER BY date DESC`,
    ),
  );
});

operationsRouter.post(
  "/losses",
  async (req, res) => {
    const l = req.body as {
      id?: string; productId?: string; productName: string; quantity: number;
      unit?: string; lossValue?: number; reason: string; destination: string;
      storeId?: string; recordedBy?: string; notes?: string;
    };
    try {
      await createLoss({
        productId: l.productId ?? undefined,
        productName: l.productName,
        quantity: l.quantity,
        unit: l.unit ?? "unite",
        lossValue: l.lossValue ?? 0,
        reason: l.reason,
        destination: l.destination,
        recordedBy: l.recordedBy ?? "système",
        storeId: l.storeId ?? "store-1",
        notes: l.notes,
      });
      res.status(201).json({ created: true });
    } catch (err) {
      console.error("[api] échec perte :", err);
      res.status(500).json({ error: "Échec de l'enregistrement de la perte." });
    }
  },
);

operationsRouter.put(
  "/losses/:id",
  async (req, res) => {
    const l = req.body as {
      quantity?: number; unit?: string; lossValue?: number;
      reason?: string; destination?: string; notes?: string;
    };
    const result = await query(
      `UPDATE losses SET
         quantity = COALESCE($2, quantity),
         unit = COALESCE($3, unit),
         loss_value = COALESCE($4, loss_value),
         reason = COALESCE($5, reason),
         destination = COALESCE($6, destination),
         notes = COALESCE($7, notes)
       WHERE id = $1
       RETURNING id, product_id AS "productId", product_name AS "productName",
                 quantity, unit, loss_value AS "lossValue", reason,
                 destination, date, notes, store_id AS "storeId"`,
      [req.params.id, l.quantity, l.unit, l.lossValue, l.reason, l.destination, l.notes],
    );
    if (result.length === 0) return res.status(404).json({ error: "Perte introuvable." });
    res.json(result[0]);
  },
);

/** ------------------------------------------------------------------ */
/**  CASH & CUSTOM                                                    */
/** ------------------------------------------------------------------ */

operationsRouter.get("/cash-transactions", async (_req, res) => {
  res.json(
    await query(
      `SELECT id, type, amount, description, date,
              recorded_by AS "recordedBy", store_id AS "storeId"
         FROM cash_transactions ORDER BY date DESC`,
    ),
  );
});

operationsRouter.post(
  "/cash-transactions",
  async (req, res) => {
    const t = req.body as {
      id?: string; type: string; amount: number; description?: string;
      recordedBy?: string; storeId?: string;
    };
    const row = await queryOne(
      `INSERT INTO cash_transactions (id, type, amount, description, date, recorded_by, store_id)
       VALUES ($1,$2,$3,$4,now(),$5,$6)
       RETURNING id, type, amount, description, date, recorded_by AS "recordedBy", store_id AS "storeId"`,
      [t.id ?? null, t.type, t.amount, t.description ?? null, t.recordedBy ?? null, t.storeId ?? "store-1"],
    );
    if (!row) return res.status(500).json({ error: "Erreur interne." });
    res.status(201).json(row);
  },
);

operationsRouter.put(
  "/cash-transactions/:id",
  async (req, res) => {
    const t = req.body as { type?: string; amount?: number; description?: string };
    const result = await query(
      `UPDATE cash_transactions SET
         type = COALESCE($2, type),
         amount = COALESCE($3, amount),
         description = COALESCE($4, description)
       WHERE id = $1 RETURNING id, type, amount, description, date,
                 recorded_by AS "recordedBy", store_id AS "storeId"`,
      [req.params.id, t.type, t.amount, t.description],
    );
    if (result.length === 0) return res.status(404).json({ error: "Transaction introuvable." });
    res.json(result[0]);
  },
);

operationsRouter.delete(
  "/cash-transactions/:id",
  async (req, res) => {
    const result = await query(`DELETE FROM cash_transactions WHERE id=$1 RETURNING id`, [req.params.id]);
    if (result.length === 0) return res.status(404).json({ error: "Transaction introuvable." });
    res.json({ deleted: true });
  },
);

operationsRouter.get("/custom-orders", async (_req, res) => {
  res.json(
    await query(
      `SELECT id, order_number AS "orderNumber", client_name AS "clientName", phone,
              cake_type AS "cakeType", serving_count AS "servingCount", flavor,
              custom_inscription AS "customInscription", theme_color AS "themeColor",
              pickup_date AS "pickupDate", pickup_time AS "pickupTime",
              total_price AS "totalPrice", deposit_paid AS "depositPaid",
              status, store_id AS "storeId", notes
         FROM custom_orders ORDER BY pickup_date`,
    ),
  );
});

operationsRouter.post(
  "/custom-orders",
  async (req, res) => {
    const o = req.body as {
      id?: string; orderNumber?: string; clientName: string; phone?: string;
      cakeType?: string; servingCount?: number; flavor?: string;
      customInscription?: string; themeColor?: string; pickupDate?: string;
      pickupTime?: string; totalPrice?: number; depositPaid?: number;
      status?: string; storeId?: string; notes?: string;
    };
    const row = await queryOne(
      `INSERT INTO custom_orders
         (id, order_number, client_name, phone, cake_type, serving_count, flavor,
          custom_inscription, theme_color, pickup_date, pickup_time, total_price,
          deposit_paid, status, store_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id, order_number AS "orderNumber", client_name AS "clientName", phone,
                 cake_type AS "cakeType", serving_count AS "servingCount", flavor,
                 custom_inscription AS "customInscription", theme_color AS "themeColor",
                 pickup_date AS "pickupDate", pickup_time AS "pickupTime",
                 total_price AS "totalPrice", deposit_paid AS "depositPaid",
                 status, store_id AS "storeId", notes`,
      [
        o.id ?? null, o.orderNumber ?? null, o.clientName,
        o.phone ?? null, o.cakeType ?? null, o.servingCount ?? 0, o.flavor ?? null,
        o.customInscription ?? null, o.themeColor ?? null, o.pickupDate ?? null,
        o.pickupTime ?? null, o.totalPrice ?? 0, o.depositPaid ?? 0,
        o.status ?? "commande", o.storeId ?? "store-1", o.notes ?? null,
      ],
    );
    if (!row) return res.status(500).json({ error: "Erreur interne." });
    res.status(201).json(row);
  },
);

operationsRouter.patch(
  "/custom-orders/:id/status",
  async (req, res) => {
    const result = await query(
      `UPDATE custom_orders SET status = $2 WHERE id = $1 RETURNING id, order_number AS "orderNumber",
                client_name AS "clientName", status, store_id AS "storeId"`,
      [req.params.id, (req.body as { status: string }).status],
    );
    if (result.length === 0) return res.status(404).json({ error: "Commande introuvable." });
    res.json(result[0]);
  },
);

operationsRouter.put(
  "/custom-orders/:id",
  async (req, res) => {
    const o = req.body as {
      clientName?: string; phone?: string; cakeType?: string; servingCount?: number;
      flavor?: string; customInscription?: string; themeColor?: string;
      pickupDate?: string; pickupTime?: string; totalPrice?: number;
      depositPaid?: number; status?: string; notes?: string;
    };
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (o.clientName !== undefined) { sets.push(`client_name = $${i++}`); params.push(o.clientName); }
    if (o.phone !== undefined) { sets.push(`phone = $${i++}`); params.push(o.phone); }
    if (o.cakeType !== undefined) { sets.push(`cake_type = $${i++}`); params.push(o.cakeType); }
    if (o.servingCount !== undefined) { sets.push(`serving_count = $${i++}`); params.push(o.servingCount); }
    if (o.flavor !== undefined) { sets.push(`flavor = $${i++}`); params.push(o.flavor); }
    if (o.customInscription !== undefined) { sets.push(`custom_inscription = $${i++}`); params.push(o.customInscription); }
    if (o.themeColor !== undefined) { sets.push(`theme_color = $${i++}`); params.push(o.themeColor); }
    if (o.pickupDate !== undefined) { sets.push(`pickup_date = $${i++}`); params.push(o.pickupDate); }
    if (o.pickupTime !== undefined) { sets.push(`pickup_time = $${i++}`); params.push(o.pickupTime); }
    if (o.totalPrice !== undefined) { sets.push(`total_price = $${i++}`); params.push(o.totalPrice); }
    if (o.depositPaid !== undefined) { sets.push(`deposit_paid = $${i++}`); params.push(o.depositPaid); }
    if (o.status !== undefined) { sets.push(`status = $${i++}`); params.push(o.status); }
    if (o.notes !== undefined) { sets.push(`notes = $${i++}`); params.push(o.notes); }
    params.push(req.params.id);

    const result = await query(
      `UPDATE custom_orders SET ${sets.join(", ")} WHERE id = $${i}
       RETURNING id, order_number AS "orderNumber", client_name AS "clientName", phone,
                 cake_type AS "cakeType", serving_count AS "servingCount", flavor,
                 custom_inscription AS "customInscription", theme_color AS "themeColor",
                 pickup_date AS "pickupDate", pickup_time AS "pickupTime",
                 total_price AS "totalPrice", deposit_paid AS "depositPaid",
                 status, store_id AS "storeId", notes`,
      params,
    );
    if (result.length === 0) return res.status(404).json({ error: "Commande introuvable." });
    res.json(result[0]);
  },
);

operationsRouter.delete(
  "/custom-orders/:id",
  async (req, res) => {
    const result = await query(`DELETE FROM custom_orders WHERE id=$1 RETURNING id`, [req.params.id]);
    if (result.length === 0) return res.status(404).json({ error: "Commande introuvable." });
    res.json({ deleted: true });
  },
);

operationsRouter.delete(
  "/losses/:id",
  async (req, res) => {
    const result = await query(`DELETE FROM losses WHERE id=$1 RETURNING id`, [req.params.id]);
    if (result.length === 0) return res.status(404).json({ error: "Péda introuvable." });
    res.json({ deleted: true });
  },
);


operationsRouter.patch(
  "/purchase-orders/:id/status",
  async (req, res) => {
    const { status } = req.body as { status: string };
    const order = await updatePurchaseOrderStatus(req.params.id, status);
    if (!order) return res.status(404).json({ error: "Bon introuvable." });
    res.json(order);
  },
);

operationsRouter.patch(
  "/production-orders/:id/status",
  async (req, res) => {
    const { status } = req.body as { status: string };
    const order = await updateProductionOrder(req.params.id, { status });
    if (!order) return res.status(404).json({ error: "Ordre introuvable." });
    res.json(order);
  },
);

operationsRouter.put(
  "/sales/:id",
  async (req, res) => {
    const s = req.body as {
      discountAmount?: number; vatAmount?: number; total?: number;
      paymentMethod?: string; amountPaid?: number;
      changeReturned?: number; status?: string;
    };
    const result = await query(
      `UPDATE sales SET
         discount_amount = COALESCE($2, discount_amount),
         vat_amount = COALESCE($3, vat_amount),
         total = COALESCE($4, total),
         payment_method = COALESCE($5, payment_method),
         amount_paid = COALESCE($6, amount_paid),
         change_returned = COALESCE($7, change_returned),
         status = COALESCE($8, status)
       WHERE id = $1 RETURNING id, receipt_number AS "receiptNumber", date, subtotal, discount_amount AS "discountAmount",
                 vat_amount AS "vatAmount", total, payment_method AS "paymentMethod",
                 amount_paid AS "amountPaid", change_returned AS "changeReturned",
                 customer_id AS "customerId", customer_name AS "customerName",
                 cashier_name AS "cashierName", store_id AS "storeId", status, notes`,
      [req.params.id,
       s.discountAmount, s.vatAmount, s.total, s.paymentMethod, s.amountPaid, s.changeReturned, s.status],
    );
    if (result.length === 0) return res.status(404).json({ error: "Vente introuvable." });
    res.json(result[0]);
  },
);

operationsRouter.delete(
  "/sales/:id",
  async (req, res) => {
    await query(`DELETE FROM sale_items WHERE sale_id=$1`, [req.params.id]);
    const result = await query(`DELETE FROM sales WHERE id=$1 RETURNING id`, [req.params.id]);
    if (result.length === 0) return res.status(404).json({ error: "Vente introuvable." });
    res.json({ deleted: true });
  },
);
