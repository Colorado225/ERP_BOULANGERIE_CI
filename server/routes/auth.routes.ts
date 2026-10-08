/**
 * Routes d'authentification (chantier 1.2).
 *
 * POST /api/auth/login  — connexion par e-mail + mot de passe
 * GET  /api/auth/me     — profil de l'utilisateur courant (jeton requis)
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import { query, queryOne } from "../db";
import {
  signToken,
  requireAuth,
  PERMISSIONS,
  type AuthedRequest,
  type Role,
} from "../auth";

export const authRouter = Router();

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  store_id: string | null;
  is_active: boolean;
}

/**
 * Connexion : vérifie les identifiants et renvoie un jeton de session.
 * Ne révèle jamais si c'est l'e-mail ou le mot de passe qui est erroné.
 */
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "E-mail et mot de passe requis." });
    return;
  }

  const user = await queryOne<UserRow>(
    `SELECT id, name, email, password_hash, role, store_id, is_active
       FROM users WHERE email = $1`,
    [email.toLowerCase().trim()],
  );

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: "Identifiants invalides." });
    return;
  }

  if (!user.is_active) {
    res.status(403).json({ error: "Compte désactivé. Contactez le gérant." });
    return;
  }

  const token = signToken({
    userId: user.id,
    name: user.name,
    role: user.role,
    storeId: user.store_id,
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      storeId: user.store_id,
      permissions: Object.entries(PERMISSIONS)
        .filter(([, roles]) => (roles as readonly Role[]).includes(user.role))
        .map(([key]) => key),
    },
  });
});

/** Profil de l'utilisateur courant, déduit du jeton. */
authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.user!;
  const row = await queryOne<{
    id: string;
    name: string;
    email: string;
    role: Role;
    store_id: string | null;
  }>(`SELECT id, name, email, role, store_id FROM users WHERE id = $1`, [
    user.userId,
  ]);

  if (!row) {
    res.status(404).json({ error: "Utilisateur introuvable." });
    return;
  }

  res.json({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    storeId: row.store_id,
    permissions: Object.entries(PERMISSIONS)
      .filter(([, roles]) => (roles as readonly Role[]).includes(row.role))
      .map(([key]) => key),
  });
});

/** Liste des utilisateurs (gérant uniquement) — pour l'écran d'administration. */
authRouter.get("/users", requireAuth, async (req: AuthedRequest, res) => {
  if (req.user?.role !== "gerant") {
    res.status(403).json({ error: "Accès réservé au gérant." });
    return;
  }
  const rows = await query(
    `SELECT id, name, email, role, store_id, is_active, created_at
       FROM users ORDER BY created_at DESC`,
  );
  res.json(rows);
});
