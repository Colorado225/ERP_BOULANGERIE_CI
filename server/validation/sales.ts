/**
 * Schéma de la requête d'enregistrement d'une vente (décision D2 : zod).
 *
 * Seules les intentions du client sont acceptées : produits, quantités,
 * mode de paiement, montant reçu, remise. Les champs de montant calculés
 * (prix unitaire, TVA, total, monnaie) ne figurent pas dans le schéma et
 * sont donc ignorés : le serveur les recalcule depuis la base.
 */
import { z } from "zod";
import { PAYMENT_METHODS } from "../services/saleCalculation";

export const saleRequestSchema = z.object({
  /** Identifiant de vente généré côté client (idempotence). */
  id: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,64}$/, "Identifiant de vente invalide.")
    .optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        quantity: z.number().positive().max(100000),
      }),
    )
    .min(1, "Le panier est vide.")
    .max(200),
  paymentMethod: z.enum(PAYMENT_METHODS),
  amountPaid: z.number().finite().nonnegative().max(1e12).optional(),
  discountPercent: z.number().finite().min(0).max(100).optional(),
  customerId: z.string().min(1).max(64).optional(),
  storeId: z.string().min(1).max(64).optional(),
  notes: z.string().max(500).optional(),
});

export type SaleRequest = z.infer<typeof saleRequestSchema>;
