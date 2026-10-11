/**
 * Routes d'authentification (lot 1).
 *
 * La connexion (e-mail + mot de passe) est assurée par Neon Auth côté client.
 * Ce routeur ne délivre aucun jeton.
 *
 * GET  /api/auth/me     — profil de l'utilisateur courant (jeton Neon requis)
 * GET  /api/auth/users  — liste des comptes (gérant uniquement)
 */
import { Router } from "express";
import { query } from "../db";
import {
  PERMISSIONS,
  requireAuth,
  requireRole,
  type AuthedRequest,
  type Role,
} from "../auth";

export const authRouter = Router();

/** Permissions accordées à un rôle, sous forme de liste de clés. */
const permissionsFor = (role: Role): string[] =>
  Object.entries(PERMISSIONS)
    .filter(([, roles]) => (roles as readonly Role[]).includes(role))
    .map(([key]) => key);

/** Profil de l'utilisateur courant. Le rôle vient de la base, pas du jeton. */
authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  res.json({
    id: user.userId,
    name: user.name,
    email: user.email,
    role: user.role,
    storeId: user.storeId,
    permissions: permissionsFor(user.role),
  });
});

/** Liste des utilisateurs (gérant uniquement) — pour l'écran d'administration. */
authRouter.get(
  "/users",
  requireAuth,
  requireRole("gerant"),
  async (_req: AuthedRequest, res) => {
    const rows = await query(
      `SELECT id, name, email, role, store_id, is_active, created_at,
              (auth_user_id IS NOT NULL) AS linked
         FROM users ORDER BY created_at DESC`,
    );
    res.json(rows);
  },
);
