/**
 * Point d'entrée du serveur API BoulangeriePro.
 *
 * Responsabilités :
 * - exposer l'API REST consommée par le front (React/Vite) ;
 * - authentifier les utilisateurs et appliquer les rôles ;
 * - servir la compilation statique du front en production.
 */

import express from "express";
import cors from "cors";
import crypto from "crypto";
import { config } from "./config";
import { authRouter } from "./routes/auth.routes";
import { catalogRouter } from "./routes/catalog.routes";
import { operationsRouter } from "./routes/operations.routes";
import { adminRouter } from "./routes/admin.routes";
import { reportsRouter } from "./routes/reports.routes";

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
// Route webhook sans vérification d'authentification (requis par les APIs Mobile Money)
app.use(
  "/api/webhooks",
  express.raw({ type: "application/json", limit: "2mb" }),
);
// Autres routes avec parsing JSON standard
app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/webhooks")) return next();
  express.json({ limit: "2mb" })(req, res, next);
});

// Clients SSE connectés
const sseClients = new Set<express.Response>();

// Route SSE pour recevoir les mises à jour en temps réel
app.get("/api/sse/mobilemoney", (req, res) => {
  // Configurer les headers SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": config.corsOrigin,
  });

  // Ajouter le client à la liste
  sseClients.add(res);

  // Retirer le client quand il se déconnecte
  req.on("close", () => {
    sseClients.delete(res);
  });
});

/** Vérifie la signature du webhook selon les spécifications de chaque opérateur */
function verifyWebhookSignature(
  operator: string,
  payload: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  try {
    switch (operator) {
      case "WAVE": {
        const waveHmac = crypto.createHmac("sha256", secret);
        const waveSignature = waveHmac.update(payload).digest("hex");
        return crypto.timingSafeEqual(
          Buffer.from(waveSignature),
          Buffer.from(signatureHeader),
        );
      }
      case "ORANGE_MONEY": {
        const orangeHmac = crypto.createHmac("sha256", secret);
        const orangeSignature = orangeHmac.update(payload).digest("hex");
        return crypto.timingSafeEqual(
          Buffer.from(orangeSignature),
          Buffer.from(signatureHeader),
        );
      }
      case "MTN_MOMO": {
        const mtnHmac = crypto.createHmac("sha512", secret);
        const mtnSignature = mtnHmac.update(payload).digest("base64");
        return crypto.timingSafeEqual(
          Buffer.from(mtnSignature),
          Buffer.from(signatureHeader),
        );
      }
      default:
        return false;
    }
  } catch (error) {
    console.error("Erreur vérification signature:", error);
    return false;
  }
}

// Webhooks Mobile Money (recevoir les mises à jour de statut en temps réel)
app.post("/api/webhooks/mobilemoney/:operator", async (req, res) => {
  try {
    const rawPayload = req.body.toString();
    const payload = JSON.parse(rawPayload);
    const operator = req.params.operator.toUpperCase();

    console.log(`Webhook reçu de ${operator}:`, payload);

    const validOperators = ["WAVE", "ORANGE_MONEY", "MTN_MOMO"];
    if (!validOperators.includes(operator)) {
      return res.status(400).json({ error: "Opérateur invalide" });
    }

    const webhookSecrets: Record<string, string> = {
      WAVE: config.waveWebhookSecret,
      ORANGE_MONEY: config.orangeMoneyWebhookSecret,
      MTN_MOMO: config.mtnMomoWebhookSecret,
    };
    const secret = webhookSecrets[operator];

    const signatureHeader = req.headers[
      `x-${operator.toLowerCase()}-signature`
    ] as string;

    const isSignatureValid = verifyWebhookSignature(
      operator,
      rawPayload,
      signatureHeader,
      secret,
    );

    if (!isSignatureValid) {
      console.error(`Signature invalide reçue de ${operator}`);
      return res.status(403).json({ error: "Signature invalide" });
    }

    console.log(`✅ Signature webhook ${operator} vérifiée avec succès`);

    const transactionId = payload.externalId || payload.orderId;
    if (transactionId) {
      const update = {
        operator,
        transactionId,
        status: payload.status || payload.paymentStatus,
        reason: payload.reason,
        timestamp: new Date().toISOString(),
      };

      sseClients.forEach((client) => {
        client.write(`data: ${JSON.stringify(update)}\n\n`);
      });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Erreur traitement webhook:", error);
    res.status(500).json({ error: "Erreur interne serveur" });
  }
});

// Sonde de disponibilité (monitoring)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "boulangeriepro-api" });
});

// Authentification & session.
app.use("/api/auth", authRouter);

// Données de référentiel : produits, matières, recettes, clients, fournisseurs…
app.use("/api", catalogRouter);

// Opérations métier : ventes, production, achats, pertes, caisse…
app.use("/api", operationsRouter);

// Administration : paramètres de l'entreprise, utilisateurs, sauvegarde.
app.use("/api", adminRouter);

// Reporting : statistiques du tableau de bord.
app.use("/api", reportsRouter);

// Gestionnaire d'erreurs centralisé.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[api] erreur non gérée :", err);
    res.status(500).json({ error: "Erreur interne du serveur." });
  },
);

app.listen(config.port, () => {
  console.log(
    `[api] BoulangeriePro API à l'écoute sur http://localhost:${config.port} (${config.nodeEnv})`,
  );
});

export { app };
