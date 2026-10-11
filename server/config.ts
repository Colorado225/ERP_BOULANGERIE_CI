/**
 * Configuration serveur — chargement des variables d'environnement
 * et constantes de sécurité.
 *
 * Règles :
 * - En production (`NODE_ENV=production`), les secrets et la base de données
 *   sont OBLIGATOIRES : absence, valeur trop courte ou valeur de développement
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

export const config = {
  /** URL de connexion Neon (Postgres serverless). Obligatoire en production. */
  databaseUrl: readRequired(
    "DATABASE_URL",
    "postgres://localhost:5432/mock",
  ),
  /** Secret de signature des JWT. Obligatoire et long en production. */
  jwtSecret: readSecret("JWT_SECRET", "dev-secret-change-me"),
  /** Durée de validité d'un jeton de session. */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
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
