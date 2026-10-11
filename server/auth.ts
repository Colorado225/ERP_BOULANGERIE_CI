/**
 * Authentification et contrôle d'accès (lot 1 — décision D1 : Neon Auth seul).
 *
 * - Identité : Neon Auth émet les jetons (EdDSA, durée 15 min). Le serveur ne
 *   délivre aucun jeton et ne stocke aucun mot de passe.
 * - Validation : signature via JWKS, issuer et algorithme vérifiés à chaque requête.
 * - Autorisation : rôle et boutique sont lus dans la table `users`, jamais dans
 *   le jeton (Neon ne supporte pas les claims personnalisés).
 * - Liaison : `users.auth_user_id` = `sub` du jeton. Une fiche sans liaison est
 *   rattachée à la première connexion par e-mail, et seulement si le jeton
 *   indique un e-mail vérifié. Sinon l'accès est refusé.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { NextFunction, Request, Response } from "express";
import { config } from "./config";
import { queryOne } from "./db";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type Role = "gerant" | "caissier" | "boulanger" | "magasinier";

/** Utilisateur authentifié, tel que construit à partir de la base. */
export interface AuthUser {
  /** Identifiant applicatif (`users.id`). */
  userId: string;
  /** Identifiant Neon Auth (`sub` du jeton). */
  authUserId: string;
  name: string;
  email: string;
  role: Role;
  storeId: string | null;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

/** Résultat de la vérification d'un jeton Neon. */
export interface VerifiedToken {
  sub: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
}

export type TokenVerifier = (token: string) => Promise<VerifiedToken>;

/** Ligne de la table `users` utile à l'authentification. */
export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  store_id: string | null;
  is_active: boolean;
}

/** Accès aux utilisateurs, injectable pour les tests. */
export interface UserStore {
  findByAuthId(authUserId: string): Promise<UserRow | null>;
  /** Lie une fiche sans `auth_user_id` à `authUserId`, si l'e-mail correspond. */
  bindByEmail(authUserId: string, email: string): Promise<UserRow | null>;
}

/* -------------------------------------------------------------------------- */
/*  Vérification des jetons                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Construit un vérificateur de jetons Neon Auth.
 * Seul EdDSA est accepté : tout autre algorithme (dont HS256) est rejeté.
 */
export const createTokenVerifier =
  (getKey: JWTVerifyGetKey, issuer: string): TokenVerifier =>
  async (token) => {
    const { payload } = await jwtVerify(token, getKey, {
      issuer,
      algorithms: ["EdDSA"],
    });

    if (typeof payload.sub !== "string" || payload.sub === "") {
      throw new Error("Jeton sans identifiant (sub).");
    }

    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  };

/* -------------------------------------------------------------------------- */
/*  Middleware d'authentification                                             */
/* -------------------------------------------------------------------------- */

export interface AuthDeps {
  verify: TokenVerifier;
  users: UserStore;
}

/** Fabrique le middleware `requireAuth` avec ses dépendances. */
export const createRequireAuth =
  (deps: AuthDeps) =>
  async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentification requise." });
      return;
    }

    const token = header.slice("Bearer ".length).trim();

    let verified: VerifiedToken;
    try {
      verified = await deps.verify(token);
    } catch {
      res.status(401).json({ error: "Session expirée ou invalide." });
      return;
    }

    try {
      let row = await deps.users.findByAuthId(verified.sub);

      if (!row && verified.email && verified.emailVerified) {
        row = await deps.users.bindByEmail(verified.sub, verified.email);
      }

      if (!row) {
        res.status(403).json({
          error: "Compte non rattaché à l'application : contactez le gérant.",
        });
        return;
      }

      if (!row.is_active) {
        res.status(403).json({ error: "Compte désactivé. Contactez le gérant." });
        return;
      }

      req.user = {
        userId: row.id,
        authUserId: verified.sub,
        name: row.name,
        email: row.email,
        role: row.role,
        storeId: row.store_id,
      };
      next();
    } catch (error) {
      next(error);
    }
  };

