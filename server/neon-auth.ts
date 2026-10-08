/**
 * Authentification Neon Auth avec validation JWKS.
 *
 * - Validation des tokens JWT émis par Neon Auth via JWKS (JSON Web Key Set)
 * - Plus besoin de gérer les secrets de signature JWT localement
 * - Neon gère la rotation des clés automatiquement
 * - Compatible avec l'interface existante pour minimiser les changements
 */

import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";

/** Rôles disponibles dans l'ERP (inchangés pour compatibilité) */
export type Role = "gerant" | "caissier" | "boulanger" | "magasinier";

/** Charge utile transportée dans le jeton Neon Auth */
export interface NeonAuthPayload {
  sub: string;
  name: string;
  email: string;
  role: Role;
  storeId: string | null;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

/** Charge utile pour compatibilité avec l'ancien système AuthPayload */
export interface AuthPayload {
  userId: string;
  name: string;
  role: Role;
  storeId: string | null;
}

/** Étend la requête Express pour y attacher l'utilisateur authentifié (compatibilité) */
export interface AuthedRequest extends Request {
  user?: {
    userId: string;
    name: string;
    role: Role;
    storeId: string | null;
  };
}

/** URL du JWKS fournie par Neon Auth */
const JWKS_URL = new URL(
  "https://ep-patient-salad-b4ndwcsm.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth/.well-known/jwks.json",
);

/** URL de l'émetteur (issuer) des tokens Neon Auth */
const ISSUER =
  "https://ep-patient-salad-b4ndwcsm.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth";

/** Audience attendue dans les tokens */
const AUDIENCE = "neondb";

/** JWKS remote - gère automatiquement le cache et la rotation des clés */
const JWKS = createRemoteJWKSet(JWKS_URL, {
  cacheMaxAge: 60 * 60 * 1000, // 1 heure de cache
});

/**
 * Middleware : exige un token Neon Auth valide et attache l'utilisateur à la requête.
 * Répond 401 si le token est absent, invalide ou expiré.
 * Compatible avec l'ancien middleware requireAuth.
 */
export const requireAuth = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentification requise." });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    // Vérifier la signature et les claims du token - jose gère automatiquement la récupération de la bonne clé depuis le JWKS
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    // Attacher l'utilisateur à la requête dans le même format que l'ancien système
    req.user = {
      userId: payload.sub as string,
      name: payload.name as string,
      role: payload.role as Role,
      storeId: payload.storeId as string | null,
    };

    next();
  } catch (error) {
    console.error("Erreur de validation Neon Auth:", error);
    res.status(401).json({ error: "Session expirée ou invalide." });
  }
};

/**
 * Hiérarchie des rôles (inchangée pour compatibilité)
 */
const ROLE_RANK: Record<Role, number> = {
  magasinier: 1,
  caissier: 2,
  boulanger: 2,
  gerant: 3,
};

/**
 * Middleware : exige un rôle minimum. Compatible avec l'ancien requireRole.
 */
export const requireRole =
  (minimum: Role) =>
  (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentification requise." });
      return;
    }
    if (ROLE_RANK[user.role] < ROLE_RANK[minimum]) {
      res.status(403).json({
        error: `Accès refusé : rôle « ${minimum} » ou supérieur requis.`,
      });
      return;
    }
    next();
  };

/**
 * Matrice des permissions (inchangée pour compatibilité)
 */
export const PERMISSIONS = {
  /** Vente / caisse POS. */
  pos: ["gerant", "caissier"] as Role[],
  /** Modifier prix / catalogue. */
  catalog: ["gerant"] as Role[],
  /** Lancer fournées / production. */
  production: ["gerant", "boulanger"] as Role[],
  /** Réception matières premières. */
  receiving: ["gerant", "magasinier"] as Role[],
  /** Voir bénéfices & marges. */
  margins: ["gerant"] as Role[],
} as const;

/** Indique si un rôle possède une permission donnée. */
export const can = (
  role: Role,
  permission: keyof typeof PERMISSIONS,
): boolean => (PERMISSIONS[permission] as readonly Role[]).includes(role);

/**
 * Pour la transition : fonction qui permet de vérifier si on utilise encore l'ancien système
 * ou si on est bien passé à Neon Auth.
 */
export const isUsingNeonAuth = (): boolean => true;
