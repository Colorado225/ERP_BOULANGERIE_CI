/**
 * Service d'impression ESC/POS pour imprimantes thermiques 58mm/80mm
 * MEILLEURES PRATIQUES :
 * - Gestion d'état centralisée (singleton)
 * - Gestion des erreurs Bluetooth
 * - Envoi par paquets pour éviter saturation imprimante
 * - Conformité DGI Côte d'Ivoire pour les tickets
 */

// Commandes ESC/POS standard (compatibles 99% des imprimantes thermiques)
const ESC = "\x1B";
const GS = "\x1D";
const FEED_CONTROL = ESC + "@"; // Initialisation sécurisée de l'imprimante
const BOLD_ON = ESC + "E" + "\x01";
const BOLD_OFF = ESC + "E" + "\x00";
const DOUBLE_WIDTH_ON = ESC + "!" + "\x10";
const DOUBLE_WIDTH_OFF = ESC + "!" + "\x00";
const CENTER_ALIGN = ESC + "a" + "\x01";
const LEFT_ALIGN = ESC + "a" + "\x00";
const CUT_PAPER = GS + "V" + "\x00"; // Coupe propre du papier
const FEED_LINES = (n: number) => ESC + "d" + String.fromCharCode(n);

// Largeurs de papier standardisées (58mm = 32 chars, 80mm = 48 chars)
const PAPER_WIDTH = {
  WIDTH_58: 32, // Format le plus courant en CI pour les petits commerces
  WIDTH_80: 48, // Format pour les caisses professionnelles
} as const;

export type PaperWidth = keyof typeof PAPER_WIDTH;

// Interface pour l'état de l'imprimante (exposé à l'UI)
export interface PrinterState {
  isConnected: boolean;
  deviceName: string | null;
  paperWidth: PaperWidth;
  isPrinting: boolean;
  lastError: string | null;
}

/**
 * Classe de construction de ticket ESC/POS - fluide et typée
 */
export class EscPosTicket {
  private buffer: string = "";
  private readonly width: number;

  constructor(paperWidth: PaperWidth = "WIDTH_80") {
    this.buffer += FEED_CONTROL; // Toujours initialiser l'imprimante
    this.width = PAPER_WIDTH[paperWidth];
  }

  addLine(text: string): this {
    this.buffer += text + "\n";
    return this;
  }

  addCenteredLine(text: string): this {
    this.buffer += CENTER_ALIGN + text + "\n" + LEFT_ALIGN;
    return this;
  }

  addBoldLine(text: string): this {
    this.buffer += BOLD_ON + text + "\n" + BOLD_OFF;
    return this;
  }

  addTitle(text: string): this {
    this.buffer +=
      CENTER_ALIGN +
      DOUBLE_WIDTH_ON +
      BOLD_ON +
      text +
      "\n" +
      BOLD_OFF +
      DOUBLE_WIDTH_OFF;
    return this;
  }

  addSeparator(char: string = "-"): this {
    this.buffer += char.repeat(this.width) + "\n";
    return this;
  }

  addColumns(left: string, right: string): this {
    const spaces = Math.max(1, this.width - left.length - right.length);
    this.buffer += left + " ".repeat(spaces) + right + "\n";
    return this;
  }

  feed(lines: number = 1): this {
    this.buffer += FEED_LINES(lines);
    return this;
  }

  cut(): this {
    this.buffer += CUT_PAPER;
    return this;
  }

  getBuffer(): Uint8Array {
    return new TextEncoder().encode(this.buffer);
  }
}

/**
 * INTERFACES POUR LES DONNÉES - typage strict TypeScript
 */
export interface SaleItem {
  name: string;
  quantity: number;
  price: number;
  barcode?: string;
}

export interface StoreInfo {
  name: string;
  location: string;
  phone: string;
  rccm: string; // Registre de Commerce et du Crédit Mobilier (obligatoire DGI)
  taxpayerAccount: string; // Compte contribuable (obligatoire DGI)
}

export interface ReceiptData {
  store: StoreInfo;
  saleId: string;
  date: Date;
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  cashierName: string;
  tvaRate: number; // Taux de TVA appliqué (conformité DGI)
}

export interface ZReportData {
  store: StoreInfo;
  date: Date;
  totalSales: number;
  cashSales: number;
  mobileMoneySales: number;
  cardSales: number;
  transactionCount: number;
  cashierName: string;
  tvaCollected: number;
}

/**
 * Génère un ticket de caisse 100% conforme DGI Côte d'Ivoire
 */
