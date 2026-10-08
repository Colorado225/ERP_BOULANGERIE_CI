import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Product,
  RawMaterial,
  Recipe,
  ProductionOrder,
  ProductionStatus,
  Sale,
  Customer,
  Supplier,
  PurchaseOrder,
  LossRecord,
  CashTransaction,
  CustomOrder,
  Store,
  CurrencyCode,
  CartItem,
  PaymentMethod,
  CompanySettings,
  StockMovement,
} from '../types/bakery';
import {
  INITIAL_STORES,
  INITIAL_MATERIALS,
  INITIAL_RECIPES,
  INITIAL_PRODUCTS,
  INITIAL_PRODUCTION_ORDERS,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_SALES,
  INITIAL_LOSSES,
  INITIAL_CASH_TRANSACTIONS,
  INITIAL_CUSTOM_ORDERS,
} from '../data/initialData';
import { resolveWriteStoreId } from '../utils/store';
import { computeVatBreakdown } from '../utils/fiscalite';
import { api, ApiError } from '../services/api';

/**
 * Génère un numéro de facture séquentiel, continu et non réutilisable,
 * conforme à l'exigence de traçabilité fiscale (DGI).
 *
 * Format : `CI-AAAAMMJJ-NNNN` où NNNN est un compteur croissant.
 */
const buildReceiptNumber = (sequence: number): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `CI-${y}${m}${d}-${String(sequence).padStart(4, '0')}`;
};

interface BakeryContextType {
  // Navigation & Globals
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentStoreId: string;
  setCurrentStoreId: (storeId: string) => void;
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  formatMoney: (amountInXOF: number) => string;
  stores: Store[];
  /** Identifiant de boutique réel à utiliser pour toute écriture (jamais le mode "Groupe"). */
  writeStoreId: string;

  // Company legal & fiscal settings
  company: CompanySettings;
  updateCompany: (updates: Partial<CompanySettings>) => void;

  // Stock traceability
  stockMovements: StockMovement[];

  // Entities
  products: Product[];
  materials: RawMaterial[];
  recipes: Recipe[];
  productionOrders: ProductionOrder[];
  sales: Sale[];
  customers: Customer[];
  suppliers: Supplier[];
  purchases: PurchaseOrder[];
  losses: LossRecord[];
  cashTransactions: CashTransaction[];
  customOrders: CustomOrder[];

  // Product Operations
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  // Material Operations
  addMaterial: (material: Omit<RawMaterial, 'id'>) => Promise<void>;
  updateMaterial: (id: string, updates: Partial<RawMaterial>) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;
  adjustMaterialStock: (id: string, delta: number, reason: string) => Promise<void>;

  // Recipe Operations
  addRecipe: (recipe: Omit<Recipe, 'id'>) => Promise<void>;
  updateRecipe: (id: string, updates: Partial<Recipe>) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;

  // Production Operations
  createProductionOrder: (data: {
    recipeId: string;
    batchMultiplier: number;
    shift: 'Matin (04h30)' | 'Midi (11h00)' | 'Soir (16h00)';
    bakerName: string;
    notes?: string;
  }) => void;
  updateProductionStatus: (orderId: string, newStatus: ProductionStatus) => void;

  // POS & Sales Operations
  completeSale: (saleData: {
    cart: CartItem[];
    paymentMethod: PaymentMethod;
    amountPaid: number;
    customerId?: string;
    discountPercent?: number;
    notes?: string;
  }) => Sale;
  lastCompletedSale: Sale | null;
  setLastCompletedSale: (sale: Sale | null) => void;

  // Customer Operations
  addCustomer: (customer: Omit<Customer, 'id' | 'loyaltyPoints' | 'creditBalance'>) => Promise<void>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  payCustomerCredit: (customerId: string, amount: number) => Promise<void>;

  // Supplier & Purchasing
  addSupplier: (supplier: Omit<Supplier, 'id' | 'pendingBalance'>) => Promise<void>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  createPurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'orderNumber' | 'date' | 'status'>) => Promise<void>;
  receivePurchaseOrder: (orderId: string) => void;
  paySupplier: (supplierId: string, amount: number) => void;

  // Losses & Cash
  addLossRecord: (record: Omit<LossRecord, 'id' | 'date'>) => void;
  addCashTransaction: (tx: Omit<CashTransaction, 'id' | 'date'>) => void;

  // Custom Cakes & Orders
  addCustomOrder: (order: Omit<CustomOrder, 'id' | 'orderNumber' | 'status'>) => void;
  updateCustomOrderStatus: (id: string, status: CustomOrder['status']) => void;

  // System
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (v: boolean) => void;
  notification: string | null;
  setNotification: (msg: string | null) => void;
  resetToDemoData: () => void;
  exportBackupJson: () => void;
  importBackupJson: (jsonData: string) => boolean;
}

const BakeryContext = createContext<BakeryContextType | null>(null);

const STORAGE_KEY = 'boulangerie_pro_state_v1';

