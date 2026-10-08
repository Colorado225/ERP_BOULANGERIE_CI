/**
 * Service de gestion des paiements Mobile Money ivoiriens (Phase 3.1)
 * Opérateurs supportés : Wave, Orange Money CI, MTN MoMo
 * MEILLEURES PRATIQUES :
 * - Normalisation des numéros de téléphone (+225)
 * - Calcul des frais opérateurs conformes aux tarifs locaux
 * - Gestion des webhooks pour mise à jour automatique des statuts
 * - Reconciliation automatique des transactions avec les ventes
 * - Journalisation sécurisée des paiements (conformité DGI)
 */

import { Sale } from "../types/bakery";

// Opérateurs Mobile Money ivoiriens
export enum MobileMoneyOperator {
  WAVE = "WAVE",
  ORANGE_MONEY = "ORANGE_MONEY",
  MTN_MOMO = "MTN_MOMO",
}

// Statuts des transactions
export enum MobileMoneyTransactionStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

// Interface de transaction Mobile Money
export interface MobileMoneyTransaction {
  id: string;
  saleId: string; // Lien avec la vente dans le système
  operator: MobileMoneyOperator;
  phoneNumber: string; // Numéro normalisé (+225XXXXXXXX)
  amount: number; // Montant total de la vente (FCFA)
  fee: number; // Frais opérateur prélevés
  netAmount: number; // Montant net reçu par la boulangerie
  status: MobileMoneyTransactionStatus;
  failureReason?: string;
  operatorTransactionId?: string; // ID de transaction chez l'opérateur
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// Configuration des frais par opérateur (tarifs 2026 CI)
const OPERATOR_FEES: Record<
  MobileMoneyOperator,
  { percentage: number; min: number; max: number }
> = {
  [MobileMoneyOperator.WAVE]: { percentage: 1.0, min: 50, max: 5000 }, // 1% frais Wave
  [MobileMoneyOperator.ORANGE_MONEY]: { percentage: 1.5, min: 100, max: 7500 }, // 1.5% Orange Money
  [MobileMoneyOperator.MTN_MOMO]: { percentage: 1.3, min: 75, max: 6500 }, // 1.3% MTN MoMo
};

// URLs des API des opérateurs (sandbox pour développement, depuis variables d'environnement)
const OPERATOR_API_URLS: Record<MobileMoneyOperator, string> = {
  [MobileMoneyOperator.WAVE]:
    import.meta.env.VITE_WAVE_API_URL ||
    "https://api.wave.com/sandbox/v1/transactions",
  [MobileMoneyOperator.ORANGE_MONEY]:
    import.meta.env.VITE_OM_API_URL ||
    "https://api.orange.com/orange-money-ci/sandbox/v1/payments",
  [MobileMoneyOperator.MTN_MOMO]:
    import.meta.env.VITE_MTN_API_URL ||
    "https://api.mtn.com/momo-ci/sandbox/v1/collections",
};

export class MobileMoneyManager {
  private static instance: MobileMoneyManager;
  private transactions: Map<string, MobileMoneyTransaction> = new Map();
  private apiKeys: Record<MobileMoneyOperator, string | null> = {
    [MobileMoneyOperator.WAVE]: null,
    [MobileMoneyOperator.ORANGE_MONEY]: null,
    [MobileMoneyOperator.MTN_MOMO]: null,
  };
  private dbInitialized: boolean = false;
  private dbName: string = "BoulangerieMobileMoneyDB";
  private storeName: string = "transactions";
  private eventSource: EventSource | null = null; // Connexion SSE pour mises à jour en temps réel

  private constructor() {
    // Chargement des clés API depuis les variables d'environnement
    if (import.meta.env.VITE_WAVE_API_KEY)
      this.apiKeys.WAVE = import.meta.env.VITE_WAVE_API_KEY;
    if (import.meta.env.VITE_OM_API_KEY)
      this.apiKeys.ORANGE_MONEY = import.meta.env.VITE_OM_API_KEY;
    if (import.meta.env.VITE_MTN_API_KEY)
      this.apiKeys.MTN_MOMO = import.meta.env.VITE_MTN_API_KEY;

    // Initialiser la base IndexedDB pour persistance hors ligne
    this.initDB();

    // Se connecter au flux SSE pour recevoir les mises à jour de statut en temps réel
    this.initSSEConnection();

    // Écouter les changements d'état réseau
    window.addEventListener("online", this.handleOnline.bind(this));
    window.addEventListener("offline", () => this.closeSSEConnection());
  }

