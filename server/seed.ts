/**
 * Seed : alimente la base Neon avec les données de démonstration et les
 * comptes utilisateurs de départ.
 *
 * Usage : npm run db:seed
 *
 * Idempotent : les données existantes sont remplacées (TRUNCATE puis insert),
 * afin de pouvoir relancer le seed sans créer de doublons.
 */
import { pool, query } from "./db";
import { hashPassword, type Role } from "./auth";
import {
  INITIAL_STORES,
  INITIAL_MATERIALS,
  INITIAL_PRODUCTS,
  INITIAL_RECIPES,
  INITIAL_PRODUCTION_ORDERS,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_SALES,
  INITIAL_LOSSES,
  INITIAL_CASH_TRANSACTIONS,
  INITIAL_CUSTOM_ORDERS,
} from "../src/data/initialData";

/**
 * Comptes de démonstration, un par rôle.
 * ⚠️ Mots de passe à changer impérativement en production.
 */
const USERS: Array<{
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  storeId: string;
}> = [
  {
    id: "usr-gerant",
    name: "Amadou Kouassi",
    email: "gerant@boulangeriepro.ci",
    password: "gerant123",
    role: "gerant",
    storeId: "store-1",
  },
  {
    id: "usr-caissier",
    name: "Aïcha Diallo",
    email: "caissier@boulangeriepro.ci",
    password: "caisse123",
    role: "caissier",
    storeId: "store-1",
  },
  {
    id: "usr-boulanger",
    name: "Koffi Jean-Luc",
    email: "boulanger@boulangeriepro.ci",
    password: "fournil123",
    role: "boulanger",
    storeId: "store-1",
  },
  {
    id: "usr-magasinier",
    name: "Sylvie Touré",
    email: "magasinier@boulangeriepro.ci",
    password: "stock123",
    role: "magasinier",
    storeId: "store-1",
  },
];

