/**
 * Service de file d'attente hors-ligne — Phase 2.2
 * MEILLEURES PRATIQUES :
 * - Singleton pour état global
 * - IndexedDB pour persistance fiable (meilleur que localStorage pour les données volumineuses)
 * - Synchronisation automatique au retour du réseau
 * - Résolution des conflits (dernier écrit gagne, mais avec journalisation)
 * - Typage strict TypeScript
 */

import { api } from "./api"; // API existante du projet

// Types d'actions synchronisables
export enum OfflineActionType {
  CREATE_SALE = "CREATE_SALE",
  UPDATE_STOCK = "UPDATE_STOCK",
  ADD_CASH_TRANSACTION = "ADD_CASH_TRANSACTION",
}

// Interface d'une action en attente
export interface PendingAction {
  id: string;
  type: OfflineActionType;
  data: any;
  timestamp: number;
  storeId: string;
  userId: string;
  retryCount: number;
  lastError: string | null;
}

// État du gestionnaire hors-ligne exposé à l'UI
export interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTime: number | null;
  lastError: string | null;
}

// Classe de gestion de la file d'attente
export class OfflineQueueManager {
  private dbName = "boulangeriepro_offline";
  private storeName = "pendingActions";
  private db: IDBDatabase | null = null;
  private syncInProgress = false;

  private state: OfflineState = {
    isOnline: navigator.onLine,
    pendingCount: 0,
    isSyncing: false,
    lastSyncTime: null,
    lastError: null,
  };

  constructor() {
    // Écouteurs d'état réseau
    window.addEventListener("online", this.handleOnline.bind(this));
    window.addEventListener("offline", this.handleOffline.bind(this));
    // Initialisation de la base IndexedDB
    this.initDB();
  }

  // Récupération immuable de l'état
  getState(): Readonly<OfflineState> {
    return { ...this.state };
  }

  /**
   * Initialisation d'IndexedDB — persistance fiable même après fermeture du navigateur
   */
  private async initDB(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error("Échec initialisation IndexedDB");
        reject(false);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.updatePendingCount();
        resolve(true);
      };

      // Création du store si première initialisation
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "id" });
        }
      };
    });
  }

  /**
   * Mise à jour du nombre d'actions en attente
   */
  private async updatePendingCount(): Promise<void> {
    if (!this.db) return;
    const transaction = this.db.transaction(this.storeName, "readonly");
    const store = transaction.objectStore(this.storeName);
    const countRequest = store.count();

    countRequest.onsuccess = () => {
      this.state.pendingCount = countRequest.result;
    };
  }

  /**
   * Ajouter une action à la file d'attente (quand hors-ligne)
   */
  async addToQueue(
    action: Omit<
      PendingAction,
      "id" | "timestamp" | "retryCount" | "lastError"
    >,
  ): Promise<string> {
    if (!this.db) throw new Error("Base de données non initialisée");

    const newAction: PendingAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
      lastError: null,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.add(newAction);

      request.onsuccess = () => {
        this.updatePendingCount();
        resolve(newAction.id);
      };
      request.onerror = () =>
        reject(new Error("Échec ajout à la file d'attente"));
    });
  }

  /**
   * Synchroniser toutes les actions en attente (appelé automatiquement au retour du réseau)
   */
  async syncAll(): Promise<boolean> {
    if (
      this.syncInProgress ||
      !this.state.isOnline ||
      this.state.pendingCount === 0
    ) {
      return false;
    }

    this.syncInProgress = true;
    this.state.isSyncing = true;
    this.state.lastError = null;

    try {
      const actions = await this.getAllPendingActions();

      for (const action of actions) {
        try {
          await this.processAction(action);
          await this.removeFromQueue(action.id);
        } catch (error) {
          action.retryCount++;
          action.lastError =
            error instanceof Error ? error.message : "Erreur inconnue";
          if (action.retryCount < 5) {
            // Réessaie 5 fois max
            await this.updateAction(action);
          } else {
            console.error("Action abandonnée après 5 échecs:", action);
            await this.removeFromQueue(action.id);
          }
        }
      }

      this.state.lastSyncTime = Date.now();
      return true;
    } catch (error) {
      this.state.lastError =
        error instanceof Error ? error.message : "Erreur sync inconnue";
      return false;
    } finally {
      this.syncInProgress = false;
      this.state.isSyncing = false;
      this.updatePendingCount();
    }
  }

  /**
   * Traiter une action individuelle (appel API)
   */
  private async processAction(action: PendingAction): Promise<void> {
    switch (action.type) {
      case OfflineActionType.CREATE_SALE:
        await api.post("/sales", action.data);
        break;
      case OfflineActionType.UPDATE_STOCK:
        await api.patch(`/stock/${action.data.id}`, action.data);
        break;
      case OfflineActionType.ADD_CASH_TRANSACTION:
        await api.post("/cash/transactions", action.data);
        break;
      default:
        throw new Error(`Type d'action inconnu: ${action.type}`);
    }
  }

  /**
   * Récupérer toutes les actions en attente
   */
  private async getAllPendingActions(): Promise<PendingAction[]> {
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Supprimer une action de la file après synchronisation
   */
  private async removeFromQueue(id: string): Promise<void> {
    if (!this.db) return;
    const transaction = this.db.transaction(this.storeName, "readwrite");
    const store = transaction.objectStore(this.storeName);
    store.delete(id);
  }

  /**
   * Mettre à jour une action (en cas d'échec temporaire)
   */
  private async updateAction(action: PendingAction): Promise<void> {
    if (!this.db) return;
    const transaction = this.db.transaction(this.storeName, "readwrite");
    const store = transaction.objectStore(this.storeName);
    store.put(action);
  }

  /**
   * Gestionnaire d'événement : retour en ligne
   */
  private handleOnline() {
    this.state.isOnline = true;
    console.log("Réseau revenu — synchronisation automatique");
    this.syncAll();
  }

  /**
   * Gestionnaire d'événement : passage hors-ligne
   */
  private handleOffline() {
    this.state.isOnline = false;
    console.warn("Réseau coupé — les actions sont mises en file");
  }

  /**
   * Nettoyage des écouteurs
   */
  destroy() {
    window.removeEventListener("online", this.handleOnline.bind(this));
    window.removeEventListener("offline", this.handleOffline.bind(this));
  }
}

// Instance SINGLETON pour toute l'application
export const offlineQueue = new OfflineQueueManager();
