/**
 * Configuration serveur — chargement des variables d'environnement
 * et constantes de sécurité.
 *
 * Règles :
 * - En production (`NODE_ENV=production`), les variables sensibles sont
 *   OBLIGATOIRES : absence, valeur trop courte ou valeur de développement
 *   => le serveur refuse de démarrer.
 * - En développement, des valeurs de repli sont utilisées, avec un avertissement.
 */
import "dotenv/config";

const nodeEnv = process.env.NODE_ENV || "development";
const isProd = nodeEnv === "production";

/** Longueur minimale d'un secret (ex. `openssl rand -hex 32`). */
const MIN_SECRET_LENGTH = 32;

/**
 * Lit une variable obligatoire en production.
 * En développement, renvoie `devFallback` si la variable est absente.
 */
const readRequired = (name: string, devFallback: string): string => {
  const value = process.env[name];

  if (isProd) {
    if (!value) {
      throw new Error(
        `[config] Variable obligatoire en production : ${name}. ` +
          `Renseignez-la dans l'environnement de déploiement (voir .env.example).`,
      );
    }
    return value;
  }

  if (!value) {
    console.warn(
      `[config] ${name} absent : valeur de développement utilisée. ` +
        `Ne pas déployer en production sans cette variable.`,
    );
    return devFallback;
  }
  return value;
};

/**
 * Lit un secret. En production, rejette les valeurs trop courtes
 * et la valeur de développement connue.
 */
const readSecret = (name: string, devFallback: string): string => {
  const value = readRequired(name, devFallback);

  if (isProd) {
    if (value === devFallback) {
      throw new Error(
        `[config] ${name} utilise la valeur de développement : ` +
          `générez un secret propre (ex. openssl rand -hex 32).`,
      );
    }
    if (value.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `[config] ${name} est trop court (${value.length} caractères, ` +
          `minimum ${MIN_SECRET_LENGTH}).`,
      );
    }
  }
  return value;
};

/**
 * URL de base de Neon Auth (fournie par le tableau de bord Neon, sans slash final).
 * Exemple : https://ep-xxx.neonauth.<région>.aws.neon.tech/neondb/auth
 * Le JWKS est exposé sous `${base}/.well-known/jwks.json`.
 */
const neonAuthBaseUrl = (
  readRequired(
    "NEON_AUTH_BASE_URL",
    "https://ep-patient-salad-b4ndwcsm.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth",
  )
).replace(/\/+$/, "");

export const config = {
  /** URL de connexion Neon (Postgres serverless). Obligatoire en production. */
  databaseUrl: readRequired(
    "DATABASE_URL",
    "postgres://localhost:5432/mock",
  ),
  /** URL de base Neon Auth (validation des jetons via JWKS). */
  neonAuthBaseUrl,
  /**
   * Émetteur attendu (`iss`) des jetons Neon Auth.
   * Par défaut : l'origine de l'URL de base (schéma + hôte), conformément à la
   * documentation Neon. À confirmer en décodant un jeton réel.
   */
  neonAuthIssuer:
    process.env.NEON_AUTH_ISSUER || new URL(neonAuthBaseUrl).origin,
  /** Port d'écoute du serveur API. */
  port: Number(process.env.PORT || 4000),
  /** Origines autorisées pour le front (CORS). */
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  nodeEnv,
  // Secrets webhooks Mobile Money pour vérification des signatures
  waveWebhookSecret: readSecret("WAVE_WEBHOOK_SECRET", "dev-wave-webhook-secret"),
  orangeMoneyWebhookSecret: readSecret(
    "ORANGE_MONEY_WEBHOOK_SECRET",
    "dev-om-webhook-secret",
  ),
  mtnMomoWebhookSecret: readSecret(
    "MTN_MOMO_WEBHOOK_SECRET",
    "dev-mtn-webhook-secret",
  ),
} as const;

export const isProduction = config.nodeEnv === "production";
