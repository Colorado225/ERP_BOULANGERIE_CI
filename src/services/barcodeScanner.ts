/**
 * Service de scan de codes-barres avec ZXing
 * MEILLEURES PRATIQUES :
 * - Singleton pour gérer une seule instance de caméra
 * - Gestion d'état typée
 * - Nettoyage automatique des ressources
 * - Compatibilité caméras arrière/avant
 * - Gestion des erreurs utilisateur (permission refusée, etc.)
 */

import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";
import type { Result } from "@zxing/library";

// État du scanner exposé à l'UI
export interface ScannerState {
  isScanning: boolean;
  hasPermission: boolean;
  currentCamera: string | null;
  lastResult: string | null;
  lastError: string | null;
  availableCameras: MediaDeviceInfo[];
}

// Types d'erreurs spécifiques au scan
export enum ScannerErrorType {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  NO_CAMERA_FOUND = "NO_CAMERA_FOUND",
  SCAN_FAILED = "SCAN_FAILED",
  ALREADY_SCANNING = "ALREADY_SCANNING",
}

export class BarcodeScannerManager {
  private reader: BrowserMultiFormatReader | null = null;
  private state: ScannerState = {
    isScanning: false,
    hasPermission: false,
    currentCamera: null,
    lastResult: null,
    lastError: null,
    availableCameras: [],
  };

  // Récupération immuable de l'état
  getState(): Readonly<ScannerState> {
    return { ...this.state };
  }

  /**
   * Initialise le lecteur ZXing et liste les caméras disponibles
   */
  async initialize(): Promise<boolean> {
    if (this.reader) return true;

    try {
      this.reader = new BrowserMultiFormatReader();

      // Récupère toutes les caméras disponibles
      const cameras = await this.reader.listVideoInputDevices();
      this.state.availableCameras = cameras;

      if (cameras.length === 0) {
        throw new Error(ScannerErrorType.NO_CAMERA_FOUND);
      }

      // Sélectionne par défaut la caméra arrière (meilleure pour scanner)
      const backCamera =
        cameras.find(
          (cam) =>
            cam.label.toLowerCase().includes("back") ||
            cam.label.toLowerCase().includes("arrière"),
        ) || cameras[0];

      this.state.currentCamera = backCamera.deviceId;
      this.state.hasPermission = true;
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "NotAllowedError") {
        this.state.lastError = ScannerErrorType.PERMISSION_DENIED;
        this.state.hasPermission = false;
      } else {
        this.state.lastError = ScannerErrorType.NO_CAMERA_FOUND;
      }
      console.error("Échec initialisation scanner:", this.state.lastError);
      return false;
    }
  }

  /**
   * Démarre le scan dans un élément vidéo HTML
   */
  async startScanning(
    videoElement: HTMLVideoElement,
    onScanSuccess: (result: Result) => void,
    deviceId?: string,
  ): Promise<boolean> {
    if (!this.reader) {
      await this.initialize();
    }

    if (this.state.isScanning) {
      this.state.lastError = ScannerErrorType.ALREADY_SCANNING;
      return false;
    }

    const cameraId = deviceId || this.state.currentCamera;
    if (!cameraId) return false;

    try {
      this.state.isScanning = true;
      this.state.lastError = null;
      this.state.lastResult = null;

      // Démarre le scan continu
      await this.reader!.decodeFromVideoDevice(
        cameraId,
        videoElement,
        (result, err) => {
          if (result) {
            this.state.lastResult = result.getText();
            this.state.isScanning = false;
            this.stopScanning(); // Arrête automatiquement après un scan réussi
            onScanSuccess(result);
          }
          if (err && !(err instanceof NotFoundException)) {
            console.warn("Erreur scan:", err);
          }
        },
      );

      return true;
    } catch (error) {
      this.state.isScanning = false;
      this.state.lastError = ScannerErrorType.SCAN_FAILED;
      console.error("Échec démarrage scan:", error);
      return false;
    }
  }

  /**
   * Arrête le scan et libère les ressources caméra
   */
  stopScanning(): void {
    if (this.reader && this.state.isScanning) {
      this.reader.reset();
      this.state.isScanning = false;
    }
  }

  /**
   * Nettoyage complet - à appeler lors du démontage du composant
   */
  destroy(): void {
    if (this.reader) {
      this.reader.reset();
      this.reader = null;
    }
    this.state = {
      isScanning: false,
      hasPermission: false,
      currentCamera: null,
      lastResult: null,
      lastError: null,
      availableCameras: [],
    };
  }
}

// Instance SINGLETON pour toute l'application
export const barcodeScanner = new BarcodeScannerManager();
