export type ProductCategory = 
  | 'pains' 
  | 'viennoiseries' 
  | 'patisseries' 
  | 'snacking' 
  | 'boissons' 
  | 'traiteur';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  price: number; // in current primary currency (e.g. FCFA)
  costPrice: number; // estimated production cost
  vatRate: number; // percentage, e.g., 0% or 18%
  stock: number;
  minStock: number;
  unit: string;
  barcode?: string;
  imageIcon: string;
  description: string;
  recipeId?: string;
  storeId: string;
  isActive: boolean;
}

export interface RawMaterial {
  id: string;
  code: string;
  name: string;
  category: 'farines' | 'produits_laitiers' | 'sucres_aromes' | 'levures_ameliorants' | 'emballages' | 'garnitures';
  currentStock: number;
  unit: 'kg' | 'g' | 'L' | 'ml' | 'unite' | 'sac_50kg';
  minStockAlert: number;
  unitCost: number; // cost per standard unit (e.g. per kg or unit)
  supplierId: string;
  batchNumber?: string;
  expiryDate?: string;
  location?: string;
}

export interface RecipeIngredient {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  cost: number;
}

export interface Recipe {
  id: string;
  name: string;
  productId: string;
  productName: string;
  outputYield: number; // e.g. 50 baguettes per batch
  outputUnit: string;
  ingredients: RecipeIngredient[];
  preparationTimeMin: number;
  proofingTimeMin: number; // temps de pointage / pousse
  bakingTimeMin: number;
  bakingTempC: number;
  instructions: string[];
  totalCost: number;
  costPerUnit: number;
}

export type ProductionStatus = 'planifie' | 'petrissage' | 'au_four' | 'pret_en_rayon' | 'annule';

export interface ProductionOrder {
  id: string;
  code: string;
  recipeId: string;
  recipeName: string;
  productId: string;
  productName: string;
  batchMultiplier: number;
  targetQuantity: number;
  actualQuantity?: number;
  status: ProductionStatus;
  scheduledTime: string;
  completedTime?: string;
  bakerName: string;
  shift: 'Matin (04h30)' | 'Midi (11h00)' | 'Soir (16h00)';
  storeId: string;
  notes?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountPercent?: number;
  customPrice?: number;
  notes?: string;
}

export type PaymentMethod = 'especes' | 'wave' | 'orange_money' | 'mtn_money' | 'carte' | 'credit_b2b';

export interface SaleItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  date: string;
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeReturned: number;
  customerId?: string;
  customerName?: string;
  cashierName: string;
  storeId: string;
  status: 'paye' | 'en_attente' | 'rembourse';
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  type: 'particulier' | 'b2b_hotel' | 'b2b_restaurant' | 'b2b_revendeur';
  address?: string;
  loyaltyPoints: number;
  creditBalance: number; // outstanding debt to the bakery
  creditLimit: number;
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  suppliedMaterials: string[];
  paymentTerms: string;
  pendingBalance: number;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  status: 'brouillon' | 'commande' | 'recu' | 'paye';
  items: {
    materialId: string;
    materialName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }[];
  totalAmount: number;
  notes?: string;
}

export interface LossRecord {
  id: string;
  date: string;
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  lossValue: number;
  reason: 'invendu_veille' | 'brule_four' | 'defaut_forme' | 'casse_manutention' | 'perime' | 'autre';
  destination: 'poubelle' | 'chapelure' | 'don_caritatif' | 'alimentation_animale';
  storeId: string;
  recordedBy: string;
  notes?: string;
}

export interface CashTransaction {
  id: string;
  type: 'fond_ouverture' | 'encaissement_vente' | 'depense_imprevue' | 'retrait_banque' | 'cloture_z';
  amount: number;
  description: string;
  date: string;
  recordedBy: string;
  storeId: string;
}

export interface CustomOrder {
  id: string;
  orderNumber: string;
  clientName: string;
  phone: string;
  cakeType: string;
  servingCount: number;
  flavor: string;
  customInscription: string;
  themeColor: string;
  pickupDate: string;
  pickupTime: string;
  totalPrice: number;
  depositPaid: number;
  status: 'commande' | 'en_preparation' | 'pret' | 'livre';
  storeId: string;
  notes?: string;
}

export interface Store {
  id: string;
  name: string;
  location: string;
  phone: string;
  managerName: string;
  isMain: boolean;
}

export type CurrencyCode = 'XOF' | 'EUR';