  /**
   * Initialiser la connexion SSE pour recevoir les mises à jour webhook en temps réel
   */
  private initSSEConnection(): void {
    if (this.eventSource) return;

    try {
      this.eventSource = new EventSource("/api/sse/mobilemoney");

      this.eventSource.onmessage = (event) => {
        const update = JSON.parse(event.data);
        this.handleRealTimeUpdate(update);
      };

      this.eventSource.onerror = (error) => {
        console.error("Erreur connexion SSE Mobile Money:", error);
        this.closeSSEConnection();
        // Tentative de reconnexion après 5s
        setTimeout(() => this.initSSEConnection(), 5000);
      };

      console.log("Connexion SSE Mobile Money établie");
    } catch (error) {
      console.error("Impossible d'initialiser la connexion SSE:", error);
    }
  }

  /**
   * Fermer la connexion SSE
   */
  private closeSSEConnection(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log("Connexion SSE Mobile Money fermée");
    }
  }

  /**
   * Traiter une mise à jour en temps réel reçue via SSE
   */
  private async handleRealTimeUpdate(update: any): Promise<void> {
    const { operator, transactionId, status, reason } = update;

    // Traduire le statut de l'opérateur vers notre format webhook
    const webhookPayload = {
      externalId: transactionId,
      status:
        status === "SUCCESS"
          ? "SUCCESS"
          : status === "FAILED"
            ? "FAILED"
            : "PENDING",
      reason,
    };

    // Utiliser la méthode webhook existante pour mettre à jour la transaction
    await this.handleOperatorWebhook(
      operator as MobileMoneyOperator,
      webhookPayload,
    );
  }

  /**
   * Nettoyer les ressources quand le manager n'est plus nécessaire
   */
  public destroy(): void {
    this.closeSSEConnection();
    window.removeEventListener("online", this.handleOnline.bind(this));
    window.removeEventListener("offline", () => this.closeSSEConnection());
    // Pour TypeScript, on utilise le type unknown avant null
    (MobileMoneyManager.instance as unknown) = null;
  }