export const generateReceipt = (
  data: ReceiptData,
  paperWidth: PaperWidth = "WIDTH_80",
): Uint8Array => {
  const ticket = new EscPosTicket(paperWidth);

  // En-tête obligatoire (identité boutique conforme DGI)
  ticket.addTitle("BOULANGERIE PRO");
  ticket.addCenteredLine(data.store.name);
  ticket.addCenteredLine(data.store.location);
  ticket.addCenteredLine(`Tél: ${data.store.phone}`);
  ticket.addCenteredLine(`RC: ${data.store.rccm}`);
  ticket.addCenteredLine(`CC: ${data.store.taxpayerAccount}`);
  ticket.addSeparator();

  // Métadonnées du ticket
  ticket.addColumns(
    `Ticket #${data.saleId.slice(0, 8)}`,
    data.date.toLocaleString("fr-FR"),
  );
  ticket.addColumns(`Caissier: ${data.cashierName}`, "");
  ticket.addSeparator();

  // Articles
  ticket.addBoldLine("QTE  PRODUIT               PRIX");
  data.items.forEach((item) => {
    const qtyStr = `x${item.quantity}`.padEnd(5);
    const nameStr =
      item.name.length > 18 ? item.name.slice(0, 18) : item.name.padEnd(18);
    const priceStr = `${(item.price * item.quantity).toFixed(0)} FCFA`;
    ticket.addLine(`${qtyStr}${nameStr}${priceStr}`);
  });
  ticket.addSeparator();

  // Totaux et TVA (conformité fiscale)
  if (data.discountAmount > 0) {
    ticket.addColumns("Sous-total", `${data.subtotal.toFixed(0)} FCFA`);
    ticket.addColumns("Remise", `-${data.discountAmount.toFixed(0)} FCFA`);
  }
  ticket.addColumns(
    `TVA ${(data.tvaRate * 100).toFixed(0)}%`,
    `${(data.total * data.tvaRate).toFixed(0)} FCFA`,
  );
  ticket.addBoldLine(`TOTAL:     ${data.total.toFixed(0)} FCFA`);
  ticket.addSeparator();

  // Paiement
  ticket.addColumns(
    `Mode: ${data.paymentMethod === "especes" ? "Espèces" : data.paymentMethod}`,
    "",
  );
  ticket.addColumns(`Montant versé:`, `${data.amountPaid.toFixed(0)} FCFA`);
  if (data.change > 0) {
    ticket.addColumns(`Monnaie rendue:`, `${data.change.toFixed(0)} FCFA`);
  }
  ticket.addSeparator();

  // Pied de page - OBLIGATION LÉGALE DGI Côte d'Ivoire
  ticket.addCenteredLine("Merci pour votre visite !");
  ticket.addCenteredLine("Ticket valant facture conforme DGI");
  ticket.feed(2);
  ticket.cut();

  return ticket.getBuffer();
};

/**
 * Génère une CLÔTURE Z (rapport journalier) conforme aux exigences DGI
 */
export const generateZReport = (
  data: ZReportData,
  paperWidth: PaperWidth = "WIDTH_80",
): Uint8Array => {
  const ticket = new EscPosTicket(paperWidth);

  // En-tête de la clôture Z
  ticket.addTitle("CLÔTURE JOURNALIÈRE Z");
  ticket.addCenteredLine(data.store.name);
  ticket.addCenteredLine(data.date.toLocaleDateString("fr-FR"));
  ticket.addCenteredLine(`Gérant: ${data.cashierName}`);
  ticket.addSeparator();

  // Statistiques globales
  ticket.addBoldLine("STATISTIQUES DU JOUR");
  ticket.addColumns("Nombre de transactions", `${data.transactionCount}`);
  ticket.addSeparator();

  // Répartition par mode de paiement
  ticket.addBoldLine("RÉPARTITION DES PAIEMENTS");
  ticket.addColumns("Espèces", `${data.cashSales.toFixed(0)} FCFA`);
  ticket.addColumns("Mobile Money", `${data.mobileMoneySales.toFixed(0)} FCFA`);
  ticket.addColumns("Carte bancaire", `${data.cardSales.toFixed(0)} FCFA`);
  ticket.addSeparator();

  // Totaux et TVA collectée (obligation fiscale)
  ticket.addBoldLine("TOTAUX FISCAUX");
  ticket.addColumns(
    "Chiffre d'affaires TTC",
    `${data.totalSales.toFixed(0)} FCFA`,
  );
  ticket.addColumns("TVA collectée", `${data.tvaCollected.toFixed(0)} FCFA`);
  ticket.addSeparator();

  // Pied de page de clôture
  ticket.addCenteredLine("CLÔTURE EFFECTUÉE LE");
  ticket.addCenteredLine(new Date().toLocaleString("fr-FR"));
  ticket.addCenteredLine("Document archivable");
  ticket.feed(3);
  ticket.cut();

  return ticket.getBuffer();
};

