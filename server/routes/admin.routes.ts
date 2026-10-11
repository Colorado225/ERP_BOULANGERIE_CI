/**
 * Routes d'administration : paramètres légaux/fiscaux de l'entreprise,
 * gestion des utilisateurs, et instantané global (sauvegarde).
 */
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { query, queryOne } from "../db";
import { linkUserToAuthAccount } from "../services/userLinkService";
import {
  requireAuth,
  requireRole,
  type AuthedRequest,
  type Role,
} from "../auth";

export const adminRouter = Router();

adminRouter.use(requireAuth);

/* ----------------------------- COMPANY SETTINGS ---------------------------- */

adminRouter.get("/company", async (_req, res) => {
  const row = await queryOne(
    `SELECT establishment_name AS "establishmentName", rccm,
            taxpayer_account AS "taxpayerAccount",
            default_vat_rate AS "defaultVatRate", currency
       FROM company_settings WHERE id = 'default'`,
  );
  res.json(row);
});

adminRouter.put("/company", requireRole("gerant"), async (req, res) => {
  const c = req.body;
  await query(
    `INSERT INTO company_settings
       (id, establishment_name, rccm, taxpayer_account, default_vat_rate, currency, updated_at)
     VALUES ('default',$1,$2,$3,$4,$5,now())
     ON CONFLICT (id) DO UPDATE SET
       establishment_name = EXCLUDED.establishment_name,
       rccm = EXCLUDED.rccm,
       taxpayer_account = EXCLUDED.taxpayer_account,
       default_vat_rate = EXCLUDED.default_vat_rate,
       currency = EXCLUDED.currency,
       updated_at = now()`,
    [
      c.establishmentName,
      c.rccm,
      c.taxpayerAccount,
      c.defaultVatRate ?? 0,
      c.currency ?? "XOF",
    ],
  );
  res.json({ updated: true });
});

/* ---------------------------------- USERS ---------------------------------- */

/**
 * Création d'une fiche utilisateur (gérant uniquement).
 * Le mot de passe est géré par Neon Auth : la fiche est liée au compte Neon
 * lors de la première connexion, si l'e-mail correspond et est vérifié.
 */
adminRouter.post("/users", requireRole("gerant"), async (req, res) => {
  const u = req.body as {
    name?: string;
    email?: string;
    role?: Role;
    storeId?: string;
  };

  const ROLES: Role[] = ["gerant", "caissier", "boulanger", "magasinier"];
  if (!u.name || !u.email || !u.role) {
    res.status(400).json({ error: "Nom, e-mail et rôle requis." });
    return;
  }
  if (!ROLES.includes(u.role)) {
    res.status(400).json({ error: "Rôle inconnu." });
    return;
  }

  await query(
    `INSERT INTO users (id, name, email, password_hash, role, store_id)
     VALUES ($1,$2,$3,NULL,$4,$5)`,
    [
      randomUUID(),
      u.name.trim(),
      u.email.toLowerCase().trim(),
      u.role,
      u.storeId ?? null,
    ],
  );
  res.status(201).json({ created: true });
});

/**
 * Liaison manuelle d'une fiche à un compte Neon Auth (gérant uniquement).
 * Sert de secours lorsque la liaison automatique ne peut pas se faire (par
 * exemple jeton sans `email_verified`). Logique dans userLinkService.
 */
adminRouter.post("/users/:id/link", requireRole("gerant"), async (req, res) => {
  const authUserId = (req.body as { authUserId?: unknown })?.authUserId;
  const result = await linkUserToAuthAccount(
    { query, queryOne },
    req.params.id,
    authUserId,
  );
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ linked: true });
});

/** Active/désactive un compte (gérant uniquement). */
adminRouter.patch("/users/:id", requireRole("gerant"), async (req, res) => {
  const { isActive } = req.body as { isActive: boolean };
  await query(`UPDATE users SET is_active = $2 WHERE id = $1`, [
    req.params.id,
    isActive,
  ]);
  res.json({ updated: true });
});

/* --------------------------------- BACKUP ---------------------------------- */

/**
 * Instantané complet de la base : sert de sauvegarde JSON (la structure est
 * compatible avec la fonction d'export/import déjà présente côté front).
 */
adminRouter.get("/backup", requireRole("gerant"), async (_req, res) => {
  const [
    products,
    materials,
    recipes,
    productionOrders,
    sales,
    customers,
    suppliers,
    purchases,
    losses,
    cashTransactions,
    customOrders,
    company,
    stockMovements,
  ] = await Promise.all([
    query(`SELECT * FROM products`),
    query(`SELECT * FROM raw_materials`),
    query(`SELECT * FROM recipes`),
    query(`SELECT * FROM production_orders`),
    query(`SELECT * FROM sales`),
    query(`SELECT * FROM customers`),
    query(`SELECT * FROM suppliers`),
    query(`SELECT * FROM purchase_orders`),
    query(`SELECT * FROM losses`),
    query(`SELECT * FROM cash_transactions`),
    query(`SELECT * FROM custom_orders`),
    query(`SELECT * FROM company_settings WHERE id = 'default'`),
    query(`SELECT * FROM stock_movements`),
  ]);

  res.json({
    products,
    materials,
    recipes,
    productionOrders,
    sales,
    customers,
    suppliers,
    purchases,
    losses,
    cashTransactions,
    customOrders,
    company: company[0] ?? null,
    stockMovements,
    exportedAt: new Date().toISOString(),
  });
});

/** Profil courant enrichi (utilisé par le front pour connaître ses droits). */
adminRouter.get("/session", async (req: AuthedRequest, res) => {
  res.json(req.user);
});
