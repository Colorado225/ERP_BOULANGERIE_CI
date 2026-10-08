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
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('gerant', 'caissier', 'boulanger', 'magasinier')),
  store_id       TEXT REFERENCES stores(id),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
