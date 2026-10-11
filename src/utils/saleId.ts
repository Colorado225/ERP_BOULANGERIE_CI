/**
 * Identifiant de vente généré côté client (idempotence côté serveur).
 * `crypto.randomUUID` n'existe pas dans tous les contextes (HTTP hors
 * localhost) : repli sur un identifiant aléatoire de format équivalent.
 */
export const newSaleId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const random = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0'),
  ).join('');
  return `sale-${Date.now().toString(36)}-${random}`;
};