/** Paramètres légaux et fiscaux par défaut (entreprise ivoirienne). */
const INITIAL_COMPANY_SETTINGS: CompanySettings = {
  establishmentName: 'Maison du Pain & Pâtisserie d’Ivoire',
  rccm: 'CI-ABJ-2024-B-14529',
  taxpayerAccount: '2419082',
  defaultVatRate: 0,
  currency: 'XOF',
};

export const BakeryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentStoreId, setCurrentStoreId] = useState<string>('store-1');

  // Boutique cible de toute écriture métier : si le mode consolidé « Groupe »
  // est actif, on rattache l'écriture à la boutique principale.
  const writeStoreId = resolveWriteStoreId(currentStoreId);
  const [currency, setCurrency] = useState<CurrencyCode>('XOF');
  const [notification, setNotification] = useState<string | null>(null);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Core Data States
  const [stores, setStores] = useState<Store[]>(INITIAL_STORES);
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_products`);
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });
  const [materials, setMaterials] = useState<RawMaterial[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_materials`);
    return saved ? JSON.parse(saved) : INITIAL_MATERIALS;
  });
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_recipes`);
    return saved ? JSON.parse(saved) : INITIAL_RECIPES;
  });
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_production`);
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTION_ORDERS;
  });
  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_sales`);
    return saved ? JSON.parse(saved) : INITIAL_SALES;
  });
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_customers`);
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_suppliers`);
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
  });
  const [purchases, setPurchases] = useState<PurchaseOrder[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_purchases`);
    return saved ? JSON.parse(saved) : INITIAL_PURCHASE_ORDERS;
  });
  const [losses, setLosses] = useState<LossRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_losses`);
    return saved ? JSON.parse(saved) : INITIAL_LOSSES;
  });
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_cash`);
    return saved ? JSON.parse(saved) : INITIAL_CASH_TRANSACTIONS;
  });
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_custom_orders`);
    return saved ? JSON.parse(saved) : INITIAL_CUSTOM_ORDERS;
  });
  const [company, setCompany] = useState<CompanySettings>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_company`);
    return saved ? { ...INITIAL_COMPANY_SETTINGS, ...JSON.parse(saved) } : INITIAL_COMPANY_SETTINGS;
  });
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_stock_movements`);
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoading, setIsLoading] = useState(true);

  // Charger toutes les données depuis l'API au démarrage
  useEffect(() => {
    const loadAllData = async () => {
      try {
        const [
          storesData,
          productsData,
          materialsData,
          recipesData,
          customersData,
          suppliersData,
          productionOrdersData,
          salesData,
          purchasesData,
          lossesData,
          cashTransactionsData,
          customOrdersData
        ] = await Promise.all([
          api.get<Store[]>('/api/catalog/stores'),
          api.get<Product[]>('/api/catalog/products'),
          api.get<RawMaterial[]>('/api/catalog/materials'),
          api.get<Recipe[]>('/api/catalog/recipes'),
          api.get<Customer[]>('/api/catalog/customers'),
          api.get<Supplier[]>('/api/catalog/suppliers'),
          api.get<ProductionOrder[]>('/api/operations/production-orders'),
          api.get<Sale[]>('/api/operations/sales'),
          api.get<PurchaseOrder[]>('/api/operations/purchase-orders'),
          api.get<LossRecord[]>('/api/operations/losses'),
          api.get<CashTransaction[]>('/api/operations/cash-transactions'),
          api.get<CustomOrder[]>('/api/operations/custom-orders'),
        ]);

        setStores(storesData);
        setProducts(productsData);
        setMaterials(materialsData);
        setRecipes(recipesData);
        setCustomers(customersData);
        setSuppliers(suppliersData);
        setProductionOrders(productionOrdersData);
        setSales(salesData);
        setPurchases(purchasesData);
        setLosses(lossesData);
        setCashTransactions(cashTransactionsData);
        setCustomOrders(customOrdersData);
      } catch (err) {
        console.warn('Utilisation des données locales :', (err as ApiError).message);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData();
  }, []);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_products`, JSON.stringify(products));
    localStorage.setItem(`${STORAGE_KEY}_materials`, JSON.stringify(materials));
    localStorage.setItem(`${STORAGE_KEY}_recipes`, JSON.stringify(recipes));
    localStorage.setItem(`${STORAGE_KEY}_production`, JSON.stringify(productionOrders));
    localStorage.setItem(`${STORAGE_KEY}_sales`, JSON.stringify(sales));
    localStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(customers));
    localStorage.setItem(`${STORAGE_KEY}_suppliers`, JSON.stringify(suppliers));
    localStorage.setItem(`${STORAGE_KEY}_purchases`, JSON.stringify(purchases));
    localStorage.setItem(`${STORAGE_KEY}_losses`, JSON.stringify(losses));
    localStorage.setItem(`${STORAGE_KEY}_cash`, JSON.stringify(cashTransactions));
    localStorage.setItem(`${STORAGE_KEY}_custom_orders`, JSON.stringify(customOrders));
    localStorage.setItem(`${STORAGE_KEY}_company`, JSON.stringify(company));
    localStorage.setItem(`${STORAGE_KEY}_stock_movements`, JSON.stringify(stockMovements));
  }, [products, materials, recipes, productionOrders, sales, customers, suppliers, purchases, losses, cashTransactions, customOrders, company, stockMovements]);

  // Implémentation des opérations CRUD synchronisées avec l'API
  const addProduct = async (product: Omit<Product, 'id'>) => {
    const id = `prod-${Date.now()}`;
    const newProduct = { ...product, id };
    try {
      await api.post('/api/catalog/products', newProduct);
      setProducts(prev => [...prev, newProduct]);
      setNotification('Produit ajouté avec succès');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const existing = products.find(p => p.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    try {
      await api.put(`/api/catalog/products/${id}`, updated);
      setProducts(prev => prev.map(p => p.id === id ? updated : p));
      setNotification('Produit mis à jour');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.del(`/api/catalog/products/${id}`);
      setProducts(prev => prev.filter(p => p.id !== id));
      setNotification('Produit supprimé');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  // Matières premières
  const addMaterial = async (material: Omit<RawMaterial, 'id'>) => {
    const id = `mat-${Date.now()}`;
    const newMaterial = { ...material, id };
    try {
      await api.post('/api/catalog/materials', newMaterial);
      setMaterials(prev => [...prev, newMaterial]);
      setNotification('Matière première ajoutée');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  const updateMaterial = async (id: string, updates: Partial<RawMaterial>) => {
    const existing = materials.find(m => m.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    try {
      await api.put(`/api/catalog/materials/${id}`, updated);
      setMaterials(prev => prev.map(m => m.id === id ? updated : m));
      setNotification('Matière première mise à jour');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  const deleteMaterial = async (id: string) => {
    try {
      await api.del(`/api/catalog/materials/${id}`);
      setMaterials(prev => prev.filter(m => m.id !== id));
      setNotification('Matière première supprimée');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  const adjustMaterialStock = async (id: string, delta: number, reason: string) => {
    const existing = materials.find(m => m.id === id);
    if (!existing) return;
    const updated = { ...existing, currentStock: existing.currentStock + delta };
    try {
      await api.put(`/api/catalog/materials/${id}`, updated);
      setMaterials(prev => prev.map(m => m.id === id ? updated : m));
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  // Recettes
  const addRecipe = async (recipe: Omit<Recipe, 'id'>) => {
    const id = `rec-${Date.now()}`;
    const newRecipe = { ...recipe, id };
    try {
      await api.post('/api/catalog/recipes', newRecipe);
      setRecipes(prev => [...prev, newRecipe]);
      setNotification('Recette ajoutée');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  const updateRecipe = async (id: string, updates: Partial<Recipe>) => {
    const existing = recipes.find(r => r.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    try {
      await api.put(`/api/catalog/recipes/${id}`, updated);
      setRecipes(prev => prev.map(r => r.id === id ? updated : r));
      setNotification('Recette mise à jour');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  const deleteRecipe = async (id: string) => {
    try {
      await api.del(`/api/catalog/recipes/${id}`);
      setRecipes(prev => prev.filter(r => r.id !== id));
      setNotification('Recette supprimée');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  // Clients
  const addCustomer = async (customer: Omit<Customer, 'id' | 'loyaltyPoints' | 'creditBalance'>) => {
    const id = `cus-${Date.now()}`;
    const newCustomer = { ...customer, id, loyaltyPoints: 0, creditBalance: 0 };
    try {
      await api.post('/api/catalog/customers', newCustomer);
      setCustomers(prev => [...prev, newCustomer]);
      setNotification('Client ajouté');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    const existing = customers.find(c => c.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    try {
      await api.put(`/api/catalog/customers/${id}`, updated);
      setCustomers(prev => prev.map(c => c.id === id ? updated : c));
      setNotification('Client mis à jour');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      await api.del(`/api/catalog/customers/${id}`);
      setCustomers(prev => prev.filter(c => c.id !== id));
      setNotification('Client supprimé');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  const payCustomerCredit = async (customerId: string, amount: number) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    const updated = { ...customer, creditBalance: customer.creditBalance - amount };
    try {
      await api.put(`/api/catalog/customers/${customerId}`, updated);
      setCustomers(prev => prev.map(c => c.id === customerId ? updated : c));
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  // Fournisseurs
  const addSupplier = async (supplier: Omit<Supplier, 'id' | 'pendingBalance'>) => {
    const id = `sup-${Date.now()}`;
    const newSupplier = { ...supplier, id, pendingBalance: 0 };
    try {
      await api.post('/api/catalog/suppliers', newSupplier);
      setSuppliers(prev => [...prev, newSupplier]);
      setNotification('Fournisseur ajouté');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    const existing = suppliers.find(s => s.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    try {
      await api.put(`/api/catalog/suppliers/${id}`, updated);
      setSuppliers(prev => prev.map(s => s.id === id ? updated : s));
      setNotification('Fournisseur mis à jour');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      await api.del(`/api/catalog/suppliers/${id}`);
      setSuppliers(prev => prev.filter(s => s.id !== id));
      setNotification('Fournisseur supprimé');
    } catch (err) {
      setNotification(`Erreur: ${(err as ApiError).message}`);
    }
  };

  // Flash notification helper
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  /**
   * Journalise un mouvement de stock de matière première (audit des écarts).
   * Centralise la traçabilité : toute variation de stock doit passer par ici.
   */
  const journalizeStockMovement = (
    movements: Omit<StockMovement, 'id' | 'date'>[]
  ) => {
    if (movements.length === 0) return;
    const now = new Date().toISOString();
    const recorded: StockMovement[] = movements.map((m, idx) => ({
      ...m,
      id: `mv-${Date.now()}-${idx}`,
      date: now,
    }));
    setStockMovements((prev) => [...recorded, ...prev]);
  };

  // Currency Formatter
  const formatMoney = (amountInXOF: number): string => {
    if (currency === 'EUR') {
      const eur = amountInXOF / 655.957;
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(eur);
    }
    // XOF (FCFA)
    return `${new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    }).format(Math.round(amountInXOF))} FCFA`;
  };
}
showToast(`Stock ajusté (${delta > 0 ? '+' : ''}${delta}) : ${reason}`);
  };

// RECIPES CRUD
const addRecipe = (recipe: Omit<Recipe, 'id'>) => {
  const newRecipe: Recipe = {
    ...recipe,
    id: `rec-${Date.now()}`,
  };
  setRecipes((prev) => [newRecipe, ...prev]);
  // Link to product if product exists
  if (recipe.productId) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === recipe.productId
          ? { ...p, recipeId: newRecipe.id, costPrice: newRecipe.costPerUnit }
          : p
      )
    );
  }
  showToast(`Fiche Recette "${newRecipe.name}" créée.`);
};

const updateRecipe = (id: string, updates: Partial<Recipe>) => {
  setRecipes((prev) =>
    prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
  );
  showToast('Fiche recette mise à jour.');
};

const deleteRecipe = (id: string) => {
  setRecipes((prev) => prev.filter((r) => r.id !== id));
  showToast('Fiche recette supprimée.');
};

// PRODUCTION MANAGEMENT
const createProductionOrder = (data: {
  recipeId: string;
  batchMultiplier: number;
  shift: 'Matin (04h30)' | 'Midi (11h00)' | 'Soir (16h00)';
  bakerName: string;
  notes?: string;
}) => {
  const recipe = recipes.find((r) => r.id === data.recipeId);
  if (!recipe) return;

  const count = productionOrders.length + 1;
  const code = `OF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count).padStart(2, '0')}`;
  const targetQuantity = recipe.outputYield * data.batchMultiplier;

  const newOrder: ProductionOrder = {
    id: `of-${Date.now()}`,
    code,
    recipeId: recipe.id,
    recipeName: recipe.name,
    productId: recipe.productId,
    productName: recipe.productName,
    batchMultiplier: data.batchMultiplier,
    targetQuantity,
    status: 'planifie',
    scheduledTime: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    bakerName: data.bakerName,
    shift: data.shift,
    storeId: writeStoreId,
    notes: data.notes,
  };

  setProductionOrders((prev) => [newOrder, ...prev]);
  showToast(`Ordre de Fabrication ${code} créé (${targetQuantity} pièces).`);
};

const updateProductionStatus = (orderId: string, newStatus: ProductionStatus) => {
  const order = productionOrders.find((o) => o.id === orderId);
  if (!order) return;

  // Check if transition to 'pret_en_rayon'
  if (newStatus === 'pret_en_rayon' && order.status !== 'pret_en_rayon') {
    const recipe = recipes.find((r) => r.id === order.recipeId);
    const actualQty = order.actualQuantity || order.targetQuantity;

    // 🔒 PHASE 2.4 : Vérification des lots périmés AVANT consommation
    if (recipe) {
      // Vérifie TOUS les ingrédients nécessaires avant de commencer la consommation
      const expiredMaterials: string[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      recipe.ingredients.forEach(ing => {
        const mat = materials.find(m => m.id === ing.materialId);
        if (mat?.expiryDate) {
          const expiry = new Date(mat.expiryDate);
          if (expiry < today) {
            expiredMaterials.push(`${mat.name} (lot ${mat.batchNumber || 'inconnu'}, DLC: ${mat.expiryDate})`);
          }
        }
      });

      // BLOCAGE si un lot est périmé
      if (expiredMaterials.length > 0) {
        showToast(`❌ Impossible de finaliser : Lots périmés détectés : ${expiredMaterials.join(', ')}`);
        return; // Arrête l'exécution, ne consomme rien
      }

      // 1. Deduce raw materials based on recipe ingredients * batchMultiplier
      setMaterials((prev) =>
        prev.map((mat) => {
          const ing = recipe.ingredients.find((i) => i.materialId === mat.id);
          if (ing) {
            const consumed = ing.quantity * order.batchMultiplier;
            return {
              ...mat,
              currentStock: Math.max(0, Number((mat.currentStock - consumed).toFixed(2))),
            };
          }
          return mat;
        })
      );

      // Journaliser la consommation de matières premières pour cette fournée
      journalizeStockMovement(
        recipe.ingredients
          .map((ing) => {
            const mat = materials.find((m) => m.id === ing.materialId);
            if (!mat) return null;
            const consumed = ing.quantity * order.batchMultiplier;
            return {
              materialId: mat.id,
              materialName: mat.name,
              delta: -consumed,
              resultingStock: Math.max(0, Number((mat.currentStock - consumed).toFixed(2))),
              unit: mat.unit,
              source: 'production' as const,
              reference: order.code,
              recordedBy: order.bakerName,
              storeId: order.storeId,
            };
          })
          .filter((m): m is NonNullable<typeof m> => m !== null)
      );
    }

    // 2. Increment product stock
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === order.productId) {
          return {
            ...p,
            stock: p.stock + actualQty,
          };
        }
        return p;
      })
    );

    showToast(`Fournée ${order.code} terminée ! +${actualQty} ${order.productName} ajoutés au stock rayon.`);
  }

  setProductionOrders((prev) =>
    prev.map((o) =>
      o.id === orderId
        ? {
          ...o,
          status: newStatus,
          completedTime:
            newStatus === 'pret_en_rayon'
              ? new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              : o.completedTime,
        }
        : o
    )
  );
};

// POS & SALES
const completeSale = (saleData: {
  cart: CartItem[];
  paymentMethod: PaymentMethod;
  amountPaid: number;
  customerId?: string;
  discountPercent?: number;
  notes?: string;
}): Sale => {
  const subtotal = saleData.cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discountAmount = saleData.discountPercent
    ? Math.round((subtotal * saleData.discountPercent) / 100)
    : 0;
  const total = subtotal - discountAmount;
  const changeReturned = Math.max(0, saleData.amountPaid - total);

  // Numérotation de facture séquentielle, non réutilisable.
  // Elle s'appuie sur le compteur persistant des ventes pour rester
  // continue et traçable côté fiscal.
  const receiptNumber = buildReceiptNumber(sales.length + 1);

  const matchedCustomer = customers.find((c) => c.id === saleData.customerId);

  // Ventilation de TVA par ligne : les prix en caisse sont TTC, on extrait
  // la TVA contenue selon le taux propre à chaque produit (source de vérité),
  // après répartition de la remise au prorata des lignes.
  const discountRatio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 1;
  const vatBreakdown = computeVatBreakdown(
    saleData.cart
      .filter((item) => item.product.price > 0 || item.quantity > 0)
      .map((item) => ({
        amount: item.product.price * item.quantity * discountRatio,
        vatRate: item.product.vatRate,
      }))
  );

  const newSale: Sale = {
    id: `sale-${Date.now()}`,
    receiptNumber,
    date: new Date().toISOString(),
    items: saleData.cart.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      unitPrice: item.product.price,
      quantity: item.quantity,
      total: item.product.price * item.quantity,
    })),
    subtotal,
    discountAmount,
    vatAmount: vatBreakdown.vatAmount, // TVA réelle calculée par taux produit
    total,
    paymentMethod: saleData.paymentMethod,
    amountPaid: saleData.amountPaid,
    changeReturned,
    customerId: saleData.customerId,
    customerName: matchedCustomer?.name,
    cashierName: 'Caisse Principale',
    storeId: writeStoreId,
    status: 'paye',
  };

  // 1. Decrement products stock
  setProducts((prev) =>
    prev.map((prod) => {
      const inCart = saleData.cart.find((c) => c.product.id === prod.id);
      if (inCart) {
        return {
          ...prod,
          stock: Math.max(0, prod.stock - inCart.quantity),
        };
      }
      return prod;
    })
  );

  // 2. Handle customer loyalty or B2B credit
  if (saleData.customerId) {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === saleData.customerId) {
          const addedPoints = Math.floor(total / 100);
          const addedCredit = saleData.paymentMethod === 'credit_b2b' ? total : 0;
          return {
            ...c,
            loyaltyPoints: c.loyaltyPoints + addedPoints,
            creditBalance: c.creditBalance + addedCredit,
          };
        }
        return c;
      })
    );
  }

  // 3. Record in Cash Transactions if cash
  if (saleData.paymentMethod === 'especes') {
    const cashTx: CashTransaction = {
      id: `csh-${Date.now()}`,
      type: 'encaissement_vente',
      amount: total,
      description: `Encaissement Ticket ${receiptNumber}`,
      date: new Date().toISOString(),
      recordedBy: 'Caisse Principale',
      storeId: writeStoreId,
    };
    setCashTransactions((prev) => [cashTx, ...prev]);
  }

  setSales((prev) => [newSale, ...prev]);
  setLastCompletedSale(newSale);
  showToast(`Vente validée (${formatMoney(total)}) - Ticket ${receiptNumber}`);
  return newSale;
};

// CUSTOMER OPERATIONS
const addCustomer = async (customer: Omit<Customer, 'id' | 'loyaltyPoints' | 'creditBalance'>) => {
  const newCust: Customer = {
    ...customer,
    id: `cust-${Date.now()}`,
    loyaltyPoints: 0,
    creditBalance: 0,
  };
  try {
    await api.post('/api/catalog/customers', newCust);
    setCustomers((prev) => [newCust, ...prev]);
    showToast(`Client "${newCust.name}" enregistré.`);
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

const updateCustomer = async (id: string, updates: Partial<Customer>) => {
  try {
    await api.put(`/api/catalog/customers/${id}`, updates);
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
    showToast('Fiche client mise à jour.');
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

const deleteCustomer = async (id: string) => {
  try {
    await api.delete(`/api/catalog/customers/${id}`);
    setCustomers((prev) => prev.filter(c => c.id !== id));
    showToast('Client supprimé avec succès.');
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

const payCustomerCredit = async (customerId: string, amount: number) => {
  const customer = customers.find(c => c.id === customerId);
  if (!customer) return;

  const updatedCustomer = {
    creditBalance: Math.max(0, customer.creditBalance - amount)
  };

  try {
    await api.put(`/api/catalog/customers/${customerId}`, updatedCustomer);
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          return {
            ...c,
            ...updatedCustomer,
          };
        }
        return c;
      })
    );

    const cashTx: CashTransaction = {
      id: `csh-${Date.now()}`,
      type: 'encaissement_vente',
      amount,
      description: `Règlement Créance Client (${customerId})`,
      date: new Date().toISOString(),
      recordedBy: 'Comptabilité',
      storeId: writeStoreId,
    };
    await api.post('/api/operations/cash-transactions', cashTx);
    setCashTransactions((prev) => [cashTx, ...prev]);
    showToast(`Règlement de ${formatMoney(amount)} enregistré avec succès.`);
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

// SUPPLIERS & PURCHASES
const addSupplier = async (supplier: Omit<Supplier, 'id' | 'pendingBalance'>) => {
  const newSup: Supplier = {
    ...supplier,
    id: `sup-${Date.now()}`,
    pendingBalance: 0,
  };
  try {
    await api.post('/api/catalog/suppliers', newSup);
    setSuppliers((prev) => [newSup, ...prev]);
    showToast(`Fournisseur "${newSup.name}" ajouté.`);
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
  try {
    await api.put(`/api/catalog/suppliers/${id}`, updates);
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
    showToast('Fiche fournisseur mise à jour.');
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

const deleteSupplier = async (id: string) => {
  try {
    await api.delete(`/api/catalog/suppliers/${id}`);
    setSuppliers((prev) => prev.filter(s => s.id !== id));
    showToast('Fournisseur supprimé avec succès.');
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

const createPurchaseOrder = async (po: Omit<PurchaseOrder, 'id' | 'orderNumber' | 'date' | 'status'>) => {
  const count = purchases.length + 1;
  const orderNumber = `BC-2026-${String(count).padStart(4, '0')}`;
  const newPo: PurchaseOrder = {
    ...po,
    id: `po-${Date.now()}`,
    orderNumber,
    date: new Date().toISOString().slice(0, 10),
    status: 'commande',
  };
  try {
    await api.post('/api/operations/purchase-orders', newPo);
    setPurchases((prev) => [newPo, ...prev]);
    showToast(`Bon de commande ${orderNumber} généré auprès de ${po.supplierName}.`);
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

const receivePurchaseOrder = async (orderId: string) => {
  const order = purchases.find((p) => p.id === orderId);
  if (!order || order.status === 'recu') return;

  try {
    // Update purchase order status
    await api.put(`/api/operations/purchase-orders/${orderId}`, { status: 'recu' });

    // Increment raw material stocks
    setMaterials((prev) =>
      prev.map((mat) => {
        const item = order.items.find((i) => i.materialId === mat.id);
        if (item) {
          return {
            ...mat,
            currentStock: Number((mat.currentStock + item.quantity).toFixed(2)),
          };
        }
        return mat;
      })
    );

    // Journaliser chaque entrée de stock liée à cette réception
    journalizeStockMovement(
      order.items
        .map((item) => {
          const mat = materials.find((m) => m.id === item.materialId);
          if (!mat) return null;
          return {
            materialId: mat.id,
            materialName: mat.name,
            delta: item.quantity,
            resultingStock: Number((mat.currentStock + item.quantity).toFixed(2)),
            unit: mat.unit,
            source: 'reception_achat' as const,
            reference: order.orderNumber,
            recordedBy: 'Magasinier',
            storeId: writeStoreId,
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null)
    );

    // Update supplier pending balance
    const supplier = suppliers.find(s => s.id === order.supplierId);
    if (supplier) {
      const updatedSupplier = {
        pendingBalance: supplier.pendingBalance + order.totalAmount
      };
      await api.put(`/api/catalog/suppliers/${order.supplierId}`, updatedSupplier);
      setSuppliers((prev) =>
        prev.map((sup) =>
          sup.id === order.supplierId
            ? { ...sup, ...updatedSupplier }
            : sup
        )
      );
    }

    setPurchases((prev) =>
      prev.map((p) => (p.id === orderId ? { ...p, status: 'recu' } : p))
    );

    showToast(`Réception validée pour le bon ${order.orderNumber} ! Stocks réapprovisionnés.`);
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

const paySupplier = async (supplierId: string, amount: number) => {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) return;

  const updatedSupplier = {
    pendingBalance: Math.max(0, supplier.pendingBalance - amount)
  };

  try {
    await api.put(`/api/catalog/suppliers/${supplierId}`, updatedSupplier);
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === supplierId
          ? { ...s, ...updatedSupplier }
          : s
      )
    );

    const cashTx: CashTransaction = {
      id: `csh-${Date.now()}`,
      type: 'depense_imprevue',
      amount,
      description: `Paiement Facture Fournisseur (${supplierId})`,
      date: new Date().toISOString(),
      recordedBy: 'Direction',
      storeId: writeStoreId,
    };
    await api.post('/api/operations/cash-transactions', cashTx);
    setCashTransactions((prev) => [cashTx, ...prev]);
    showToast(`Paiement de ${formatMoney(amount)} transmis au fournisseur.`);
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

// LOSSES & CASH
const addLossRecord = async (record: Omit<LossRecord, 'id' | 'date'>) => {
  const newLoss: LossRecord = {
    ...record,
    id: `loss-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
  };
  try {
    await api.post('/api/operations/losses', newLoss);
    setLosses((prev) => [newLoss, ...prev]);

    // If associated with a product, deduct from stock
    if (record.productId) {
      const product = products.find(p => p.id === record.productId);
      if (product) {
        const updatedProduct = {
          stock: Math.max(0, product.stock - record.quantity)
        };
        await api.put(`/api/catalog/products/${record.productId}`, updatedProduct);
        setProducts((prev) =>
          prev.map((p) =>
            p.id === record.productId
              ? { ...p, ...updatedProduct }
              : p
          )
        );
      }
    }
    showToast(`Perte enregistrée : ${record.quantity} ${record.unit} (${formatMoney(record.lossValue)}).`);
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

const addCashTransaction = async (tx: Omit<CashTransaction, 'id' | 'date'>) => {
  const newTx: CashTransaction = {
    ...tx,
    id: `csh-${Date.now()}`,
    date: new Date().toISOString(),
  };
  try {
    await api.post('/api/operations/cash-transactions', newTx);
    setCashTransactions((prev) => [newTx, ...prev]);
    showToast(`Mouvement de caisse enregistré : ${formatMoney(tx.amount)}`);
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

const deleteCashTransaction = async (id: string) => {
  try {
    await api.delete(`/api/operations/cash-transactions/${id}`);
    setCashTransactions((prev) => prev.filter(tx => tx.id !== id));
    showToast('Mouvement de caisse supprimé avec succès.');
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

const deleteLossRecord = async (id: string) => {
  try {
    await api.delete(`/api/operations/losses/${id}`);
    setLosses((prev) => prev.filter(l => l.id !== id));
    showToast('Perte supprimée avec succès.');
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

// CUSTOM ORDERS
const addCustomOrder = async (order: Omit<CustomOrder, 'id' | 'orderNumber' | 'status'>) => {
  const count = customOrders.length + 1;
  const orderNumber = `CMD-GATEAU-2026-${String(count).padStart(2, '0')}`;
  const newOrder: CustomOrder = {
    ...order,
    id: `ord-${Date.now()}`,
    orderNumber,
    status: 'commande',
  };
  try {
    await api.post('/api/operations/custom-orders', newOrder);
    setCustomOrders((prev) => [newOrder, ...prev]);

    // Record deposit in cash if deposit paid
    if (order.depositPaid > 0) {
      const depositTx: CashTransaction = {
        id: `csh-${Date.now()}`,
        type: 'encaissement_vente',
        amount: order.depositPaid,
        description: `Acompte Commande Gâteau ${orderNumber} (${order.clientName})`,
        date: new Date().toISOString(),
        recordedBy: 'Caisse',
        storeId: order.storeId,
      };
      await api.post('/api/operations/cash-transactions', depositTx);
      setCashTransactions((prev) => [depositTx, ...prev]);
    }

    showToast(`Commande spéciale ${orderNumber} enregistrée avec acompte.`);
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

const updateCustomOrderStatus = async (id: string, status: CustomOrder['status']) => {
  try {
    await api.put(`/api/operations/custom-orders/${id}`, { status });
    setCustomOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
    showToast(`Statut de la commande gâteau mis à jour : ${status}`);
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

const deleteCustomOrder = async (id: string) => {
  try {
    await api.delete(`/api/operations/custom-orders/${id}`);
    setCustomOrders((prev) => prev.filter(o => o.id !== id));
    showToast('Commande spéciale supprimée avec succès.');
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

const deleteSale = async (id: string) => {
  try {
    await api.delete(`/api/operations/sales/${id}`);
    setSales((prev) => prev.filter(s => s.id !== id));
    showToast('Vente supprimée avec succès.');
  } catch (err) {
    setNotification(`Erreur: ${(err as ApiError).message}`);
  }
};

// COMPANY LEGAL & FISCAL SETTINGS
const updateCompany = (updates: Partial<CompanySettings>) => {
  setCompany((prev) => {
    const next = { ...prev, ...updates };
    // La devise d'affichage est portée par les paramètres de l'entreprise :
    // on la synchronise pour que le sélecteur d'en-tête et le reste de l'app
    // restent cohérents avec le paramétrage.
    if (updates.currency !== undefined) {
      setCurrency(updates.currency);
    }
    return next;
  });
  showToast('Paramètres de l’entreprise enregistrés.');
};

// SYSTEM RESET & BACKUP
const resetToDemoData = () => {
  setProducts(INITIAL_PRODUCTS);
  setMaterials(INITIAL_MATERIALS);
  setRecipes(INITIAL_RECIPES);
  setProductionOrders(INITIAL_PRODUCTION_ORDERS);
  setSales(INITIAL_SALES);
  setCustomers(INITIAL_CUSTOMERS);
  setSuppliers(INITIAL_SUPPLIERS);
  setPurchases(INITIAL_PURCHASE_ORDERS);
  setLosses(INITIAL_LOSSES);
  setCashTransactions(INITIAL_CASH_TRANSACTIONS);
  setCustomOrders(INITIAL_CUSTOM_ORDERS);
  setCompany(INITIAL_COMPANY_SETTINGS);
  setStockMovements([]);
  localStorage.clear();
  showToast('Données de démonstration réinitialisées avec succès.');
};

const exportBackupJson = () => {
  const backup = {
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
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BoulangeriePro_Sauvegarde_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Sauvegarde JSON téléchargée.');
};

const importBackupJson = (jsonData: string): boolean => {
  try {
    const data = JSON.parse(jsonData);
    if (data.products && data.materials) {
      if (data.products) setProducts(data.products);
      if (data.materials) setMaterials(data.materials);
      if (data.recipes) setRecipes(data.recipes);
      if (data.productionOrders) setProductionOrders(data.productionOrders);
      if (data.sales) setSales(data.sales);
      if (data.customers) setCustomers(data.customers);
      if (data.suppliers) setSuppliers(data.suppliers);
      if (data.purchases) setPurchases(data.purchases);
      if (data.losses) setLosses(data.losses);
      if (data.cashTransactions) setCashTransactions(data.cashTransactions);
      if (data.customOrders) setCustomOrders(data.customOrders);
      if (data.company) setCompany({ ...INITIAL_COMPANY_SETTINGS, ...data.company });
      if (data.stockMovements) setStockMovements(data.stockMovements);
      showToast('Données restaurées avec succès.');
      return true;
    }
    return false;
  } catch {
    showToast('Fichier JSON invalide.');
    return false;
  }
};

return (
  <BakeryContext.Provider
    value={{
      activeTab,
      setActiveTab,
      currentStoreId,
      setCurrentStoreId,
      currency,
      setCurrency,
      formatMoney,
      stores,
      writeStoreId,
      company,
      updateCompany,
      stockMovements,
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
      addProduct,
      updateProduct,
      deleteProduct,
      addMaterial,
      updateMaterial,
      deleteMaterial,
      adjustMaterialStock,
      addRecipe,
      updateRecipe,
      deleteRecipe,
      createProductionOrder,
      updateProductionStatus,
      completeSale,
      lastCompletedSale,
      setLastCompletedSale,
      addCustomer,
      updateCustomer,
      payCustomerCredit,
      addSupplier,
      createPurchaseOrder,
      receivePurchaseOrder,
      paySupplier,
      addLossRecord,
      addCashTransaction,
      addCustomOrder,
      updateCustomOrderStatus,
      deleteCustomOrder,
      deleteSale,
      deleteCustomer,
      deleteSupplier,
      deleteCashTransaction,
      deleteLossRecord,
      notification,
      setNotification,
      isMobileMenuOpen,
      setIsMobileMenuOpen,
      resetToDemoData,
      exportBackupJson,
      importBackupJson,
    }}
  >
    {children}
  </BakeryContext.Provider>
);
};

export const useBakery = (): BakeryContextType => {
  const context = useContext(BakeryContext);
  if (!context) {
    throw new Error('useBakery must be used within a BakeryProvider');
  }
  return context;
};