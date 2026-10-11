/**
 * Liaison manuelle d'une fiche utilisateur à un compte Neon Auth (`sub`).
 *
 * Règles : ne remplace jamais une liaison existante, refuse un `sub` déjà
 * utilisé par une autre fiche (409), et reste sûre face à une course entre
 * deux requêtes grâce à la contrainte UNIQUE + la clause `IS NULL`.
 */
import type { SqlClient } from "../db";

export type LinkResult =
  | { ok: true }
  | { ok: false; status: 400 | 404 | 409; error: string };

export const linkUserToAuthAccount = async (
  db: SqlClient,
  userId: string,
  authUserIdInput: unknown,
): Promise<LinkResult> => {
  if (
    typeof authUserIdInput !== "string" ||
    authUserIdInput.trim() === "" ||
    authUserIdInput.length > 128
  ) {
    return {
      ok: false,
      status: 400,
      error: "Identifiant Neon Auth (authUserId) requis.",
    };
  }
  const authUserId = authUserIdInput.trim();

  const target = await db.queryOne<{ id: string; auth_user_id: string | null }>(
    `SELECT id, auth_user_id FROM users WHERE id = $1`,
    [userId],
  );
  if (!target) {
    return { ok: false, status: 404, error: "Utilisateur introuvable." };
  }
  if (target.auth_user_id) {
    return {
      ok: false,
      status: 409,
      error: "Cette fiche est déjà liée à un compte.",
    };
  }

  const elsewhere = await db.queryOne(
    `SELECT id FROM users WHERE auth_user_id = $1`,
    [authUserId],
  );
  if (elsewhere) {
    return {
      ok: false,
      status: 409,
      error: "Ce compte Neon Auth est déjà lié à une autre fiche.",
    };
  }

  try {
    const updated = await db.queryOne(
      `UPDATE users SET auth_user_id = $2
        WHERE id = $1 AND auth_user_id IS NULL
        RETURNING id`,
      [target.id, authUserId],
    );
    if (!updated) {
      return { ok: false, status: 409, error: "Fiche liée entre-temps." };
    }
  } catch (err) {
    // 23505 = violation d'unicité : course avec une autre liaison.
    if ((err as { code?: string }).code === "23505") {
      return {
        ok: false,
        status: 409,
        error: "Ce compte Neon Auth est déjà lié à une autre fiche.",
      };
    }
    throw err;
  }
  return { ok: true };
};
