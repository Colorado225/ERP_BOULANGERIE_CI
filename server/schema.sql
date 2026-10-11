-- ============================================================================
-- BoulangeriePro — Schéma de base de données (PostgreSQL / Neon)
-- ----------------------------------------------------------------------------
-- Ce schéma reflète les entités de src/types/bakery.ts.
-- Les clés primaires sont des TEXT (identifiants applicatifs du type
-- `prod-1712345678`) pour rester compatibles avec les données existantes
-- et les sauvegardes JSON déjà produites par l'application.
--
-- Exécution : psql "$DATABASE_URL" -f server/schema.sql
-- ============================================================================

-- Paramètres légaux et fiscaux de l'entreprise (une seule ligne attendue).
CREATE TABLE IF NOT EXISTS company_settings (
  id                   TEXT PRIMARY KEY DEFAULT 'default',
  establishment_name   TEXT NOT NULL,
  rccm                 TEXT NOT NULL,
  taxpayer_account     TEXT NOT NULL,
  default_vat_rate     NUMERIC(5,2) NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'XOF',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Boutiques / points de vente.
CREATE TABLE IF NOT EXISTS stores (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  location      TEXT NOT NULL,
  phone         TEXT NOT NULL,
  manager_name  TEXT NOT NULL,
  is_main       BOOLEAN NOT NULL DEFAULT false
);

-- Utilisateurs & rôles (chantier 1.2).
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT UNIQUE NOT NULL,
  -- Déprécié : les mots de passe sont gérés par Neon Auth (lot 1). Conservé
  -- pour compatibilité, plus renseigné par l'application.
  password_hash  TEXT,
  -- Identifiant Neon Auth (claim `sub` du jeton). Lié à la première connexion.
  auth_user_id   TEXT UNIQUE,
  role           TEXT NOT NULL CHECK (role IN ('gerant', 'caissier', 'boulanger', 'magasinier')),
  store_id       TEXT REFERENCES stores(id),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migrations idempotentes pour les bases créées avant le lot 1.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id TEXT UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Produits finis.
CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  sku          TEXT NOT NULL,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,
  price        NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate     NUMERIC(5,2) NOT NULL DEFAULT 0,
  stock        NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_stock    NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit         TEXT NOT NULL DEFAULT 'unite',
  barcode      TEXT,
  image_icon   TEXT,
  description  TEXT,
  recipe_id    TEXT,
  store_id     TEXT REFERENCES stores(id),
  is_active    BOOLEAN NOT NULL DEFAULT true
);

-- Matières premières.
CREATE TABLE IF NOT EXISTS raw_materials (
  id                TEXT PRIMARY KEY,
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL,
  current_stock     NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit              TEXT NOT NULL,
  min_stock_alert   NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
  supplier_id       TEXT,
  batch_number      TEXT,
  expiry_date       DATE,
  location          TEXT
);

