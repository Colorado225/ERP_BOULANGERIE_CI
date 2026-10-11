/**
 * Calcul pur d'une vente (lot 2) : aucune entrée client n'est crue pour les
 * prix, la TVA ou les totaux. Les lignes arrivent déjà valorisées depuis la
 * base (`products.price`, `products.vat_rate`).
 *
 * Règles :
 * - prix TTC ; TVA extraite par ligne via `computeVatBreakdown` (partagé avec
 *   le front, `src/utils/fiscalite.ts`) ;
 * - remise en pourcentage, bornée à [0, 100] ; montant arrondi au FCFA ;
 * - paiement en espèces : montant reçu ≥ total, monnaie rendue = reçu − total ;
 * - paiement électronique : le montant encaissé est le total ;
 * - crédit B2B : rien n'est encaissé à la vente (montant payé 0).
 */
import { computeVatBreakdown } from "../../src/utils/fiscalite";

export const PAYMENT_METHODS = [
  "especes",
  "wave",
  "orange_money",
  "mtn_money",
  "carte",
  "credit_b2b",
] as const;

export type SalePaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Erreur métier explicite, renvoyée au client avec son statut HTTP. */
export class SaleRuleError extends Error {
  readonly status: 400 | 409;
  constructor(message: string, status: 400 | 409 = 400) {
    super(message);
    this.name = "SaleRuleError";
    this.status = status;
  }
}

export interface PricedLine {
  /** Prix unitaire TTC lu en base. */
  unitPrice: number;
  quantity: number;
  /** Taux de TVA du produit lu en base (pourcentage). */
  vatRate: number;
}

export interface SaleTotalsInput {
  lines: PricedLine[];
  paymentMethod: SalePaymentMethod;
  /** Remise en pourcentage (0 à 100). Absente = 0. */
  discountPercent?: number;
  /** Montant reçu du client. Obligatoire pour les espèces. */
  amountPaid?: number;
}

export interface SaleTotals {
  subtotal: number;
  discountAmount: number;
  total: number;
  vatAmount: number;
  subtotalHT: number;
  amountPaid: number;
  changeReturned: number;
}

export const computeSaleTotals = (input: SaleTotalsInput): SaleTotals => {
  if (input.lines.length === 0) {
    throw new SaleRuleError("Le panier est vide.");
  }

  for (const line of input.lines) {
    if (!Number.isFinite(line.unitPrice) || line.unitPrice <= 0) {
      throw new SaleRuleError("Prix produit invalide en base.");
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new SaleRuleError("Quantité invalide.");
    }
  }

  const discountPercent = input.discountPercent ?? 0;
  if (
    !Number.isFinite(discountPercent) ||
    discountPercent < 0 ||
    discountPercent > 100
  ) {
    throw new SaleRuleError("La remise doit être comprise entre 0 et 100 %.");
  }

  const subtotal = input.lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  // Avec une remise bornée à 100 %, 0 <= discountAmount <= subtotal.
  const total = subtotal - discountAmount;

  // Répartition de la remise au prorata des lignes, pour la TVA par taux.
  const discountRatio = subtotal > 0 ? total / subtotal : 1;
  const breakdown = computeVatBreakdown(
    input.lines.map((line) => ({
      amount: line.unitPrice * line.quantity * discountRatio,
      vatRate: line.vatRate,
    })),
  );
  const vatAmount = breakdown.vatAmount;

  let amountPaid: number;
  let changeReturned: number;
  switch (input.paymentMethod) {
    case "especes": {
      const received = input.amountPaid;
      if (received === undefined || !Number.isFinite(received)) {
        throw new SaleRuleError("Montant reçu requis pour un paiement en espèces.");
      }
      if (received < total) {
        throw new SaleRuleError("Montant reçu inférieur au total de la vente.");
      }
      amountPaid = received;
      changeReturned = received - total;
      break;
    }
    case "credit_b2b":
      amountPaid = 0;
      changeReturned = 0;
      break;
    default:
      amountPaid = total;
      changeReturned = 0;
  }

  return {
    subtotal,
    discountAmount,
    total,
    vatAmount,
    subtotalHT: total - vatAmount,
    amountPaid,
    changeReturned,
  };
};

/**
 * Numéro de ticket (décision D4 à confirmer). Format provisoire :
 * `CI-<boutique>-<NNNNNN>`, séquence continue par boutique, jamais
 * réinitialisée. Le compteur vient de la table `receipt_sequences`.
 */
export const formatReceiptNumber = (storeId: string, sequence: number): string =>
  `CI-${storeId}-${String(sequence).padStart(6, "0")}`;
