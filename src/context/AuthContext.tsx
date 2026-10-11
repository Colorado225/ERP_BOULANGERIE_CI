/**
 * Contexte d'authentification et de permissions (lot 1).
 *
 * - Connexion et session : Neon Auth (via le client de `services/api`).
 * - Le profil (rôle, boutique, permissions) est chargé depuis l'API, qui le lit en base.
 * - Aucun compte de démonstration : toute session passe par Neon Auth.
 * - `can()` vérifie les permissions renvoyées par le serveur.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  login as apiLogin,
  logout as apiLogout,
  restoreSession,
  ApiError,
  type SessionUser,
} from '../services/api';

interface AuthContextType {
  user: SessionUser | null;
  /** Vrai pendant la restauration initiale de session. */
  isRestoring: boolean;
  /** Vrai pendant une tentative de connexion. */
  isLoggingIn: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Indique si l'utilisateur courant possède une permission. */
  can: (permission: string) => boolean;
  /** Indique si l'utilisateur courant a au moins l'un des rôles donnés. */
  hasRole: (...roles: SessionUser['role'][]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Message lisible pour une erreur de connexion ou de session. */
const messageFor = (err: unknown): string => {
  if (err instanceof ApiError) {
    if (err.status === 403) return err.message;
    if (err.status === 401) return 'Identifiants invalides.';
    return err.message;
  }
  return 'Échec de la connexion.';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Restauration de session au chargement : session Neon -> profil API.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const profile = await restoreSession();
        if (!cancelled) setUser(profile);
      } catch (err) {
        if (!cancelled) {
          setUser(null);
          setError(messageFor(err));
        }
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const profile = await apiLogin(email, password);
      setUser(profile);
    } catch (err) {
      setError(messageFor(err));
      throw err;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const can = useCallback(
    (permission: string) => Boolean(user?.permissions?.includes(permission)),
    [user],
  );

  const hasRole = useCallback(
    (...roles: SessionUser['role'][]) => Boolean(user && roles.includes(user.role)),
    [user],
  );

  return (
    <AuthContext.Provider
      value={{ user, isRestoring, isLoggingIn, error, login, logout, can, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
};
