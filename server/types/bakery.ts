/**
 * Types partagés côté serveur.
 *
 * Ré-exporte les types métier du frontend (src/types/bakery) et complète
 * avec les types d'entrée (Input) et lignes SQL uniquement utilisés par
 * l'API. Point d'unique d'import : "../types/bakery".
 */

export * from "../../src/types/bakery";

/** Utilisateur de la table users (colonnes brutes, non aliasées). */
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  store_id: string | null;
  is_active: boolean;
  created_at?: string;
}

/** Données de création d'une fiche recette (avec ses ingrédients). */
export interface RecipeInput {
  id?: string;
  name: string;
  productId?: string;
  productName?: string;
  outputYield?: number;
  outputUnit?: string;
  preparationTimeMin?: number;
  proofingTimeMin?: number;
  bakingTimeMin?: number;
  bakingTempC?: number;
  instructions?: string[];
  totalCost?: number;
  costPerUnit?: number;
  ingredients?: {
    id?: string;
    materialId: string;
    materialName: string;
    quantity: number;
    unit: string;
    cost: number;
  }[];
}

/** Ligne d'un bon de commande fournisseur. */
export interface PurchaseOrderItem {
  id?: string;
  orderId?: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total?: number;
}

/** Données de création d'un ordre de fabrication. */
export interface ProductionOrderInput {
  recipeId: string;
  recipeName?: string;
  productId?: string;
  productName?: string;
  batchMultiplier?: number;
  targetQuantity?: number;
  scheduledTime?: string;
  completedTime?: string;
  bakerName?: string;
  shift?: string;
  storeId: string;
  notes?: string;
}
