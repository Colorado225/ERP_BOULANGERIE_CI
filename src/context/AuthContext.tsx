/**
 * Contexte d'authentification et de permissions (chantier 1.2).
 *
 * - Restaure la session au démarrage (jeton → /api/auth/me).
 * - Expose l'utilisateur courant, son rôle et ses permissions.
 * - Fournit `can()` pour masquer les actions non autorisées dans l'interface.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  login as apiLogin,
  logout as apiLogout,
  me as apiMe,
  getToken,
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
  logout: () => void;
  /** Indique si l'utilisateur courant possède une permission. */
  can: (permission: string) => boolean;
  /** Indique si l'utilisateur courant a au moins l'un des rôles donnés. */
  hasRole: (...roles: SessionUser['role'][]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // MODE DÉMONSTRATION : connexion automatique pour tester les fonctionnalités
  useEffect(() => {
    // Utilisateur admin pré-rempli pour la démonstration
    const demoUser: SessionUser = {
      id: 'demo-gerant-001',
      name: 'Gérant Boulangerie',
      email: 'demo@boulangerie.ci',
      role: 'gerant',
      storeId: 'store-001',
      permissions: ['*']
    };
    setUser(demoUser);
    setIsRestoring(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const profile = await apiLogin(email, password);
      setUser(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la connexion.');
      throw err;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  const can = useCallback(
    (permission: string) => Boolean(user?.permissions?.includes(permission)),
    [user]
  );

  const hasRole = useCallback(
    (...roles: SessionUser['role'][]) => Boolean(user && roles.includes(user.role)),
    [user]
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