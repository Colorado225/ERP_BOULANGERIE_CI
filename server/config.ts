/**
 * Configuration serveur — chargement des variables d'environnement
 * et constantes de sécurité.
 */
import "dotenv/config";

const required = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Renseignez-la dans le fichier .env (voir .env.example).`,
    );
  }
  return value;
};

export const config = {
  /** URL de connexion Neon (Postgres serverless). */
  databaseUrl: process.env.DATABASE_URL || "postgres://localhost:5432/mock",
  /** Secret de signature des JWT. En production, doit être long et aléatoire. */
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
  /** Durée de validité d'un jeton de session. */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  /** Port d'écoute du serveur API. */
  port: Number(process.env.PORT || 4000),
  /** Origines autorisées pour le front (CORS). */
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV || "development",
  // Secrets webhooks Mobile Money pour vérification des signatures
  waveWebhookSecret: required("WAVE_WEBHOOK_SECRET", "dev-wave-webhook-secret"),
  orangeMoneyWebhookSecret: required(
    "ORANGE_MONEY_WEBHOOK_SECRET",
    "dev-om-webhook-secret",
  ),
  mtnMomoWebhookSecret: required(
    "MTN_MOMO_WEBHOOK_SECRET",
    "dev-mtn-webhook-secret",
  ),
} as const;

export const isProduction = config.nodeEnv === "production";
