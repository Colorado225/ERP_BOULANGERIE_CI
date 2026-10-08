/**
 * Routes d'administration : paramètres légaux/fiscaux de l'entreprise,
 * gestion des utilisateurs, et instantané global (sauvegarde).
 */
import { Router } from 'express';
import { query, queryOne } from '../db';
import { requireAuth, requireRole, hashPassword, type AuthedRequest, type Role } from '../auth';

export const adminRouter = Router();

adminRouter.use(requireAuth);

/* ----------------------------- COMPANY SETTINGS ---------------------------- */

adminRouter.get('/company', async (_req, res) => {
  const row = await queryOne(
    `SELECT establishment_name AS "establishmentName", rccm,
            taxpayer_account AS "taxpayerAccount",
            default_vat_rate AS "defaultVatRate", currency
       FROM company_settings WHERE id = 'default'`
  );
  res.json(row);
});

adminRouter.put('/company', requireRole('gerant'), async (req, res) => {
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
      c.establishmentName, c.rccm, c.taxpayerAccount,
      c.defaultVatRate ?? 0, c.currency ?? 'XOF',
    ]
  );
  res.json({ updated: true });
});

/* ---------------------------------- USERS ---------------------------------- */

/** Création d'un utilisateur (gérant uniquement). */
adminRouter.post('/users', requireRole('gerant'), async (req, res) => {
  const u = req.body as {
    id: string;
    name: string;
    email: string;
    password: string;
    role: Role;
    storeId?: string;
  };

  if (!u.email || !u.password) {
    res.status(400).json({ error: 'E-mail et mot de passe requis.' });
    return;
  }

  await query(
    `INSERT INTO users (id, name, email, password_hash, role, store_id)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [u.id, u.name, u.email.toLowerCase().trim(), hashPassword(u.password), u.role, u.storeId ?? null]
  );
  res.status(201).json({ created: true });
});

/** Active/désactive un compte (gérant uniquement). */
adminRouter.patch('/users/:id', requireRole('gerant'), async (req, res) => {
  const { isActive } = req.body as { isActive: boolean };
  await query(`UPDATE users SET is_active = $2 WHERE id = $1`, [req.params.id, isActive]);
  res.json({ updated: true });
});

/* --------------------------------- BACKUP ---------------------------------- */

/**
 * Instantané complet de la base : sert de sauvegarde JSON (la structure est
 * compatible avec la fonction d'export/import déjà présente côté front).
 */
adminRouter.get('/backup', requireRole('gerant'), async (_req, res) => {
  const [
    products, materials, recipes, productionOrders, sales, customers,
    suppliers, purchases, losses, cashTransactions, customOrders,
    company, stockMovements,
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
    products, materials, recipes, productionOrders, sales, customers,
    suppliers, purchases, losses, cashTransactions, customOrders,
    company: company[0] ?? null, stockMovements,
    exportedAt: new Date().toISOString(),
  });
});

/** Profil courant enrichi (utilisé par le front pour connaître ses droits). */
adminRouter.get('/session', async (req: AuthedRequest, res) => {
  res.json(req.user);
});