-- Fiches recettes.
CREATE TABLE IF NOT EXISTS recipes (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  product_id          TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_name        TEXT,
  output_yield        NUMERIC(12,2) NOT NULL DEFAULT 0,
  output_unit         TEXT,
  preparation_time_min INTEGER DEFAULT 0,
  proofing_time_min   INTEGER DEFAULT 0,
  baking_time_min     INTEGER DEFAULT 0,
  baking_temp_c       INTEGER DEFAULT 0,
  instructions        JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_per_unit       NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- Ingrédients d'une recette (lignes de la fiche).
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id           BIGSERIAL PRIMARY KEY,
  recipe_id    TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  material_id  TEXT NOT NULL,
  material_name TEXT NOT NULL,
  quantity     NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit         TEXT,
  cost         NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- Ordres de fabrication (fournées).
CREATE TABLE IF NOT EXISTS production_orders (
  id                  TEXT PRIMARY KEY,
  code                TEXT NOT NULL,
  recipe_id           TEXT,
  recipe_name         TEXT,
  product_id          TEXT,
  product_name        TEXT,
  batch_multiplier    NUMERIC(10,2) NOT NULL DEFAULT 1,
  target_quantity     NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_quantity     NUMERIC(12,2),
  status              TEXT NOT NULL,
  scheduled_time      TEXT,
  completed_time      TEXT,
  baker_name          TEXT,
  shift               TEXT,
  store_id            TEXT REFERENCES stores(id),
  notes               TEXT
);

-- Ventes (tickets de caisse).
CREATE TABLE IF NOT EXISTS sales (
  id               TEXT PRIMARY KEY,
  receipt_number   TEXT NOT NULL UNIQUE,
  date             TIMESTAMPTZ NOT NULL DEFAULT now(),
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method   TEXT NOT NULL,
  amount_paid      NUMERIC(12,2) NOT NULL DEFAULT 0,
  change_returned  NUMERIC(12,2) NOT NULL DEFAULT 0,
  customer_id      TEXT,
  customer_name    TEXT,
  cashier_name     TEXT,
  store_id         TEXT REFERENCES stores(id),
  status           TEXT NOT NULL DEFAULT 'paye'
);

-- Lignes de vente.
CREATE TABLE IF NOT EXISTS sale_items (
  id          BIGSERIAL PRIMARY KEY,
  sale_id     TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id  TEXT,
  name        TEXT NOT NULL,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total       NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- Clients (particuliers & B2B).
CREATE TABLE IF NOT EXISTS customers (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  phone          TEXT,
  email          TEXT,
  type           TEXT NOT NULL DEFAULT 'particulier',
  address        TEXT,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  credit_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_limit   NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes          TEXT
);

-- Fournisseurs.
CREATE TABLE IF NOT EXISTS suppliers (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  contact_name        TEXT,
  phone               TEXT,
  email               TEXT,
  address             TEXT,
  supplied_materials  JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_terms       TEXT,
  pending_balance     NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- Bons de commande fournisseurs.
CREATE TABLE IF NOT EXISTS purchase_orders (
  id             TEXT PRIMARY KEY,
  order_number   TEXT NOT NULL UNIQUE,
  supplier_id    TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name  TEXT,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  status         TEXT NOT NULL DEFAULT 'commande',
  total_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes          TEXT
);

-- Lignes d'un bon de commande.
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id           BIGSERIAL PRIMARY KEY,
  order_id     TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  material_id  TEXT NOT NULL,
  material_name TEXT NOT NULL,
  quantity     NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit         TEXT,
  unit_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- Pertes & invendus (anti-gaspillage).
CREATE TABLE IF NOT EXISTS losses (
  id             TEXT PRIMARY KEY,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  product_id     TEXT,
  product_name   TEXT NOT NULL,
  quantity       NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit           TEXT,
  loss_value     NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason         TEXT NOT NULL,
  destination    TEXT NOT NULL,
  store_id       TEXT REFERENCES stores(id),
  recorded_by    TEXT,
  notes          TEXT
);

-- Mouvements de caisse (fond, encaissements, dépenses, clôture Z).
CREATE TABLE IF NOT EXISTS cash_transactions (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  description  TEXT,
  date         TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by  TEXT,
  store_id     TEXT REFERENCES stores(id)
);

-- Commandes de gâteaux sur-mesure.
CREATE TABLE IF NOT EXISTS custom_orders (
  id                 TEXT PRIMARY KEY,
  order_number       TEXT NOT NULL UNIQUE,
  client_name        TEXT NOT NULL,
  phone              TEXT,
  cake_type          TEXT,
  serving_count      INTEGER DEFAULT 0,
  flavor             TEXT,
  custom_inscription TEXT,
  theme_color        TEXT,
  pickup_date        DATE,
  pickup_time        TEXT,
  total_price        NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_paid       NUMERIC(12,2) NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'commande',
  store_id           TEXT REFERENCES stores(id),
  notes              TEXT
);

-- Journal des mouvements de stock (chantier 2.1).
CREATE TABLE IF NOT EXISTS stock_movements (
  id                TEXT PRIMARY KEY,
  material_id       TEXT NOT NULL,
  material_name     TEXT NOT NULL,
  delta             NUMERIC(12,3) NOT NULL,
  resulting_stock   NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit              TEXT,
  source            TEXT NOT NULL,
  reference         TEXT,
  reason            TEXT,
  recorded_by       TEXT,
  store_id          TEXT REFERENCES stores(id),
  date              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Index utiles ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sales_store_date    ON sales (store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale     ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_prod_orders_store   ON production_orders (store_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_mv_material   ON stock_movements (material_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_store_date     ON cash_transactions (store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_losses_store_date   ON losses (store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_product     ON recipes (product_id);
CREATE INDEX IF NOT EXISTS idx_users_email         ON users (email);

-- ---- Lot 2 : intégrité des ventes, numérotation et stock --------------------

-- La table `sales` n'avait pas de colonne `notes`, utilisée par l'API
-- (INSERT, SELECT) : ajoutée ici de façon idempotente.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes TEXT;

-- Numérotation continue des tickets, par boutique (décision D4, format dans
-- saleCalculation.formatReceiptNumber). Verrouillée par l'UPDATE dans la
-- transaction de vente : un ROLLBACK ne laisse aucun trou.
CREATE TABLE IF NOT EXISTS receipt_sequences (
  store_id     TEXT PRIMARY KEY REFERENCES stores(id),
  last_number  BIGINT NOT NULL DEFAULT 0
);

-- Contraintes CHECK (lot 2.6). NOT VALID : appliquées aux nouvelles écritures
-- sans bloquer la migration si des lignes historiques sont incohérentes.
-- Pour les valider après nettoyage : ALTER TABLE ... VALIDATE CONSTRAINT.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_total_nonneg') THEN
    ALTER TABLE sales ADD CONSTRAINT sales_total_nonneg CHECK (total >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_quantity_positive') THEN
    ALTER TABLE sale_items ADD CONSTRAINT sale_items_quantity_positive CHECK (quantity > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_materials_stock_nonneg') THEN
    ALTER TABLE raw_materials ADD CONSTRAINT raw_materials_stock_nonneg CHECK (current_stock >= 0) NOT VALID;
  END IF;
END $$;