const seed = async () => {
  console.log("[seed] Réinitialisation des tables…");

  // Ordre respectant les dépendances de clés étrangères.
  await query(`TRUNCATE TABLE
    sale_items, sales, purchase_order_items, purchase_orders,
    recipe_ingredients, recipes, production_orders, stock_movements,
    losses, cash_transactions, custom_orders, products, raw_materials,
    customers, suppliers, users, stores, company_settings
    RESTART IDENTITY CASCADE`);

  // ---- Boutiques
  for (const s of INITIAL_STORES) {
    await query(
      `INSERT INTO stores (id, name, location, phone, manager_name, is_main)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [s.id, s.name, s.location, s.phone, s.managerName, s.isMain],
    );
  }

  // ---- Paramètres de l'entreprise
  await query(
    `INSERT INTO company_settings
       (id, establishment_name, rccm, taxpayer_account, default_vat_rate, currency)
     VALUES ('default','Maison du Pain & Pâtisserie d’Ivoire','CI-ABJ-2024-B-14529','2419082',0,'XOF')`,
  );

  // ---- Utilisateurs
  for (const u of USERS) {
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, store_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [u.id, u.name, u.email, hashPassword(u.password), u.role, u.storeId],
    );
  }

  // ---- Matières premières
  for (const m of INITIAL_MATERIALS) {
    await query(
      `INSERT INTO raw_materials
         (id, code, name, category, current_stock, unit, min_stock_alert, unit_cost,
          supplier_id, batch_number, expiry_date, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        m.id,
        m.code,
        m.name,
        m.category,
        m.currentStock,
        m.unit,
        m.minStockAlert,
        m.unitCost,
        m.supplierId ?? null,
        m.batchNumber ?? null,
        m.expiryDate ?? null,
        m.location ?? null,
      ],
    );
  }

  // ---- Produits
  for (const p of INITIAL_PRODUCTS) {
    await query(
      `INSERT INTO products
         (id, sku, name, category, price, cost_price, vat_rate, stock, min_stock,
          unit, barcode, image_icon, description, recipe_id, store_id, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        p.id,
        p.sku,
        p.name,
        p.category,
        p.price,
        p.costPrice,
        p.vatRate,
        p.stock,
        p.minStock,
        p.unit,
        p.barcode ?? null,
        p.imageIcon ?? null,
        p.description ?? null,
        p.recipeId ?? null,
        p.storeId,
        p.isActive,
      ],
    );
  }

  // ---- Recettes + ingrédients
  for (const r of INITIAL_RECIPES) {
    await query(
      `INSERT INTO recipes
         (id, name, product_id, product_name, output_yield, output_unit,
          preparation_time_min, proofing_time_min, baking_time_min, baking_temp_c,
          instructions, total_cost, cost_per_unit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        r.id,
        r.name,
        r.productId ?? null,
        r.productName ?? null,
        r.outputYield,
        r.outputUnit ?? null,
        r.preparationTimeMin,
        r.proofingTimeMin,
        r.bakingTimeMin,
        r.bakingTempC,
        JSON.stringify(r.instructions ?? []),
        r.totalCost,
        r.costPerUnit,
      ],
    );
    for (const ing of r.ingredients) {
      await query(
        `INSERT INTO recipe_ingredients
           (recipe_id, material_id, material_name, quantity, unit, cost)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          r.id,
          ing.materialId,
          ing.materialName,
          ing.quantity,
          ing.unit,
          ing.cost,
        ],
      );
    }
  }

  // ---- Clients & fournisseurs
  for (const c of INITIAL_CUSTOMERS) {
    await query(
      `INSERT INTO customers
         (id, name, phone, email, type, address, loyalty_points, credit_balance, credit_limit, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        c.id,
        c.name,
        c.phone,
        c.email ?? null,
        c.type,
        c.address ?? null,
        c.loyaltyPoints,
        c.creditBalance,
        c.creditLimit,
        c.notes ?? null,
      ],
    );
  }
  for (const s of INITIAL_SUPPLIERS) {
    await query(
      `INSERT INTO suppliers
         (id, name, contact_name, phone, email, address, supplied_materials, payment_terms, pending_balance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        s.id,
        s.name,
        s.contactName,
        s.phone,
        s.email,
        s.address,
        JSON.stringify(s.suppliedMaterials ?? []),
        s.paymentTerms,
        s.pendingBalance,
      ],
    );
  }

  // ---- Ordres de production
  for (const o of INITIAL_PRODUCTION_ORDERS) {
    await query(
      `INSERT INTO production_orders
         (id, code, recipe_id, recipe_name, product_id, product_name, batch_multiplier,
          target_quantity, actual_quantity, status, scheduled_time, completed_time,
          baker_name, shift, store_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        o.id,
        o.code,
        o.recipeId,
        o.recipeName,
        o.productId,
        o.productName,
        o.batchMultiplier,
        o.targetQuantity,
        o.actualQuantity ?? null,
        o.status,
        o.scheduledTime,
        o.completedTime ?? null,
        o.bakerName,
        o.shift,
        o.storeId,
        o.notes ?? null,
      ],
    );
  }

  // ---- Ventes + lignes
  for (const s of INITIAL_SALES) {
    await query(
      `INSERT INTO sales
         (id, receipt_number, date, subtotal, discount_amount, vat_amount, total,
          payment_method, amount_paid, change_returned, customer_id, customer_name,
          cashier_name, store_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        s.id,
        s.receiptNumber,
        s.date,
        s.subtotal,
        s.discountAmount,
        s.vatAmount,
        s.total,
        s.paymentMethod,
        s.amountPaid,
        s.changeReturned,
        s.customerId ?? null,
        s.customerName ?? null,
        s.cashierName,
        s.storeId,
        s.status,
      ],
    );
    for (const it of s.items) {
      await query(
        `INSERT INTO sale_items (sale_id, product_id, name, unit_price, quantity, total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [s.id, it.productId, it.name, it.unitPrice, it.quantity, it.total],
      );
    }
  }

  // ---- Bons de commande + lignes
  for (const po of INITIAL_PURCHASE_ORDERS) {
    await query(
      `INSERT INTO purchase_orders
         (id, order_number, supplier_id, supplier_name, date, status, total_amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        po.id,
        po.orderNumber,
        po.supplierId,
        po.supplierName,
        po.date,
        po.status,
        po.totalAmount,
        po.notes ?? null,
      ],
    );
    for (const it of po.items) {
      await query(
        `INSERT INTO purchase_order_items
           (order_id, material_id, material_name, quantity, unit, unit_price, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          po.id,
          it.materialId,
          it.materialName,
          it.quantity,
          it.unit,
          it.unitPrice,
          it.total,
        ],
      );
    }
  }

  // ---- Pertes, caisse, commandes gâteaux
  for (const l of INITIAL_LOSSES) {
    await query(
      `INSERT INTO losses
         (id, date, product_id, product_name, quantity, unit, loss_value, reason,
          destination, store_id, recorded_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        l.id,
        l.date,
        l.productId ?? null,
        l.productName,
        l.quantity,
        l.unit,
        l.lossValue,
        l.reason,
        l.destination,
        l.storeId,
        l.recordedBy,
        l.notes ?? null,
      ],
    );
  }
  for (const t of INITIAL_CASH_TRANSACTIONS) {
    await query(
      `INSERT INTO cash_transactions (id, type, amount, description, date, recorded_by, store_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [t.id, t.type, t.amount, t.description, t.date, t.recordedBy, t.storeId],
    );
  }
  for (const o of INITIAL_CUSTOM_ORDERS) {
    await query(
      `INSERT INTO custom_orders
         (id, order_number, client_name, phone, cake_type, serving_count, flavor,
          custom_inscription, theme_color, pickup_date, pickup_time, total_price,
          deposit_paid, status, store_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        o.id,
        o.orderNumber,
        o.clientName,
        o.phone,
        o.cakeType,
        o.servingCount,
        o.flavor,
        o.customInscription,
        o.themeColor,
        o.pickupDate,
        o.pickupTime,
        o.totalPrice,
        o.depositPaid,
        o.status,
        o.storeId,
        o.notes ?? null,
      ],
    );
  }

  console.log("[seed] ✅ Données de démonstration insérées.");
  console.log("[seed] Comptes de connexion :");
  for (const u of USERS) {
    console.log(`        ${u.role.padEnd(12)} ${u.email}  /  ${u.password}`);
  }
  console.log(
    "[seed] ⚠️  Changez ces mots de passe avant toute mise en production.",
  );
};

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error("[seed] ❌ Échec :", err);
    pool.end();
    process.exit(1);
  });
