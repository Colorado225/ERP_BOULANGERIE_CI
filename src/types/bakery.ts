export type ProductCategory =
  | "pains"
  | "viennoiseries"
  | "patisseries"
  | "snacking"
  | "boissons"
  | "traiteur";

// Interface pour un lot de produit fini (Phase 2.4 - Traçabilité DLC)
export interface ProductBatch {
  id: string;
  productId: string;
  batchNumber: string; // Numéro de lot de production
  productionDate: string; // Date de fabrication
  expiryDate: string; // DLC - Date Limite de Consommation
  quantity: number; // Quantité dans ce lot
  location?: string; // Emplacement en magasin
  isBlocked: boolean; // Blocage si expiré / non conforme
  createdAt: string;
}

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
  batches: ProductBatch[]; // Lots de production (Phase 2.4)
}

export interface RawMaterial {
  id: string;
  code: string;
  name: string;
  category:
    | "farines"
    | "produits_laitiers"
    | "sucres_aromes"
    | "levures_ameliorants"
    | "emballages"
    | "garnitures";
  currentStock: number;
  unit: "kg" | "g" | "L" | "ml" | "unite" | "sac_50kg";
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

export type ProductionStatus =
  | "planifie"
  | "petrissage"
  | "au_four"
  | "pret_en_rayon"
  | "annule";

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
  shift: "Matin (04h30)" | "Midi (11h00)" | "Soir (16h00)";
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

export type PaymentMethod =
  | "especes"
  | "wave"
  | "orange_money"
  | "mtn_money"
  | "carte"
  | "credit_b2b";

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
  status: "paye" | "en_attente" | "rembourse";
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  type: "particulier" | "b2b_hotel" | "b2b_restaurant" | "b2b_revendeur";
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
  status: "brouillon" | "commande" | "recu" | "paye";
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
  reason:
    | "invendu_veille"
    | "brule_four"
    | "defaut_forme"
    | "casse_manutention"
    | "perime"
    | "autre";
  destination:
    | "poubelle"
    | "chapelure"
    | "don_caritatif"
    | "alimentation_animale";
  storeId: string;
  recordedBy: string;
  notes?: string;
}

export interface CashTransaction {
  id: string;
  type:
    | "fond_ouverture"
    | "encaissement_vente"
    | "depense_imprevue"
    | "retrait_banque"
    | "cloture_z";
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
  status: "commande" | "en_preparation" | "pret" | "livre";
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

export type CurrencyCode = "XOF" | "EUR";

/** Origine d'un mouvement de stock de matière première. */
export type StockMovementSource =
  | "vente"
  | "production"
  | "reception_achat"
  | "perte"
  | "ajustement_manuel"
  | "inventaire";

/**
 * Mouvement de stock d'une matière première.
 * Chaque variation de stock (entrée ou sortie) doit être journalisée pour
 * permettre l'audit des écarts et la traçabilité des consommations.
 */
export interface StockMovement {
  id: string;
  /** Matière première concernée. */
  materialId: string;
  materialName: string;
  /** Variation du stock : négatif pour une sortie, positif pour une entrée. */
  delta: number;
  /** Stock après application du mouvement. */
  resultingStock: number;
  /** Unité de la matière première au moment du mouvement. */
  unit: string;
  /** Cause du mouvement. */
  source: StockMovementSource;
  /** Référence de l'objet déclencheur (n° OF, n° BC, n° ticket…). */
  reference?: string;
  /** Motif libre (obligatoire pour un ajustement manuel). */
  reason?: string;
  /** Auteur du mouvement. */
  recordedBy: string;
  /** Boutique concernée. */
  storeId: string;
  /** Horodatage ISO. */
  date: string;
}

/**
 * Paramètres légaux et fiscaux de l'entreprise, affichés sur les tickets
 * et utilisés pour la facturation conforme à la réglementation ivoirienne.
 */
export interface CompanySettings {
  /** Enseigne commerciale affichée sur les documents. */
  establishmentName: string;
  /** Numéro RCCM (Registre du Commerce et du Crédit Mobilier). */
  rccm: string;
  /** Numéro de Compte Contribuable (CC) délivré par la DGI. */
  taxpayerAccount: string;
  /** Taux de TVA par défaut appliqué à la création d'un produit (en %). */
  defaultVatRate: number;
  /** Devise d'affichage. Le FCFA reste la devise de facturation. */
  currency: CurrencyCode;
}
