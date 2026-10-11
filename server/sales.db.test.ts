/**
 * Tests d'intégration des ventes (lot 2) sur PostgreSQL réel.
 * Couvre : prix serveur, idempotence, numérotation sans trou, rollback,
 * isolation par boutique, règles de paiement, contraintes SQL.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createSale, type SalesDb } from "./services/salesService";
import { SaleRuleError } from "./services/saleCalculation";
import { startTestDb, seedSalesFixtures, type TestDb } from "./testing/pgHarness";

const ctx = { storeId: "store-1", cashierName: "Awa Koné" };
const PAIN_PLUS_PAT = [
  { productId: "prod-pain", quantity: 1 },
  { productId: "prod-pat", quantity: 1 },
];

let db: TestDb;

before(async () => {
  db = await startTestDb();
  await seedSalesFixtures(db);
}, { timeout: 180_000 });

after(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.query(`TRUNCATE sale_items, sales, receipt_sequences`);
  await db.query(`UPDATE products SET stock = 1000`);
});

const stockOf = async (id: string) =>
  Number((await db.queryOne<{ stock: string }>(`SELECT stock FROM products WHERE id=$1`, [id]))!.stock);
const countSales = async () =>
  Number((await db.queryOne<{ n: string }>(`SELECT count(*) AS n FROM sales`))!.n);

describe("createSale — montants serveur (2.1, 2.2)", () => {
  it("facture au prix et à la TVA de la base, et calcule le total", async () => {
    const { sale, created } = await createSale(
      { items: PAIN_PLUS_PAT, paymentMethod: "wave" },
      ctx,
      db,
    );
    assert.equal(created, true);
    assert.equal(sale.total, 1500);
    assert.equal(sale.vatAmount, 183);
    assert.equal(sale.items.find((i) => i.productId === "prod-pat")!.unitPrice, 1200);
    assert.equal(sale.cashierName, "Awa Koné");
    assert.equal(sale.storeId, "store-1");
  });

  it("applique la remise et la monnaie rendue en espèces", async () => {
    const { sale } = await createSale(
      { items: PAIN_PLUS_PAT, paymentMethod: "especes", amountPaid: 2000, discountPercent: 10 },
      ctx,
      db,
    );
    assert.equal(sale.discountAmount, 150);
    assert.equal(sale.total, 1350);
    assert.equal(sale.amountPaid, 2000);
    assert.equal(sale.changeReturned, 650);
  });

  it("décrémente le stock de la quantité vendue, dans la même transaction", async () => {
    await createSale({ items: [{ productId: "prod-pat", quantity: 3 }], paymentMethod: "carte" }, ctx, db);
    assert.equal(await stockOf("prod-pat"), 997);
  });

  it("refuse un montant reçu insuffisant et n'écrit rien", async () => {
    await assert.rejects(
      createSale({ items: PAIN_PLUS_PAT, paymentMethod: "especes", amountPaid: 100 }, ctx, db),
      SaleRuleError,
    );
    assert.equal(await countSales(), 0);
    assert.equal(await stockOf("prod-pain"), 1000);
  });
});

describe("createSale — idempotence (2.3)", () => {
  it("rejouer la même vente renvoie l'existante, sans second décompte", async () => {
    const first = await createSale({ id: "sale-abc12345", items: PAIN_PLUS_PAT, paymentMethod: "wave" }, ctx, db);
    const replay = await createSale({ id: "sale-abc12345", items: PAIN_PLUS_PAT, paymentMethod: "wave" }, ctx, db);

    assert.equal(first.created, true);
    assert.equal(replay.created, false);
    assert.equal(replay.sale.receiptNumber, first.sale.receiptNumber);
    assert.equal(await countSales(), 1);
    assert.equal(await stockOf("prod-pain"), 999);
  });

  it("des envois simultanés du même id ne produisent qu'une vente", async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        createSale({ id: "sale-race0001", items: PAIN_PLUS_PAT, paymentMethod: "wave" }, ctx, db),
      ),
    );
    assert.equal(results.filter((r) => r.created).length, 1);
    assert.equal(await countSales(), 1);
    assert.equal(await stockOf("prod-pain"), 999);
    // Un seul numéro consommé : pas de trou laissé par les perdants.
    const seq = await db.queryOne<{ last_number: string }>(
      `SELECT last_number FROM receipt_sequences WHERE store_id='store-1'`,
    );
    assert.equal(Number(seq!.last_number), 1);
  });

  it("refuse de rejouer un id appartenant à une autre boutique (409)", async () => {
    await createSale({ id: "sale-store1x", items: PAIN_PLUS_PAT, paymentMethod: "wave" }, ctx, db);
    await assert.rejects(
      createSale(
        { id: "sale-store1x", items: [{ productId: "prod-pain", quantity: 1 }], paymentMethod: "wave" },
        { storeId: "store-2", cashierName: "Autre" },
        db,
      ),
      (err: unknown) => err instanceof SaleRuleError && err.status === 409,
    );
  });
});

describe("createSale — numérotation continue (2.4, D4)", () => {
  it("100 ventes simultanées d'une boutique → numéros 1 à 100, sans trou ni doublon", async () => {
    await Promise.all(
      Array.from({ length: 100 }, () =>
        createSale({ items: [{ productId: "prod-pain", quantity: 1 }], paymentMethod: "carte" }, ctx, db),
      ),
    );
    const rows = await db.query<{ receipt_number: string }>(
      `SELECT receipt_number FROM sales ORDER BY receipt_number`,
    );
    const numbers = rows.map((r) => Number(r.receipt_number.split("-").pop()));
    assert.equal(numbers.length, 100);
    assert.deepEqual(numbers, Array.from({ length: 100 }, (_, i) => i + 1));
  });

  it("chaque boutique a sa propre séquence", async () => {
    await createSale({ items: [{ productId: "prod-pain", quantity: 1 }], paymentMethod: "carte" }, ctx, db);
    const other = await createSale(
      { items: [{ productId: "prod-b2", quantity: 1 }], paymentMethod: "carte" },
      { storeId: "store-2", cashierName: "Autre" },
      db,
    );
    assert.equal(other.sale.receiptNumber, "CI-store-2-000001");
  });
});

describe("createSale — atomicité (2.7)", () => {
  it("une erreur au milieu de la vente n'écrit rien et ne consomme pas de numéro", async () => {
    const failing: SalesDb = {
      ...db,
      transaction: (fn) =>
        db.transaction((tx) =>
          fn({
            query: async (text, params) => {
              if (text.includes("INSERT INTO sale_items")) throw new Error("panne injectée");
              return tx.query(text, params);
            },
            queryOne: tx.queryOne,
          }),
        ),
    };
    await assert.rejects(createSale({ items: PAIN_PLUS_PAT, paymentMethod: "wave" }, ctx, failing), /panne injectée/);

    assert.equal(await countSales(), 0);
    assert.equal(await stockOf("prod-pain"), 1000);
    assert.equal(await stockOf("prod-pat"), 1000);

    const next = await createSale({ items: PAIN_PLUS_PAT, paymentMethod: "wave" }, ctx, db);
    assert.equal(next.sale.receiptNumber, "CI-store-1-000001");
  });
});

describe("createSale — règles d'accès et de paiement", () => {
  it("refuse un produit d'une autre boutique", async () => {
    await assert.rejects(
      createSale({ items: [{ productId: "prod-b2", quantity: 1 }], paymentMethod: "carte" }, ctx, db),
      /Produit introuvable/,
    );
  });

  it("refuse un produit inactif", async () => {
    await assert.rejects(
      createSale({ items: [{ productId: "prod-off", quantity: 1 }], paymentMethod: "carte" }, ctx, db),
      /inactif/,
    );
  });

  it("refuse un produit inconnu", async () => {
    await assert.rejects(
      createSale({ items: [{ productId: "prod-xxx", quantity: 1 }], paymentMethod: "carte" }, ctx, db),
      /introuvable/,
    );
  });

  it("crédit B2B : client obligatoire, statut en attente, rien d'encaissé", async () => {
    await assert.rejects(
      createSale({ items: PAIN_PLUS_PAT, paymentMethod: "credit_b2b" }, ctx, db),
      /Un client est requis/,
    );
    const { sale } = await createSale(
      { items: PAIN_PLUS_PAT, paymentMethod: "credit_b2b", customerId: "cust-1" },
      ctx,
      db,
    );
    assert.equal(sale.amountPaid, 0);
    assert.equal(sale.customerName, "Hôtel Test");
    const row = await db.queryOne<{ status: string }>(`SELECT status FROM sales WHERE id=$1`, [sale.id]);
    assert.equal(row!.status, "en_attente");
  });
});

describe("contraintes SQL (2.6)", () => {
  it("refuse une ligne de vente de quantité nulle ou négative", async () => {
    const { sale } = await createSale({ items: PAIN_PLUS_PAT, paymentMethod: "wave" }, ctx, db);
    await assert.rejects(
      db.query(
        `INSERT INTO sale_items (sale_id, product_id, name, unit_price, quantity, total)
         VALUES ($1,'prod-pain','Pain',300,0,0)`,
        [sale.id],
      ),
      /sale_items_quantity_positive/,
    );
  });

  it("refuse un total de vente négatif", async () => {
    await assert.rejects(
      db.query(
        `INSERT INTO sales (id, receipt_number, payment_method, total, store_id, cashier_name)
         VALUES ('sale-neg00001','CI-neg-1','wave',-5,'store-1','X')`,
      ),
      /sales_total_nonneg/,
    );
  });

  it("refuse un stock de matière négatif", async () => {
    await db.query(
      `INSERT INTO raw_materials (id, code, name, category, unit, current_stock)
       VALUES ('mat-test','FAR','Farine','matiere','kg',10) ON CONFLICT (id) DO NOTHING`,
    );
    await assert.rejects(
      db.query(`UPDATE raw_materials SET current_stock = -1 WHERE id='mat-test'`),
      /raw_materials_stock_nonneg/,
    );
  });

  it("la migration est rejouable sans erreur", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    await db.pool.query(readFileSync(join(import.meta.dirname, "schema.sql"), "utf-8"));
  });
});
