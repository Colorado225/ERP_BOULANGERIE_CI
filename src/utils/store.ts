/**
 * Utilitaires de résolution du point de vente courant.
 *
 * Règle métier : `currentStoreId` peut valoir l'identifiant d'une boutique
 * précise, ou le mode consolidé « Groupe ». Dans ce dernier cas, toute
 * écriture métier doit être rattachée à une boutique réelle (la boutique
 * principale), car on ne peut pas écrire « dans le groupe ».
 */

/** Identifiant du mode consolidé « toutes les boutiques ». */
export const ALL_STORES_MODE = "all";

/**
 * Boutique de repli lorsqu'on écrit une entité alors que le mode
 * consolidé « Groupe » est actif. Doit correspondre à la boutique
 * marquée `isMain` dans les données.
 */
export const DEFAULT_WRITE_STORE_ID = "store-1";

/**
 * Résout l'identifiant de boutique à utiliser pour une écriture.
 *
 * @param currentStoreId - valeur courante du sélecteur de boutique
 * @returns un identifiant de boutique réel (jamais le mode « Groupe »)
 */
export const resolveWriteStoreId = (currentStoreId: string): string => {
  if (!currentStoreId || currentStoreId === ALL_STORES_MODE) {
    return DEFAULT_WRITE_STORE_ID;
  }
  return currentStoreId;
};
