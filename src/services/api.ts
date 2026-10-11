/**
 * Client HTTP de l'API BoulangeriePro.
 *
 * Point d'entrée unique pour toutes les communications avec le backend :
 * - gère le jeton de session (injection de l'en-tête Authorization) ;
 * - normalise les erreurs (message exploitable par l'interface) ;
 * - centralise les types d'entrées/sorties.
 *
 * Authentification : Neon Auth (SDK) gère la session et le jeton (15 min).
 * Le jeton est lu à chaque requête ; il n'est jamais stocké par l'application.
 */

import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthVanillaAdapter } from "@neondatabase/neon-js/auth/vanilla/adapters";

/** Base URL de l'API. Vide en dev → on s'appuie sur le proxy Vite `/api`. */
const API_BASE = import.meta.env.VITE_API_URL ?? "";

/** Erreur API normalisée, porteuse d'un message lisible. */
export class ApiError extends Error {
  status: number;
  /** true si la requête d'écriture a été mise en file d'attente (hors-ligne). */
  queued: boolean;
  constructor(message: string, status: number, queued = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.queued = queued;
  }
}

import { enqueueOperation, type PendingOperation } from "./syncQueue";

/** URL de base Neon Auth côté front (variable VITE_NEON_AUTH_URL). */
const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL ?? "";

const createNeonAuth = (url: string) =>
  createAuthClient(url, { adapter: BetterAuthVanillaAdapter() });
type NeonAuthClient = ReturnType<typeof createNeonAuth>;

let authClient: NeonAuthClient | null = null;

/** Client Neon Auth, créé à la demande : une configuration absente produit une erreur claire. */
const getAuthClient = (): NeonAuthClient => {
  if (!NEON_AUTH_URL) {
    throw new ApiError("VITE_NEON_AUTH_URL n'est pas configurée.", 0);
  }
  authClient ??= createNeonAuth(NEON_AUTH_URL);
  return authClient;
};

/** Jeton Neon courant (renouvelé si nécessaire). Null si aucune session. */
export const getAccessToken = async (): Promise<string | null> => {
  try {
    const { data, error } = await getAuthClient().token();
    if (error || !data) return null;
    return data.token;
  } catch {
    return null;
  }
};

/**
 * Effectue une requête vers l'API et renvoie le corps JSON typé.
 * Ajoute automatiquement le jeton de session s'il existe.
 * Hors-ligne : ajoute les requêtes d'écriture (POST/PUT/PATCH/DELETE) à la file de synchronisation
 */
export const apiFetch = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(
    options.method || "",
  );

  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    // Si c'est une mutation (écriture) et qu'on est hors-ligne, on ajoute à la file d'attente
    if (isMutation && !navigator.onLine) {
      // On détermine le type d'opération pour le suivi
      let opType: PendingOperation["type"] = "other";
      if (path.includes("/sales")) opType = "sale";
      else if (path.includes("/production")) opType = "production";
      else if (path.includes("/purchase")) opType = "purchase";
      else if (path.includes("/materials") || path.includes("/inventory"))
        opType = "adjustment";

      // Le jeton n'est pas mémorisé : il est réinjecté à chaque rejeu.
      const queuedHeaders: Record<string, string> = { ...headers };
      delete queuedHeaders.Authorization;
      enqueueOperation(path, { ...options, headers: queuedHeaders }, opType);
      throw new ApiError(
        "Hors-ligne : l'opération sera synchronisée automatiquement lorsque le réseau sera rétabli.",
        0,
        true,
      );
    }
    throw new ApiError(
      "Réseau indisponible : impossible de joindre le serveur.",
      0,
    );
  }

  if (!response.ok) {
    let message = `Erreur ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* corps non JSON : on garde le message générique */
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

/** Raccourcis HTTP. */
export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};

/* ------------------------------- TYPES AUTH -------------------------------- */

export type Role = "gerant" | "caissier" | "boulanger" | "magasinier";

export interface SessionUser {
  id: string;
  name: string;
  email?: string;
  role: Role;
  storeId: string | null;
  permissions: string[];
}

/** Authentifie via Neon Auth, puis charge le profil depuis l'API. */
export const login = async (
  email: string,
  password: string,
): Promise<SessionUser> => {
  const { error } = await getAuthClient().signIn.email({ email, password });
  if (error) {
    throw new ApiError(error.message ?? "Identifiants invalides.", 401);
  }
  return me();
};

/**
 * Restaure la session Neon existante. Renvoie null si aucune session.
 * Une session valide sans compte rattaché (403) remonte l'erreur à l'interface.
 */
export const restoreSession = async (): Promise<SessionUser | null> => {
  const { data } = await getAuthClient().getSession();
  if (!data?.session) return null;
  try {
    return await me();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await logout();
      return null;
    }
    throw err;
  }
};

/** Termine la session Neon. */
export const logout = async (): Promise<void> => {
  try {
    await getAuthClient().signOut();
  } catch {
    /* session déjà fermée ou réseau indisponible */
  }
};

/** Profil de l'utilisateur courant. Le rôle est lu côté serveur, en base. */
export const me = (): Promise<SessionUser> =>
  api.get<SessionUser>("/api/auth/me");