/* -------------------------------------------------------------------------- */
/*  Implémentation de production                                              */
/* -------------------------------------------------------------------------- */

const USER_COLUMNS = `id, name, email, role, store_id, is_active`;

export const pgUserStore: UserStore = {
  findByAuthId: (authUserId) =>
    queryOne<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE auth_user_id = $1`,
      [authUserId],
    ),
  bindByEmail: (authUserId, email) =>
    queryOne<UserRow>(
      `UPDATE users SET auth_user_id = $1
        WHERE lower(email) = lower($2) AND auth_user_id IS NULL
    RETURNING ${USER_COLUMNS}`,
      [authUserId, email],
    ),
};

const jwks = createRemoteJWKSet(
  new URL(`${config.neonAuthBaseUrl}/.well-known/jwks.json`),
);

/** Middleware à monter sur les routes protégées. */
export const requireAuth = createRequireAuth({
  verify: createTokenVerifier(jwks, config.neonAuthIssuer),
  users: pgUserStore,
});

/* -------------------------------------------------------------------------- */
/*  Autorisation                                                              */
/* -------------------------------------------------------------------------- */

/** Exige que l'utilisateur ait l'un des rôles listés. */
export const requireRole =
  (...allowed: Role[]) =>
  (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentification requise." });
      return;
    }
    if (!allowed.includes(user.role)) {
      res.status(403).json({
        error: `Accès refusé : rôle requis : ${allowed.join(", ")}.`,
      });
      return;
    }
    next();
  };

/**
 * Matrice des permissions. Chaque clé désigne un périmètre métier ; la liste
 * donne les rôles autorisés à écrire. Les lectures restent ouvertes à tout
 * utilisateur authentifié.
 */
export const PERMISSIONS = {
  /** Ventes, commandes spéciales, clients. */
  pos: ["gerant", "caissier"] as Role[],
  /** Mouvements de caisse. */
  cash: ["gerant", "caissier"] as Role[],
  /** Produits, boutiques, catalogue. */
  catalog: ["gerant"] as Role[],
  /** Recettes, fournées, production. */
  production: ["gerant", "boulanger"] as Role[],
  /** Achats et fournisseurs. */
  receiving: ["gerant", "magasinier"] as Role[],
  /** Matières premières et pertes. */
  stock: ["gerant", "magasinier", "boulanger"] as Role[],
  /** Bénéfices et marges (lecture et écriture). */
  margins: ["gerant"] as Role[],
  /** Annulations et suppressions d'opérations. */
  manage: ["gerant"] as Role[],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/** Indique si un rôle possède une permission donnée. */
export const can = (role: Role, permission: Permission): boolean =>
  (PERMISSIONS[permission] as readonly Role[]).includes(role);

/** Guard : exige la permission donnée pour une écriture. */
export const requirePermission = (permission: Permission) =>
  requireRole(...(PERMISSIONS[permission] as Role[]));

/* -------------------------------------------------------------------------- */
/*  Boutique courante                                                         */
/* -------------------------------------------------------------------------- */

/** Refuse les requêtes d'un utilisateur non rattaché à une boutique. */
export const requireStore = (
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    res.status(401).json({ error: "Authentification requise." });
    return;
  }
  if (!req.user.storeId) {
    res.status(403).json({
      error: "Aucune boutique rattachée à ce compte : contactez le gérant.",
    });
    return;
  }
  next();
};

/**
 * Boutique sur laquelle agir. Un non-gérant est toujours rattaché à sa propre
 * boutique ; seul le gérant peut cibler une autre boutique explicitement.
 * À n'appeler qu'après `requireStore`.
 */
export const resolveStoreId = (user: AuthUser, requested?: string | null): string => {
  if (user.role === "gerant" && requested) return requested;
  return user.storeId as string;
};