  /**
   * Initialiser IndexedDB pour persistance des transactions
   */
  private async initDB(): Promise<void> {
    if (this.dbInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.dbInitialized = true;
        // Charger les transactions sauvegardées
        this.loadSavedTransactions();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "id" });
        }
      };
    });
  }

  /**
   * Charger les transactions sauvegardées dans IndexedDB
   */
  private async loadSavedTransactions(): Promise<void> {
    const request = indexedDB.open(this.dbName, 1);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const savedTransactions: MobileMoneyTransaction[] =
          getAllRequest.result;
        savedTransactions.forEach((tx) => this.transactions.set(tx.id, tx));
        console.log(
          `${savedTransactions.length} transactions Mobile Money chargées`,
        );
      };
    };
  }

  /**
   * Sauvegarder une transaction dans IndexedDB
   */
  private async saveTransaction(
    transaction: MobileMoneyTransaction,
  ): Promise<void> {
    await this.initDB();
    const request = indexedDB.open(this.dbName, 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      store.put(transaction);
    };
  }

  // Singleton pour état global
  public static getInstance(): MobileMoneyManager {
    if (!MobileMoneyManager.instance) {
      MobileMoneyManager.instance = new MobileMoneyManager();
    }
    return MobileMoneyManager.instance;
  }

  /**
   * Gérer la connexion réseau rétablie : synchroniser les transactions en attente
   */
  private async handleOnline(): Promise<void> {
    console.log(
      "Connexion rétablie, synchronisation des transactions Mobile Money en attente...",
    );
    await this.syncPendingTransactions();
  }

  /**
   * Synchroniser toutes les transactions en statut PENDING avec les APIs des opérateurs
   */
  public async syncPendingTransactions(): Promise<void> {
    const pendingTransactions = Array.from(this.transactions.values()).filter(
      (tx) => tx.status === MobileMoneyTransactionStatus.PENDING,
    );

    for (const transaction of pendingTransactions) {
      try {
        const updatedTx = await this.checkTransactionStatus(transaction.id);
        console.log(
          `Transaction ${transaction.id} synchronisée : ${updatedTx.status}`,
        );
      } catch (error) {
        console.error(
          `Échec synchronisation transaction ${transaction.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Normaliser un numéro de téléphone ivoirien
   * Convertit tous les formats (0708091011, +2250708091011, 2250708091011) en +225XXXXXXXX
   */
  normalizePhoneNumber(phone: string): string {
    // Supprimer tous les caractères non numériques
    const digits = phone.replace(/\D/g, "");

    // Gérer les formats locaux
    if (digits.length === 10) {
      return `+225${digits}`;
    } else if (digits.length === 12 && digits.startsWith("225")) {
      return `+${digits}`;
    }

    throw new Error("Numéro de téléphone ivoirien invalide");
  }

  /**
   * Calculer les frais opérateurs pour un montant
   */
  calculateFees(
    operator: MobileMoneyOperator,
    amount: number,
  ): { fee: number; netAmount: number } {
    const config = OPERATOR_FEES[operator];
    let fee = amount * (config.percentage / 100);

    // Appliquer min et max des frais
    fee = Math.max(config.min, Math.min(config.max, fee));
    // Arrondir aux 50 FCFA près (convention locale)
    fee = Math.ceil(fee / 50) * 50;

    return {
      fee,
      netAmount: amount - fee,
    };
  }

  /**
   * Appel API spécifique à l'opérateur pour initier un paiement
   */
  private async callOperatorAPI(
    operator: MobileMoneyOperator,
    transaction: MobileMoneyTransaction,
  ): Promise<string> {
    const apiKey = this.apiKeys[operator];
    if (!apiKey) {
      throw new Error(`Clé API ${operator} non configurée`);
    }

    const url = OPERATOR_API_URLS[operator];
    const payload = this.buildOperatorPayload(operator, transaction);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Échec paiement ${operator} : ${error.message || "Erreur inconnue"}`,
      );
    }

    const data = await response.json();
    return data.transactionId || data.paymentId; // Retourne l'ID de transaction chez l'opérateur
  }

  /**
   * Construire le payload adapté à chaque opérateur
   */
  private buildOperatorPayload(
    operator: MobileMoneyOperator,
    transaction: MobileMoneyTransaction,
  ) {
    switch (operator) {
      case MobileMoneyOperator.WAVE:
        return {
          amount: transaction.amount,
          currency: "XOF",
          customerPhone: transaction.phoneNumber,
          externalId: transaction.id, // ID de notre transaction
          note: "Paiement BoulangeriePro",
        };

      case MobileMoneyOperator.ORANGE_MONEY:
        return {
          amount: transaction.amount,
          currency: "XOF",
          payer: { number: transaction.phoneNumber },
          orderId: transaction.id,
          description: "Paiement BoulangeriePro",
        };

      case MobileMoneyOperator.MTN_MOMO:
        return {
          amount: transaction.amount,
          currency: "XOF",
          phoneNumber: transaction.phoneNumber,
          externalReference: transaction.id,
          narration: "Paiement BoulangeriePro",
        };

      default:
        throw new Error("Opérateur non supporté");
    }
  }

  /**
   * Initier un paiement Mobile Money
   */
  async initiatePayment(
    sale: Sale,
    operator: MobileMoneyOperator,
    customerPhone: string,
  ): Promise<MobileMoneyTransaction> {
    // Normaliser le numéro
    const normalizedPhone = this.normalizePhoneNumber(customerPhone);

    // Calculer frais et montant net
    const { fee, netAmount } = this.calculateFees(operator, sale.total);

    // Créer la transaction locale
    const transaction: MobileMoneyTransaction = {
      id: crypto.randomUUID(),
      saleId: sale.id,
      operator,
      phoneNumber: normalizedPhone,
      amount: sale.total,
      fee,
      netAmount,
      status: MobileMoneyTransactionStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.transactions.set(transaction.id, transaction);
    await this.saveTransaction(transaction); // Sauvegarder initialement

    try {
      // Appeler l'API de l'opérateur
      const operatorTxId = await this.callOperatorAPI(operator, transaction);
      transaction.operatorTransactionId = operatorTxId;
      transaction.updatedAt = new Date().toISOString();
      await this.saveTransaction(transaction); // Sauvegarder après mise à jour

      return transaction;
    } catch (error) {
      transaction.status = MobileMoneyTransactionStatus.FAILED;
      transaction.failureReason =
        error instanceof Error ? error.message : "Erreur inconnue";
      transaction.updatedAt = new Date().toISOString();
      await this.saveTransaction(transaction); // Sauvegarder en cas d'erreur
      throw error;
    }
  }

  /**
   * Appel API spécifique à l'opérateur pour vérifier le statut d'une transaction
   */
  private async callStatusAPI(
    operator: MobileMoneyOperator,
    operatorTransactionId: string,
  ): Promise<string> {
    const apiKey = this.apiKeys[operator];
    if (!apiKey) {
      throw new Error(`Clé API ${operator} non configurée`);
    }

    // URLs de vérification de statut spécifiques à chaque opérateur
    const statusUrls: Record<MobileMoneyOperator, string> = {
      [MobileMoneyOperator.WAVE]: `https://api.wave.com/sandbox/v1/transactions/${operatorTransactionId}`,
      [MobileMoneyOperator.ORANGE_MONEY]: `https://api.orange.com/orange-money-ci/sandbox/v1/payments/${operatorTransactionId}`,
      [MobileMoneyOperator.MTN_MOMO]: `https://api.mtn.com/momo-ci/sandbox/v1/collections/${operatorTransactionId}`,
    };

    const url = statusUrls[operator];
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Échec vérification statut ${operator} : ${error.message || "Erreur inconnue"}`,
      );
    }

    const data = await response.json();
    // Retourne le statut de la transaction chez l'opérateur
    return data.status || data.paymentStatus || data.transactionStatus;
  }

  /**
   * Vérifier le statut d'une transaction (polling)
   */
  async checkTransactionStatus(
    transactionId: string,
  ): Promise<MobileMoneyTransaction> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) throw new Error("Transaction introuvable");
    if (!transaction.operatorTransactionId)
      throw new Error("ID transaction opérateur manquant");

    try {
      // Appeler l'API de statut de l'opérateur
      const operatorStatus = await this.callStatusAPI(
        transaction.operator,
        transaction.operatorTransactionId,
      );

      // Mapper les statuts opérateurs vers nos statuts internes
      if (operatorStatus === "SUCCESS" || operatorStatus === "COMPLETED") {
        transaction.status = MobileMoneyTransactionStatus.SUCCESS;
        transaction.completedAt = new Date().toISOString();
      } else if (operatorStatus === "FAILED" || operatorStatus === "REJECTED") {
        transaction.status = MobileMoneyTransactionStatus.FAILED;
        transaction.failureReason = "Paiement rejeté par l'opérateur";
      } else if (operatorStatus === "CANCELLED") {
        transaction.status = MobileMoneyTransactionStatus.CANCELLED;
      } else if (operatorStatus === "EXPIRED") {
        transaction.status = MobileMoneyTransactionStatus.EXPIRED;
      }

      transaction.updatedAt = new Date().toISOString();
      await this.saveTransaction(transaction); // Sauvegarder le nouveau statut
      return transaction;
    } catch (error) {
      console.error("Erreur vérification statut:", error);
      throw error;
    }
  }

  /**
   * Webhook pour mise à jour du statut par l'opérateur
   */
  async handleOperatorWebhook(
    operator: MobileMoneyOperator,
    payload: any,
  ): Promise<void> {
    // Récupérer notre transaction via l'externalId/orderId
    const ourTransactionId = payload.externalId || payload.orderId;
    const transaction = this.transactions.get(ourTransactionId);

    if (!transaction) return;

    // Mettre à jour le statut selon la payload de l'opérateur
    if (payload.status === "SUCCESS" || payload.paymentStatus === "SUCCESS") {
      transaction.status = MobileMoneyTransactionStatus.SUCCESS;
      transaction.completedAt = new Date().toISOString();
    } else if (
      payload.status === "FAILED" ||
      payload.paymentStatus === "FAILED"
    ) {
      transaction.status = MobileMoneyTransactionStatus.FAILED;
      transaction.failureReason = payload.reason || "Échec du paiement";
    }

    transaction.updatedAt = new Date().toISOString();
    await this.saveTransaction(transaction); // Sauvegarder le statut mis à jour
    console.log(
      `Statut transaction ${operator} mis à jour : ${transaction.status}`,
    );
  }

  /**
   * Récupérer toutes les transactions d'une période
   */
  getTransactionsByDateRange(
    startDate: string,
    endDate: string,
  ): MobileMoneyTransaction[] {
    return Array.from(this.transactions.values()).filter((tx) => {
      const txDate = new Date(tx.createdAt);
      return txDate >= new Date(startDate) && txDate <= new Date(endDate);
    });
  }

  /**
   * Récupérer une transaction par son ID
   */
  getTransaction(id: string): MobileMoneyTransaction | undefined {
    return this.transactions.get(id);
  }
}

// Export de l'instance singleton
export const mobileMoneyManager = MobileMoneyManager.getInstance();
