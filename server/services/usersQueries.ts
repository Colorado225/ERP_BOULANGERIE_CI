/**
 * Requêtes de lecture pour les utilisateurs.
 */

import { query, queryOne } from "../db";
import type { User } from "../types/bakery";

export const getUser = async (id: string): Promise<User | null> => {
  return queryOne<User>(
    `SELECT id, name, email, role, store_id, is_active, created_at
       FROM users WHERE id = $1`,
    [id],
  );
};

export const getUsers = async (): Promise<User[]> => {
  return query<User>(
    `SELECT id, name, email, role, store_id, is_active, created_at
       FROM users ORDER BY created_at DESC`,
  );
};

export const toggleUserActive = async (
  userId: string,
  isActive: boolean,
): Promise<boolean> => {
  await query(`UPDATE users SET is_active = $2 WHERE id = $1`, [userId, isActive]);
  return true;
};
