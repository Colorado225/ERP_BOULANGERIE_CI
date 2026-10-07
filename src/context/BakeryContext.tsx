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
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  // Material Operations
  addMaterial: (material: Omit<RawMaterial, 'id'>) => void;
  updateMaterial: (id: string, updates: Partial<RawMaterial>) => void;
  deleteMaterial: (id: string) => void;
  adjustMaterialStock: (id: string, delta: number, reason: string) => void;

  // Recipe Operations
  addRecipe: (recipe: Omit<Recipe, 'id'>) => void;
  updateRecipe: (id: string, updates: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;

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
  addCustomer: (customer: Omit<Customer, 'id' | 'loyaltyPoints' | 'creditBalance'>) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  payCustomerCredit: (customerId: string, amount: number) => void;

  // Supplier & Purchasing
  addSupplier: (supplier: Omit<Supplier, 'id' | 'pendingBalance'>) => void;
  createPurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'orderNumber' | 'date' | 'status'>) => void;
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

export const BakeryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentStoreId, setCurrentStoreId] = useState<string>('store-1');
  const [currency, setCurrency] = useState<CurrencyCode>('XOF');
  const [notification, setNotification] = useState<string | null>(null);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Core Data States
  const [stores] = useState<Store[]>(INITIAL_STORES);
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
  }, [products, materials, recipes, productionOrders, sales, customers, suppliers, purchases, losses, cashTransactions, customOrders]);

  // Flash notification helper
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 4000);
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

  // PRODUCT CRUD
  const addProduct = (product: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...product,
      id: `prod-${Date.now()}`,
    };
    setProducts((prev) => [newProduct, ...prev]);
    showToast(`Produit "${newProduct.name}" créé avec succès.`);
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    showToast('Produit mis à jour.');
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    showToast('Produit supprimé.');
  };

  // RAW MATERIALS CRUD
  const addMaterial = (material: Omit<RawMaterial, 'id'>) => {
    const newMat: RawMaterial = {
      ...material,
      id: `mat-${Date.now()}`,
    };
    setMaterials((prev) => [newMat, ...prev]);
    showToast(`Matière première "${newMat.name}" enregistrée.`);
  };

  const updateMaterial = (id: string, updates: Partial<RawMaterial>) => {
    setMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
    showToast('Matière première mise à jour.');
  };

  const deleteMaterial = (id: string) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    showToast('Matière première supprimée.');
  };

  const adjustMaterialStock = (id: string, delta: number, reason: string) => {
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const newStock = Math.max(0, m.currentStock + delta);
          return { ...m, currentStock: newStock };
        }
        return m;
      })
    );
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
      storeId: currentStoreId === 'all' ? 'store-1' : currentStoreId,
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

      // 1. Deduce raw materials based on recipe ingredients * batchMultiplier
      if (recipe) {
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

    const receiptNumber = `TC-${Date.now().toString().slice(-8)}`;

    const matchedCustomer = customers.find((c) => c.id === saleData.customerId);

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
      vatAmount: Math.round(total * 0.05), // average estimated local VAT or 0%
      total,
      paymentMethod: saleData.paymentMethod,
      amountPaid: saleData.amountPaid,
      changeReturned,
      customerId: saleData.customerId,
      customerName: matchedCustomer?.name,
      cashierName: 'Caisse Principale',
      storeId: currentStoreId === 'all' ? 'store-1' : currentStoreId,
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
        storeId: currentStoreId === 'all' ? 'store-1' : currentStoreId,
      };
      setCashTransactions((prev) => [cashTx, ...prev]);
    }

    setSales((prev) => [newSale, ...prev]);
    setLastCompletedSale(newSale);
    showToast(`Vente validée (${formatMoney(total)}) - Ticket ${receiptNumber}`);
    return newSale;
  };

  // CUSTOMER OPERATIONS
  const addCustomer = (customer: Omit<Customer, 'id' | 'loyaltyPoints' | 'creditBalance'>) => {
    const newCust: Customer = {
      ...customer,
      id: `cust-${Date.now()}`,
      loyaltyPoints: 0,
      creditBalance: 0,
    };
    setCustomers((prev) => [newCust, ...prev]);
    showToast(`Client "${newCust.name}" enregistré.`);
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
    showToast('Fiche client mise à jour.');
  };

  const payCustomerCredit = (customerId: string, amount: number) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          return {
            ...c,
            creditBalance: Math.max(0, c.creditBalance - amount),
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
      storeId: currentStoreId === 'all' ? 'store-1' : currentStoreId,
    };
    setCashTransactions((prev) => [cashTx, ...prev]);
    showToast(`Règlement de ${formatMoney(amount)} enregistré avec succès.`);
  };

  // SUPPLIERS & PURCHASES
  const addSupplier = (supplier: Omit<Supplier, 'id' | 'pendingBalance'>) => {
    const newSup: Supplier = {
      ...supplier,
      id: `sup-${Date.now()}`,
      pendingBalance: 0,
    };
    setSuppliers((prev) => [newSup, ...prev]);
    showToast(`Fournisseur "${newSup.name}" ajouté.`);
  };

  const createPurchaseOrder = (po: Omit<PurchaseOrder, 'id' | 'orderNumber' | 'date' | 'status'>) => {
    const count = purchases.length + 1;
    const orderNumber = `BC-2026-${String(count).padStart(4, '0')}`;
    const newPo: PurchaseOrder = {
      ...po,
      id: `po-${Date.now()}`,
      orderNumber,
      date: new Date().toISOString().slice(0, 10),
      status: 'commande',
    };
    setPurchases((prev) => [newPo, ...prev]);
    showToast(`Bon de commande ${orderNumber} généré auprès de ${po.supplierName}.`);
  };

  const receivePurchaseOrder = (orderId: string) => {
    const order = purchases.find((p) => p.id === orderId);
    if (!order || order.status === 'recu') return;

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

    // Update supplier pending balance
    setSuppliers((prev) =>
      prev.map((sup) =>
        sup.id === order.supplierId
          ? { ...sup, pendingBalance: sup.pendingBalance + order.totalAmount }
          : sup
      )
    );

    // Update purchase order status
    setPurchases((prev) =>
      prev.map((p) => (p.id === orderId ? { ...p, status: 'recu' } : p))
    );

    showToast(`Réception validée pour le bon ${order.orderNumber} ! Stocks réapprovisionnés.`);
  };

  const paySupplier = (supplierId: string, amount: number) => {
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === supplierId
          ? { ...s, pendingBalance: Math.max(0, s.pendingBalance - amount) }
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
      storeId: currentStoreId === 'all' ? 'store-1' : currentStoreId,
    };
    setCashTransactions((prev) => [cashTx, ...prev]);
    showToast(`Paiement de ${formatMoney(amount)} transmis au fournisseur.`);
  };

  // LOSSES & CASH
  const addLossRecord = (record: Omit<LossRecord, 'id' | 'date'>) => {
    const newLoss: LossRecord = {
      ...record,
      id: `loss-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
    };
    setLosses((prev) => [newLoss, ...prev]);

    // If associated with a product, deduct from stock
    if (record.productId) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === record.productId
            ? { ...p, stock: Math.max(0, p.stock - record.quantity) }
            : p
        )
      );
    }
    showToast(`Perte enregistrée : ${record.quantity} ${record.unit} (${formatMoney(record.lossValue)}).`);
  };

  const addCashTransaction = (tx: Omit<CashTransaction, 'id' | 'date'>) => {
    const newTx: CashTransaction = {
      ...tx,
      id: `csh-${Date.now()}`,
      date: new Date().toISOString(),
    };
    setCashTransactions((prev) => [newTx, ...prev]);
    showToast(`Mouvement de caisse enregistré : ${formatMoney(tx.amount)}`);
  };

  // CUSTOM ORDERS
  const addCustomOrder = (order: Omit<CustomOrder, 'id' | 'orderNumber' | 'status'>) => {
    const count = customOrders.length + 1;
    const orderNumber = `CMD-GATEAU-2026-${String(count).padStart(2, '0')}`;
    const newOrder: CustomOrder = {
      ...order,
      id: `ord-${Date.now()}`,
      orderNumber,
      status: 'commande',
    };
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
      setCashTransactions((prev) => [depositTx, ...prev]);
    }

    showToast(`Commande spéciale ${orderNumber} enregistrée avec acompte.`);
  };

  const updateCustomOrderStatus = (id: string, status: CustomOrder['status']) => {
    setCustomOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
    showToast(`Statut de la commande gâteau mis à jour : ${status}`);
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