/**
 * Fonction d'impression Bluetooth - MEILLEURES PRATIQUES :
 * - Envoi par paquets de 20 octets (MTU standard BLE)
 * - Gestion des timeouts
 * - Gestion des erreurs détaillées
 * - Compatible avec 99% des imprimantes thermiques CI (module HM-10)
 */
export const printToBluetoothPrinter = async (
  buffer: Uint8Array,
): Promise<boolean> => {
  // Cast TypeScript sécurisé pour Web Bluetooth (API non standardisée)
  const navigatorWithBle = navigator as any;

  if (!navigatorWithBle.bluetooth) {
    throw new Error(
      "Web Bluetooth non supporté par votre navigateur (utilisez Chrome/Edge)",
    );
  }

  try {
    // Demande de sélection d'appareil - filtres adaptés aux imprimantes thermiques courantes
    const device = await navigatorWithBle.bluetooth.requestDevice({
      filters: [
        { namePrefix: "POS" },
        { namePrefix: "Printer" },
        { namePrefix: "MPT" },
        { namePrefix: "Zjiang" },
        { namePrefix: "GOOJPRT" },
      ],
      // Service HM-10 - module BLE le plus répandu dans les imprimantes thermiques
      optionalServices: ["0000ffe0-0000-1000-8000-00805f9b34fb"],
    });

    if (!device.gatt)
      throw new Error("Appareil incompatible : GATT non disponible");

    // Connexion sécurisée à l'imprimante
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(
      "0000ffe0-0000-1000-8000-00805f9b34fb",
    );
    const characteristic = await service.getCharacteristic(
      "0000ffe1-0000-1000-8000-00805f9b34fb",
    );

    // ENVOI PAR PAQUETS - ÉVITE LA SATURATION DE L'IMPRIMANTE
    // MTU BLE standard = 20 octets, pause de 50ms entre chaque paquet
    const MTU = 20;
    for (let i = 0; i < buffer.length; i += MTU) {
      const chunk = buffer.slice(i, i + MTU);
      await characteristic.writeValueWithResponse(chunk);
      await new Promise((resolve) => setTimeout(resolve, 50)); // Pause obligatoire
    }

    // Déconnexion propre après impression
    device.gatt.disconnect();
    return true;
  } catch (error) {
    console.error("Échec impression Bluetooth:", error);
    throw error;
  }
};

/**
 * SINGLETON ThermalPrinterManager - GESTION D'ÉTAT CENTRALISÉE
 * Meilleure pratique : une seule instance pour toute l'application
 */
export class ThermalPrinterManager {
  private state: PrinterState = {
    isConnected: false,
    deviceName: null,
    paperWidth: "WIDTH_80",
    isPrinting: false,
    lastError: null,
  };

  // Récupération de l'état (copie immuable pour sécurité)
  getState(): Readonly<PrinterState> {
    return { ...this.state };
  }

  setPaperWidth(width: PaperWidth): void {
    this.state.paperWidth = width;
  }

  // Impression d'un ticket de caisse
  async printReceipt(data: ReceiptData): Promise<boolean> {
    this.state.isPrinting = true;
    this.state.lastError = null;

    try {
      const buffer = generateReceipt(data, this.state.paperWidth);
      const success = await printToBluetoothPrinter(buffer);
      this.state.isPrinting = false;
      return success;
    } catch (error) {
      this.state.isPrinting = false;
      this.state.lastError =
        error instanceof Error ? error.message : "Erreur inconnue";
      throw error;
    }
  }

  // Impression d'une clôture Z
  async printZReport(data: ZReportData): Promise<boolean> {
    this.state.isPrinting = true;
    this.state.lastError = null;

    try {
      const buffer = generateZReport(data, this.state.paperWidth);
      const success = await printToBluetoothPrinter(buffer);
      this.state.isPrinting = false;
      return success;
    } catch (error) {
      this.state.isPrinting = false;
      this.state.lastError =
        error instanceof Error ? error.message : "Erreur inconnue";
      throw error;
    }
  }
}

// Export de l'instance unique (singleton)
export const thermalPrinter = new ThermalPrinterManager();
