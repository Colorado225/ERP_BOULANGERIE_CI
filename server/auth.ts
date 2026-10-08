/**
 * Authentification Neon Auth avec validation JWKS - FICHIER PRINCIPAL
 *
 * Migration complète vers Neon Auth :
 * - Plus de gestion manuelle des secrets JWT
 * - Validation des tokens via JWKS (JSON Web Key Set) de Neon
 * - Neon gère la rotation automatique des clés de signature
 * - Toutes les fonctions et interfaces sont compatibles avec l'ancien système
 */

// Réexporter tout depuis le module Neon Auth - c'est maintenant le seul système d'authentification
export * from "./neon-auth";

// Réexporter également les fonctions qui étaient utilisées dans l'ancien système pour la compatibilité
// (hashPassword, verifyPassword, signToken restent disponibles si besoin pour la transition)
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config";
import type { AuthPayload } from "./neon-auth";

/**
 * Ces fonctions sont conservées pour la transition seulement.
 * Dans Neon Auth, les tokens sont gérés par Neon, donc ces fonctions ne seront plus utilisées.
 */
export const hashPassword = (plain: string): string =>
  bcrypt.hashSync(plain, 10);
export const verifyPassword = (plain: string, hash: string): boolean =>
  bcrypt.compareSync(plain, hash);
export const signToken = (payload: AuthPayload): string =>
  jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
