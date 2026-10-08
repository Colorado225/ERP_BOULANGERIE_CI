/**
 * Routes de reporting : statistiques du tableau de bord.
 *
 * Lecture seule : aucune transaction requise, mais toutes les requêtes
 * sont des SELECT sûrs.
 */

import { Router } from "express";
import { getTodayStats, getRecentSales, getLowStockProducts, getRecentStockMovements, getProductionOrdersByStore, getPurchaseOrdersByStore } from "../services/reportService";
import { getStores } from "../services/storesQueries";
import { getSuppliers } from "../services/suppliersQueries";
import { getCustomers } from "../services/customersQueries";
import { getRecipesWithIngredients } from "../services/recipeQueries";
import { getProductionOrder, getProductionOrdersByStore as getProdOrders } from "../services/productionQueries";
import { getPurchaseOrder, getPurchaseOrdersByStore as getPOs } from "../services/purchaseQueries";
import { getMaterial, getSalesForStore } from "../services/salesQueries";

import type { Router as RetroRouter } from "express";

export const reportsRouter = Router();

// ------------------------------------------------------------------
// Dashboard
// ------------------------------------------------------------------

reportsRouter.get("/dashboard/stats", async (_req, res) => {
  const storeId = (_req as { user?: { storeId?: string } }).user?.storeId ?? "store-1";
  res.json(await getTodayStats(storeId));
});

reportsRouter.get("/dashboard/recent-sales", async (_req, res) => {
  const storeId = (_req as { user?: { storeId?: string } }).user?.storeId ?? "store-1";
  res.json(await getRecentSales(storeId));
});

reportsRouter.get("/dashboard/low-stock-products", async (_req, res) => {
  const storeId = (_req as { user?: { storeId?: string } }).user?.storeId ?? "store-1";
  res.json(await getLowStockProducts(storeId));
});

// ------------------------------------------------------------------
// Inventaire & mouvements
// ------------------------------------------------------------------

reportsRouter.get("/inventory/materials/:id/movements", async (req, res) => {
  const movements = await getMaterial(req.params.id);
  res.json(movements ?? []);
});

reportsRouter.get("/inventory/movements/:id", async (req, res) => {
  const movements = await getMaterial(req.params.id);
  res.json(movements ?? []);
});

// ------------------------------------------------------------------
// Références externes
// ------------------------------------------------------------------

reportsRouter.get("/references/stores", async (_req, res) => {
  res.json(await getStores());
});

reportsRouter.get("/references/suppliers", async (_req, res) => {
  res.json(await getSuppliers());
});

reportsRouter.get("/references/customers", async (_req, res) => {
  res.json(await getCustomers());
});

reportsRouter.get("/references/recipes", async (_req, res) => {
  res.json(await getRecipesWithIngredients());
});

reportsRouter.get("/references/production-orders", async (_req, res) => {
  const storeId = (_req as { user?: { storeId?: string } }).user?.storeId ?? "store-1";
  res.json(await getProdOrders(storeId));
});

reportsRouter.get("/references/purchase-orders", async (_req, res) => {
  const storeId = (_req as { user?: { storeId?: string } }).user?.storeId ?? "store-1";
  res.json(await getPOs(storeId));
});

// ------------------------------------------------------------------
// Ventes historiques (pour les graphiques)
// ------------------------------------------------------------------

reportsRouter.get("/sales/history", async (_req, res) => {
  const storeId = (_req as { user?: { storeId?: string } }).user?.storeId ?? "store-1";
  const sales = await getSalesForStore(storeId, 200);
  // Agrégation mensuelle simplifiée pour le graphique, à défaut
  const monthly = sales.reduce<Record<string, number>>((acc, s) => {
    const month = new Date(s.date).toISOString().slice(0, 7);
    acc[month] = (acc[month] ?? 0) + s.total;
    return acc;
  }, {});
  res.json({ data: monthly, sales });
});
