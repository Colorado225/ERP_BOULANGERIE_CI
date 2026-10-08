/**
 * File d'attente de synchronisation pour le mode hors-ligne (Phase 2.2 - PLAN_ACTION.md)
 * Stocke les opérations effectuées sans réseau et les rejoue automatiquement
 * lorsque la connexion est rétablie.
 */

import { apiFetch } from "./api";

// Type d'une opération en attente de synchronisation
export interface PendingOperation {
  id: string;
  timestamp: number;
  path: string;
  options: RequestInit;
  retries: number;
  type: "sale" | "production" | "purchase" | "adjustment" | "other";
}

const SYNC_QUEUE_KEY = "boulangerie_pro_sync_queue";
const MAX_RETRIES = 5;
const RETRY_DELAY = 30000; // 30 secondes entre les tentatives

// Récupère la file d'attente depuis localStorage
const getQueue = (): PendingOperation[] => {
  try {
    const stored = localStorage.getItem(SYNC_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Sauvegarde la file d'attente dans localStorage
const saveQueue = (queue: PendingOperation[]): void => {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
};

// Génère un ID unique pour une nouvelle opération
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Ajoute une opération à la file d'attente de synchronisation
 * à appeler lorsque l'API est injoignable (hors-ligne)
 */
export const enqueueOperation = (
  path: string,
  options: RequestInit,
  type: PendingOperation["type"] = "other",
): string => {
  const queue = getQueue();
  const operation: PendingOperation = {
    id: generateId(),
    timestamp: Date.now(),
    path,
    options,
    retries: 0,
    type,
  };

  queue.push(operation);
  saveQueue(queue);

  console.log(`[SyncQueue] Opération ajoutée : ${operation.id} (${type})`);
  return operation.id;
};

/**
 * Retire une opération de la file d'attente (après succès)
 */
export const removeOperation = (id: string): void => {
  const queue = getQueue().filter((op) => op.id !== id);
  saveQueue(queue);
  console.log(`[SyncQueue] Opération terminée : ${id}`);
};

/**
 * Réessaie une opération qui a échoué (incrémente le compteur)
 */
export const retryOperation = (id: string): boolean => {
  const queue = getQueue();
  const opIndex = queue.findIndex((op) => op.id === id);

  if (opIndex === -1) return false;

  const op = queue[opIndex];
  if (op.retries >= MAX_RETRIES) {
    // Trop de tentatives : on retire l'opération
    removeOperation(id);
    console.error(
      `[SyncQueue] Opération abandonnée après ${MAX_RETRIES} tentatives : ${id}`,
    );
    return false;
  }

  // On incrémente le compteur et on sauvegarde
  queue[opIndex].retries += 1;
  queue[opIndex].timestamp = Date.now();
  saveQueue(queue);

  console.log(
    `[SyncQueue] Nouvelle tentative pour ${id} (${op.retries}/${MAX_RETRIES})`,
  );
  return true;
};

// Stocke les opérations échouées dans une file de sauvegarde pour éviter toute perte
const saveFailedOperation = (op: PendingOperation): void => {
  try {
    const failedOps = JSON.parse(
      localStorage.getItem("boulangerie_pro_failed_ops") || "[]",
    );
    failedOps.push({
      ...op,
      failedAt: Date.now(),
      error: "Conflit ou échec persistant",
    });
    localStorage.setItem(
      "boulangerie_pro_failed_ops",
      JSON.stringify(failedOps),
    );
    console.error(
      `[SyncQueue] Opération sauvegardée dans les échecs : ${op.id} (jamais perdue)`,
    );
  } catch (e) {
    console.error(
      "[SyncQueue] Impossible de sauvegarder l'opération échouée",
      e,
    );
  }
};

/**
 * Tente de synchroniser toutes les opérations en attente avec résolution de conflits
 * Appelée automatiquement lorsque la connexion est rétablie
 * Garantit qu'aucune donnée n'est perdue grâce à une sauvegarde des échecs
 */
export const syncAll = async (): Promise<{
  success: number;
  failed: number;
  conflicted: number;
}> => {
  const queue = getQueue();
  if (queue.length === 0) {
    return { success: 0, failed: 0, conflicted: 0 };
  }

  console.log(
    `[SyncQueue] Tentative de synchronisation de ${queue.length} opération(s)`,
  );

  let success = 0;
  let failed = 0;
  let conflicted = 0;

  // On trie les opérations par date (toujours FIFO pour préserver l'ordre des ventes)
  const sortedOps = [...queue].sort((a, b) => a.timestamp - b.timestamp);

  for (const op of sortedOps) {
    try {
      await apiFetch(op.path, op.options);
      removeOperation(op.id);
      success++;
      console.log(`[SyncQueue] Opération réussie : ${op.id}`);
    } catch (error: any) {
      // Gestion spécifique des conflits (409 Conflict)
      if (error.status === 409) {
        conflicted++;
        console.warn(
          `[SyncQueue] Conflit détecté pour l'opération ${op.id}, tentative de fusion...`,
        );

        // Stratégie de résolution :
        // 1. Pour les ventes : on tente d'ajouter la vente locale avec un nouvel ID
        if (op.type === "sale") {
          try {
            // On parse le corps de la requête pour modifier l'ID
            const body = JSON.parse(op.options.body as string);
            // On génère un nouvel ID unique pour éviter le conflit
            body.id = `${body.id || "sale"}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            // On réessaie avec le nouvel ID
            await apiFetch(op.path, {
              ...op.options,
              body: JSON.stringify(body),
            });
            removeOperation(op.id);
            success++;
            console.log(
              `[SyncQueue] Conflit résolu pour la vente ${op.id} -> nouvel ID : ${body.id}`,
            );
            continue;
          } catch (mergeError) {
            // Si la fusion échoue, on sauvegarde l'opération originale
            saveFailedOperation(op);
            removeOperation(op.id);
          }
        } else {
          // Pour les autres types d'opérations, on sauvegarde aussi
          saveFailedOperation(op);
          removeOperation(op.id);
        }
      } else if (error.status === 0 || error.status >= 500) {
        // Erreur réseau ou serveur : on réessaie plus tard si on n'a pas dépassé MAX_RETRIES
        const canRetry = retryOperation(op.id);
        if (!canRetry) {
          // Si plus de tentatives possibles, on sauvegarde pour éviter la perte
          saveFailedOperation(op);
          removeOperation(op.id);
        }
        failed++;
      } else {
        // Erreur client (4xx autre que 409) : sauvegarde et suppression de la file
        saveFailedOperation(op);
        removeOperation(op.id);
        failed++;
      }
    }
  }

  console.log(
    `[SyncQueue] Synchronisation terminée : ${success} succès, ${failed} échecs, ${conflicted} conflits résolus`,
  );
  return { success, failed, conflicted };
};

/**
 * Vérifie s'il y a des opérations en attente de synchronisation
 */
export const hasPendingOperations = (): boolean => {
  return getQueue().length > 0;
};

/**
 * Récupère toutes les opérations en attente
 */
export const getPendingOperations = (): PendingOperation[] => {
  return getQueue();
};

/**
 * Compte le nombre d'opérations en attente
 */
export const getPendingCount = (): number => {
  return getQueue().length;
};

/**
 * Récupère toutes les opérations échouées (pour consultation/réémission manuelle)
 */
export const getFailedOperations = (): Array<
  PendingOperation & { failedAt: number; error: string }
> => {
  try {
    return JSON.parse(
      localStorage.getItem("boulangerie_pro_failed_ops") || "[]",
    );
  } catch {
    return [];
  }
};

/**
 * Réessaie manuellement une opération échouée
 */
export const retryFailedOperation = async (id: string): Promise<boolean> => {
  const failedOps = getFailedOperations();
  const opIndex = failedOps.findIndex((op) => op.id === id);

  if (opIndex === -1) return false;

  const op = failedOps[opIndex];
  try {
    await apiFetch(op.path, op.options);
    // Retire l'opération des échecs si ça réussit
    failedOps.splice(opIndex, 1);
    localStorage.setItem(
      "boulangerie_pro_failed_ops",
      JSON.stringify(failedOps),
    );
    console.log(
      `[SyncQueue] Opération échouée ressuscitée avec succès : ${id}`,
    );
    return true;
  } catch (e) {
    console.error(`[SyncQueue] Échec de la réémission de ${id}`, e);
    return false;
  }
};

// Écouteur d'événement de connexion : synchronise automatiquement
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[SyncQueue] Connexion rétablie, synchronisation...");
    syncAll();
  });

  // Vérifie si on se connecte après un démarrage hors-ligne
  if (navigator.onLine) {
    // Petit délai pour laisser l'app se stabiliser
    setTimeout(syncAll, 2000);
  }
}
