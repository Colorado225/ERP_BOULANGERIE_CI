/**
 * Service de gestion des lots et traçabilité DLC (Phase 2.4)
 * MEILLEURES PRATIQUES :
 * - Vérification automatique des dates d'expiration
 * - Blocage des lots périmés avant utilisation
 * - Alertes en temps réel pour les lots bientôt expirés
 * - Traçabilité complète de chaque produit
 */

import { Product, ProductBatch, RawMaterial } from "../types/bakery";

// Types d'alertes de lot
export enum BatchAlertLevel {
  SAFE = "SAFE",
  WARNING = "WARNING", // Expire dans moins de 7 jours
  CRITICAL = "CRITICAL", // Expire dans moins de 2 jours
  EXPIRED = "EXPIRED", // Déjà expiré
}

export interface BatchAlert {
  batchId: string;
  productId: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  level: BatchAlertLevel;
  isBlocked: boolean;
}

// Classe de gestion des lots
export class BatchManager {
  private static instance: BatchManager;
  private alertThresholdDays = 7; // Alerte si < 7 jours avant expiration
  private criticalThresholdDays = 2; // Critique si < 2 jours

  private constructor() {}

  // Singleton pour état global
  public static getInstance(): BatchManager {
    if (!BatchManager.instance) {
      BatchManager.instance = new BatchManager();
    }
    return BatchManager.instance;
  }

  /**
   * Créer un nouveau lot pour un produit fini
   */
  createProductBatch(
    productId: string,
    productName: string,
    batchNumber: string,
    productionDate: string,
    expiryDate: string,
    quantity: number,
    location?: string,
  ): ProductBatch {
    // Vérifie que la date d'expiration est après la production
    const prodDate = new Date(productionDate);
    const expDate = new Date(expiryDate);
    if (expDate <= prodDate) {
      throw new Error("La DLC doit être postérieure à la date de production");
    }

    // Vérifie si le lot est déjà expiré à la création
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isExpired = expDate < today;

    const newBatch: ProductBatch = {
      id: crypto.randomUUID(),
      productId,
      batchNumber,
      productionDate,
      expiryDate,
      quantity,
      location,
      isBlocked: isExpired, // Bloque automatiquement si déjà expiré
      createdAt: new Date().toISOString(),
    };

    return newBatch;
  }

  /**
   * Vérifier l'état d'un lot (jours avant expiration, niveau d'alerte)
   */
  checkBatchStatus(batch: ProductBatch): {
    daysUntilExpiry: number;
    level: BatchAlertLevel;
  } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(batch.expiryDate);
    expiryDate.setHours(0, 0, 0, 0);

    const diffTime = expiryDate.getTime() - today.getTime();
    const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let level: BatchAlertLevel;
    if (daysUntilExpiry <= 0) {
      level = BatchAlertLevel.EXPIRED;
    } else if (daysUntilExpiry <= this.criticalThresholdDays) {
      level = BatchAlertLevel.CRITICAL;
    } else if (daysUntilExpiry <= this.alertThresholdDays) {
      level = BatchAlertLevel.WARNING;
    } else {
      level = BatchAlertLevel.SAFE;
    }

    return { daysUntilExpiry, level };
  }

  /**
   * Mettre à jour automatiquement le statut "isBlocked" pour tous les lots
   * Appelé au démarrage de l'app et quotidiennement
   */
  updateAllBatchesStatus(products: Product[]): BatchAlert[] {
    const allAlerts: BatchAlert[] = [];

    products.forEach((product) => {
      product.batches.forEach((batch) => {
        const { daysUntilExpiry, level } = this.checkBatchStatus(batch);
        const productName = product.name;

        // Bloque automatiquement les lots expirés
        if (level === BatchAlertLevel.EXPIRED && !batch.isBlocked) {
          batch.isBlocked = true;
          console.warn(
            `Lot ${batch.batchNumber} de ${productName} bloqué (expiré)`,
          );
        }

        // Ajoute à la liste des alertes si pas SAFE
        if (level !== BatchAlertLevel.SAFE) {
          allAlerts.push({
            batchId: batch.id,
            productId: product.id,
            productName,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            daysUntilExpiry,
            level,
            isBlocked: batch.isBlocked,
          });
        }
      });
    });

    return allAlerts;
  }

  /**
   * Vérifier si on peut utiliser un lot pour une vente/production
   * Retourne true si le lot est disponible, false sinon
   */
  canUseBatch(batch: ProductBatch): boolean {
    if (batch.isBlocked) return false;

    const { level } = this.checkBatchStatus(batch);
    return level !== BatchAlertLevel.EXPIRED;
  }

  /**
   * Déduire une quantité d'un lot (lors d'une vente)
   * Vérifie avant que le lot n'est pas bloqué
   */
  deductQuantityFromBatch(batch: ProductBatch, quantity: number): boolean {
    if (!this.canUseBatch(batch)) {
      throw new Error(
        `Impossible d'utiliser le lot ${batch.batchNumber} : bloqué ou expiré`,
      );
    }
    if (batch.quantity < quantity) {
      throw new Error(`Stock insuffisant dans le lot ${batch.batchNumber}`);
    }

    batch.quantity -= quantity;
    return true;
  }

  /**
   * Récupérer tous les lots d'une matière première expirés
   */
  getExpiredRawMaterials(materials: RawMaterial[]): RawMaterial[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return materials.filter((mat) => {
      if (!mat.expiryDate) return false;
      const expDate = new Date(mat.expiryDate);
      expDate.setHours(0, 0, 0, 0);
      return expDate < today;
    });
  }
}

// Export de l'instance singleton
export const batchManager = BatchManager.getInstance();
