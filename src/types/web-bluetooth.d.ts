/**
 * Déclarations de type TypeScript pour l'API Web Bluetooth
 * Ajoutée pour étendre l'interface Navigator avec les types de l'API Web Bluetooth
 * (Chrome, Edge, Safari 18.4+)
 *
 * Source: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
 */

// Interfaces du Web Bluetooth API
interface Bluetooth {
  readonly id: string;
  readonly name: string;
  readonly gatt: BluetoothGATT;
  readonly onboardBluetooth: boolean;
  readonly randomAddress: string;
  readonly state: string;

  /**
   * Demande une connexion à une imprimante ou un périphérique Bluetooth
   */
  requestDevice(
    options: BluetoothDeviceRequestOptions,
  ): Promise<BluetoothDevice>;

  /**
   * Recherche les périphériques disponibles
   */
  requestLEScan(
    options?: BluetoothLEScanOptions | undefined,
  ): Promise<void>;

  requestDatabaseOperation: (options: any) => Promise<any>;
}

interface BluetoothDeviceRequestOptions {
  filters?: BluetoothLEScanFilter[];
  optionalServices?: string[];
  acceptAllDevices?: boolean;
}

interface BluetoothLEScanFilter {
  services?: string[];
  name?: string;
  namePrefix?: string;
  [key: string]: unknown;
}

interface BluetoothLEScanOptions {
  lowercaseNames?: boolean;
  allowDuplicates?: boolean;
  optionalServices?: string[];
}

interface BluetoothGATT {
  readonly server: BluetoothRemoteGATTServer;

  connect(
    options?: { connectId?: number; // optionnel, pour les scans existants
    }): Promise<BluetoothRemoteGATTServer>;
}

interface BluetoothRemoteGATTServer {
  readonly device: BluetoothDevice;
  readonly hostname: string;
  readonly port: number;
  readonly type: string;

  /**
   * Se connecte au serveur GATT
   */
  connect(): Promise<BluetoothRemoteGATTServer>;

  /**
   * Se déconnecte du serveur GATT
   */
  disconnect(): void;

  /**
   * Récupère un service primaire par son UUID
   */
  getPrimaryService(
    serviceUUID: string | string[],
  ): Promise<BluetoothRemoteGATTService>;

  /**
   * Récupère tous les services primaires
   */
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTService {
  readonly device: BluetoothDevice;
  readonly uuid: string;
  readonly prefixed: string;

  /**
   * Récupère une caractéristique par son UUID
   */
  getCharacteristic(
    characteristicUUID: string,
  ): Promise<BluetoothRemoteGATTCharacteristic>;

  /**
   * Récupère toutes les caractéristiques
   */
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;

  /**
   * Récupère un service secondaire
   */
  getDescriptor(descriptorUUID: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic {
  readonly service: BluetoothRemoteGATTService;
  readonly uuid: string;
  readonly byteLength: number;
  readonly isNotWritable: boolean;
  readonly isNotReadable: boolean;
  readonly isNotNotification: boolean;

  /**
   * Lit la valeur de la caractéristique
   */
  readValue(): Promise<ArrayBuffer>;

  /**
   * Écrit une valeur dans la caractéristique
   */
  writeValue(value: ArrayBuffer | ArrayBufferView | string): Promise<void>;

  /**
   * Démarre les notifications
   */
  startNotifications(): Promise<void>;

  /**
   * Arrête les notifications
   */
  stopNotifications(): Promise<void>;
}

interface BluetoothRemoteGATTCharacteristicFilter {
  uuid: string;
  [key: string]: unknown;
}

interface BluetoothRemoteGATTCharacteristicProperties {
  broadcast?: boolean;
  read?: boolean;
  writable?: boolean;
  writeWithoutResponse?: boolean;
  notify?: boolean;
  indicate?: boolean;
  seal?: boolean;
  [key: string]: unknown;
}

interface BluetoothRemoteGATTDescriptor {
  readonly characteristic: BluetoothRemoteGATTCharacteristic;
  readonly uuid: string;

  readValue(): Promise<ArrayBuffer>;
  writeValue(value: ArrayBuffer | ArrayBufferView | string): Promise<void>;
}

// Extension de l'interface Navigator
interface Navigator {
  readonly bluetooth: Bluetooth;
}

// Extension de l'interface Window si nécessaire
interface Window {
  bluetooth?: Bluetooth;
}
