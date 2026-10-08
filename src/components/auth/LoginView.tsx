import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Wheat, Lock, Mail, AlertCircle, LogIn } from 'lucide-react';

/**
 * Écran de connexion (chantier 1.2).
 *
 * En développement, des boutons de connexion rapide permettent d'entrer avec
 * chacun des quatre rôles pour vérifier le contrôle d'accès sans retenir
 * les identifiants.
 */
export const LoginView: React.FC = () => {
  const { login, isLoggingIn, error } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      await login(email, password);
    } catch {
      /* l'erreur est exposée via le contexte */
    }
  };

  const quickLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    try {
      await login(demoEmail, demoPassword);
    } catch {
      /* idem */
    }
  };

  const demoAccounts = [
    { role: 'Gérant', email: 'gerant@boulangeriepro.ci', password: 'gerant123', color: 'text-amber-400' },
    { role: 'Caissier', email: 'caissier@boulangeriepro.ci', password: 'caisse123', color: 'text-emerald-400' },
    { role: 'Boulanger', email: 'boulanger@boulangeriepro.ci', password: 'fournil123', color: 'text-orange-400' },
    { role: 'Magasinier', email: 'magasinier@boulangeriepro.ci', password: 'stock123', color: 'text-sky-400' },
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        {/* En-tête */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Wheat className="w-8 h-8 stroke-[2.2]" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight">
              Boulangerie<span className="text-amber-400">Pro</span>
            </h1>
            <p className="text-xs text-stone-400 mt-1">
              ERP & Caisse — Boulangerie Artisanale, Côte d&apos;Ivoire
            </p>
          </div>
        </div>

        {/* Formulaire */}
        <form
          onSubmit={handleSubmit}
          className="bg-stone-900 border border-stone-800 rounded-3xl p-6 space-y-4 shadow-xl"
        >
          <h2 className="font-extrabold text-sm text-stone-100">Connexion à votre atelier</h2>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-stone-300">Adresse e-mail</label>
            <div className="relative mt-1">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@boulangeriepro.ci"
                autoComplete="username"
                className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-300">Mot de passe</label>
            <div className="relative mt-1">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn || !email || !password}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn className="w-4 h-4" />
            <span>{isLoggingIn ? 'Connexion…' : 'Se connecter'}</span>
          </button>
        </form>

        {/* Connexion rapide (démonstration) */}
        <div className="mt-5 bg-stone-900/60 border border-stone-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2.5">
            Accès rapide — démonstration
          </p>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((acc) => (
              <button
                key={acc.role}
                type="button"
                onClick={() => quickLogin(acc.email, acc.password)}
                disabled={isLoggingIn}
                className="px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 hover:border-amber-500/40 text-left transition-colors disabled:opacity-50"
              >
                <span className={`block text-xs font-bold ${acc.color}`}>{acc.role}</span>
                <span className="block text-[10px] text-stone-500 truncate">{acc.email}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-stone-600 mt-2.5">
            Ces comptes sont créés par le seed de démonstration. À remplacer en production.
          </p>
        </div>
      </div>
    </div>
  );
};
