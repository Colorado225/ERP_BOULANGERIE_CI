/**
 * Module de fiscalité — Côte d'Ivoire (DGI).
 *
 * Règles appliquées :
 * - TVA au taux normal de **18 %** (produits transformés, pâtisseries, boissons…).
 * - **Exonération** sur les produits de première nécessité : le pain et les
 *   farines panifiables sont exonérés (taux 0 %).
 * - La TVA est portée par le `vatRate` de chaque produit (source de vérité),
 *   jamais par une constante globale codée en dur.
 *
 * Le barème ci-dessous est utilisé uniquement comme valeur par défaut
 * lorsqu'un produit ne porte pas de taux explicite ou lors de la création.
 */

/** Taux de TVA appliqués en Côte d'Ivoire (en pourcentage). */
export const VAT_RATES = {
  /** Taux normal DGI. */
  STANDARD: 18,
  /** Produits exonérés (pain, farine panifiable, produits non transformés). */
  EXEMPT: 0,
} as const;

/**
 * Catégories de produits exonérées de TVA par nature (denrées de base).
 * Les autres catégories relèvent du taux normal.
 */
const VAT_EXEMPT_CATEGORIES = new Set(["pains"]);

/**
 * Détermine le taux de TVA par défaut pour une catégorie de produit.
 * Sert à pré-remplir le formulaire de création, PAS à facturer
 * (le taux facturé reste celui porté par le produit).
 */
export const defaultVatRateForCategory = (category: string): number =>
  VAT_EXEMPT_CATEGORIES.has(category) ? VAT_RATES.EXEMPT : VAT_RATES.STANDARD;

/** Ligne d'un ticket, vue du calcul fiscal. */
export interface VatLineInput {
  /** Montant de la ligne, remise déduite (TTC). */
  amount: number;
  /** Taux de TVA applicable au produit (en pourcentage). */
  vatRate: number;
}

/** Ventilation de TVA d'un ticket. */
export interface VatBreakdown {
  /** Base hors taxe totale. */
  subtotalHT: number;
  /** Montant total de TVA. */
  vatAmount: number;
  /** Montant total TTC (égal à la somme des lignes remisées). */
  totalTTC: number;
}

/**
 * Calcule la ventilation TVA d'un ticket à partir de ses lignes.
 *
 * Les prix affichés en caisse sont considérés **TTC** (usage commercial
 * courant en Côte d'Ivoire) : on extrait la TVA contenue dans le TTC
 * plutôt que de l'ajouter par-dessus.
 */
export const computeVatBreakdown = (lines: VatLineInput[]): VatBreakdown => {
  let totalTTC = 0;
  let vatAmount = 0;

  for (const line of lines) {
    const amount = Number.isFinite(line.amount) ? line.amount : 0;
    const rate = Number.isFinite(line.vatRate) ? line.vatRate : 0;
    totalTTC += amount;
    // TVA contenue dans le TTC : montant × taux / (100 + taux)
    if (rate > 0) {
      vatAmount += (amount * rate) / (100 + rate);
    }
  }

  const roundedVat = Math.round(vatAmount);
  return {
    subtotalHT: Math.round(totalTTC - roundedVat),
    vatAmount: roundedVat,
    totalTTC: Math.round(totalTTC),
  };
};
