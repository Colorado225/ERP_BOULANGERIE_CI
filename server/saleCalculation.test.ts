/**
 * Tests unitaires du calcul de vente (lot 2.1, 2.2). Aucune base requise.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeSaleTotals,
  formatReceiptNumber,
  SaleRuleError,
} from "./services/saleCalculation";
import { computeVatBreakdown } from "../src/utils/fiscalite";
import { saleRequestSchema } from "./validation/sales";

const pain = { unitPrice: 300, quantity: 1, vatRate: 0 };
const patisserie = { unitPrice: 1200, quantity: 1, vatRate: 18 };

describe("computeSaleTotals — TVA (plan 2.2)", () => {
  it("pain 0 % + pâtisserie 18 % → TVA 183, HT 1 317, TTC 1 500", () => {
    const t = computeSaleTotals({
      lines: [pain, patisserie],
      paymentMethod: "wave",
    });
    assert.equal(t.total, 1500);
    assert.equal(t.vatAmount, 183);
    assert.equal(t.subtotalHT, 1317);
  });

  it("une remise est répartie au prorata : la TVA suit le TTC remisé", () => {
    // 1 500 TTC, remise 10 % → 1 350 TTC. TVA sur 1 200 × 0,9 = 1 080 à 18 %.
    const t = computeSaleTotals({
      lines: [pain, patisserie],
      paymentMethod: "carte",
      discountPercent: 10,
    });
    assert.equal(t.discountAmount, 150);
    assert.equal(t.total, 1350);
    assert.equal(t.vatAmount, Math.round((1080 * 18) / 118));
  });

  it("le calcul serveur coïncide avec computeVatBreakdown du front", () => {
    const lines = [
      { unitPrice: 450, quantity: 3, vatRate: 18 },
      { unitPrice: 250, quantity: 2, vatRate: 0 },
      { unitPrice: 999, quantity: 1, vatRate: 18 },
    ];
    const t = computeSaleTotals({ lines, paymentMethod: "especes", amountPaid: 5000 });
    const front = computeVatBreakdown(
      lines.map((l) => ({ amount: l.unitPrice * l.quantity, vatRate: l.vatRate })),
    );
    assert.equal(t.vatAmount, front.vatAmount);
    assert.equal(t.total, front.totalTTC);
  });
});

describe("computeSaleTotals — remise (2.1)", () => {
  it("refuse une remise négative ou supérieure à 100 %", () => {
    assert.throws(
      () => computeSaleTotals({ lines: [pain], paymentMethod: "wave", discountPercent: -1 }),
      SaleRuleError,
    );
    assert.throws(
      () => computeSaleTotals({ lines: [pain], paymentMethod: "wave", discountPercent: 100.5 }),
      SaleRuleError,
    );
  });

  it("une remise de 100 % donne un total nul, jamais négatif", () => {
    const t = computeSaleTotals({ lines: [patisserie], paymentMethod: "wave", discountPercent: 100 });
    assert.equal(t.total, 0);
    assert.equal(t.discountAmount, 1200);
    assert.equal(t.vatAmount, 0);
  });
});

describe("computeSaleTotals — paiement (2.1)", () => {
  it("espèces : refuse un montant reçu inférieur au total", () => {
    assert.throws(
      () => computeSaleTotals({ lines: [patisserie], paymentMethod: "especes", amountPaid: 1199 }),
      /inférieur au total/,
    );
  });

  it("espèces : exige un montant reçu", () => {
    assert.throws(
      () => computeSaleTotals({ lines: [patisserie], paymentMethod: "especes" }),
      /Montant reçu requis/,
    );
  });

  it("espèces : rend la monnaie", () => {
    const t = computeSaleTotals({ lines: [patisserie], paymentMethod: "especes", amountPaid: 2000 });
    assert.equal(t.amountPaid, 2000);
    assert.equal(t.changeReturned, 800);
  });

  it("paiement électronique : le montant encaissé est le total", () => {
    const t = computeSaleTotals({ lines: [patisserie], paymentMethod: "wave" });
    assert.equal(t.amountPaid, 1200);
    assert.equal(t.changeReturned, 0);
  });

  it("crédit B2B : rien n'est encaissé à la vente", () => {
    const t = computeSaleTotals({ lines: [patisserie], paymentMethod: "credit_b2b" });
    assert.equal(t.amountPaid, 0);
    assert.equal(t.changeReturned, 0);
  });
});

describe("computeSaleTotals — garde-fous", () => {
  it("refuse un panier vide", () => {
    assert.throws(() => computeSaleTotals({ lines: [], paymentMethod: "wave" }), /panier est vide/);
  });

  it("refuse un prix nul ou négatif lu en base", () => {
    assert.throws(
      () => computeSaleTotals({ lines: [{ ...pain, unitPrice: 0 }], paymentMethod: "wave" }),
      SaleRuleError,
    );
  });
});

describe("formatReceiptNumber", () => {
  it("formate une séquence continue par boutique", () => {
    assert.equal(formatReceiptNumber("store-1", 1), "CI-store-1-000001");
    assert.equal(formatReceiptNumber("store-1", 123456), "CI-store-1-123456");
  });
});

describe("saleRequestSchema (2.1, 2.5)", () => {
  const base = {
    items: [{ productId: "prod-pain", quantity: 2 }],
    paymentMethod: "especes",
    amountPaid: 1000,
  };

  it("ignore les montants envoyés par le client (prix, TVA, total, monnaie)", () => {
    const parsed = saleRequestSchema.parse({
      ...base,
      total: 1,
      vatAmount: 0,
      changeReturned: 999,
      items: [{ productId: "prod-pain", quantity: 2, unitPrice: 1, total: 2 }],
    });
    assert.equal("total" in parsed, false);
    assert.equal("vatAmount" in parsed, false);
    assert.equal("changeReturned" in parsed, false);
    assert.equal("unitPrice" in parsed.items[0], false);
  });

  it("rejette un corps invalide sans lever d'exception", () => {
    assert.equal(saleRequestSchema.safeParse({ ...base, items: [] }).success, false);
    assert.equal(saleRequestSchema.safeParse({ ...base, paymentMethod: "bitcoin" }).success, false);
    assert.equal(saleRequestSchema.safeParse({ ...base, discountPercent: 150 }).success, false);
    assert.equal(saleRequestSchema.safeParse({ ...base, items: [{ productId: "p", quantity: -1 }] }).success, false);
    assert.equal(saleRequestSchema.safeParse({ ...base, id: "x" }).success, false);
  });
});
