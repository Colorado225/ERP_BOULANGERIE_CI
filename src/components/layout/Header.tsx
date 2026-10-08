import React, { useState, useEffect } from 'react';
import { useBakery } from '../../context/BakeryContext';
import {
  Wheat,
  Store as StoreIcon,
  PlusCircle,
  Coins,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Sparkles,
  Menu,
  X,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { SelectDropdown, Badge, Button } from '../ui';
import { offlineQueue } from '../../services/offlineQueue';

export const Header: React.FC = () => {
  const {
    stores,
    currentStoreId,
    setCurrentStoreId,
    currency,
    setCurrency,
    materials,
    setActiveTab,
    productionOrders,
    customOrders,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
  } = useBakery();

  const currentStore = stores.find((s) => s.id === currentStoreId) || stores[0];

  // Critical stock count
  const criticalStockCount = materials.filter((m) => m.currentStock <= m.minStockAlert).length;
  // In-baking orders count
  const activeBakesCount = productionOrders.filter((o) => o.status === 'au_four' || o.status === 'petrissage').length;
  // Pending custom cakes for today
  const pendingCakesCount = customOrders.filter((o) => o.status === 'en_preparation' || o.status === 'commande').length;

  const storeOptions = stores.map((st) => ({
    label: st.name,
    value: st.id,
    badge: st.isMain ? '★ Principal' : undefined,
  }));

  // État de connectivité réseau (mode hors-ligne) — utilise le nouveau service
  const [offlineState, setOfflineState] = useState<ReturnType<typeof offlineQueue.getState>>(
    offlineQueue.getState()
  );

  // Écoute les mises à jour de l'état du service hors-ligne
  useEffect(() => {
    const updateState = () => setOfflineState({ ...offlineQueue.getState() });

    // Vérifie périodiquement l'état (toutes les 2s)
    const interval = setInterval(updateState, 2000);
    return () => clearInterval(interval);
  }, []);

  // Force la synchronisation manuelle
  const handleManualSync = async () => {
    if (!offlineState.isOnline || offlineState.isSyncing) return;
    await offlineQueue.syncAll();
    setOfflineState({ ...offlineQueue.getState() });
  };

  return (
    <header className="h-16 bg-stone-900 border-b border-stone-800 text-stone-100 px-3 sm:px-4 flex items-center justify-between sticky top-0 z-50 shadow-md overflow-visible">
      {/* Côté Gauche - BOUTTON MENU + LOGO (jamais rien d'autre, 100% mobile-first sans overflow) */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
        {/* Bouton hamburger TACTILE - taille optimisée pour les doigts (48x48px minimum) */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="shrink-0 p-2 sm:p-2.5 rounded-xl bg-stone-800 text-stone-300 hover:text-stone-100 hover:bg-stone-700 active:scale-95 transition-all touch-manipulation"
          aria-label="Ouvrir le menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Logo adaptatif - cache le texte sur les écrans <360px pour éviter tout débordement */}
        <div className="flex items-center gap-2">
          <div className="shrink-0 w-9 sm:w-10 h-9 sm:h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
            <Wheat className="w-5 sm:w-6 h-5 sm:h-6 stroke-[2.2]" />
          </div>
          <div className="hidden xs:block"> {/* xs = 360px+, ne s'affiche pas sur les très petits écrans */}
            <span className="font-extrabold tracking-tight text-base sm:text-lg text-amber-50">Boulangerie<span className="text-amber-400">Pro</span></span>
          </div>
        </div>
      </div>

      {/* Côté Droit - SEULEMENT l'indicateur de connexion + BOUTON SYNC MANUEL + BOUTON CAISSE */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Indicateur de connexion ultra-compact pour mobile */}
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-stone-800/80 border border-stone-700/50">
          {offlineState.isOnline ? (
            offlineState.pendingCount > 0 ? (
              <>
                <RefreshCw className={`w-4 h-4 text-amber-400 ${offlineState.isSyncing ? 'animate-spin' : ''}`} />
                <span className="text-xs text-amber-300 font-bold">{offlineState.pendingCount}</span>
                {/* Bouton de synchronisation MANUELLE accessible - meilleure UX */}
                {!offlineState.isSyncing && (
                  <button
                    onClick={handleManualSync}
                    className="ml-1 p-1 hover:bg-stone-700 rounded touch-manipulation"
                    aria-label="Synchroniser"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                )}
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline text-xs text-emerald-300">OK</span>
              </>
            )
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-rose-400" />
              {offlineState.pendingCount > 0 && <span className="text-xs text-rose-300 font-bold">{offlineState.pendingCount}</span>}
            </>
          )}
        </div>

        {/* Bouton Caisse - toujours court, pas de texte redondant sur mobile */}
        <Button
          variant="primary"
          onClick={() => setActiveTab('pos')}
          icon={<Coins className="w-4 h-4" />}
          className="shrink-0"
        >
          <span className="sm:hidden">POS</span>
          <span className="hidden sm:inline">Caisse</span>
        </Button>
      </div>

      {/* MENU DEROULANT MOBILE - contient TOUS les autres éléments */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      <div
        className={`fixed top-16 left-0 h-[calc(100vh-4rem)] w-80 bg-stone-900 border-r border-stone-800 shadow-2xl z-50 transform transition-transform duration-300 ease-out lg:hidden overflow-y-auto ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="p-4 space-y-6">
          {/* Sélecteur de boutique */}
          <div className="bg-stone-800/50 rounded-xl p-4 border border-stone-800">
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Boutique</h3>
            <div className="flex items-center gap-2">
              <StoreIcon className="w-4 h-4 text-stone-400" />
              <SelectDropdown
                value={currentStoreId}
                onChange={(val) => setCurrentStoreId(val)}
                options={storeOptions}
                width="w-full"
              />
            </div>
          </div>

          {/* Indicateurs de statut en temps réel */}
          <div className="bg-stone-800/50 rounded-xl p-4 border border-stone-800">
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Statuts en temps réel</h3>
            <div className="space-y-3">
              {activeBakesCount > 0 && (
                <button
                  onClick={() => { setActiveTab('production'); setIsMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg bg-orange-950/50 border border-orange-800/50 hover:bg-orange-950/70 transition-all"
                >
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="text-sm text-orange-300">{activeBakesCount} fournée(s) au four</span>
                </button>
              )}

              {criticalStockCount > 0 ? (
                <button
                  onClick={() => { setActiveTab('inventory'); setIsMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg bg-rose-950/50 border border-rose-800/50 hover:bg-rose-950/70 transition-all"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span className="text-sm text-rose-300">{criticalStockCount} alerte(s) stock</span>
                </button>
              ) : (
                <div className="w-full flex items-center gap-2 p-2 rounded-lg bg-emerald-950/50 border border-emerald-800/50">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-300">Stocks optimaux</span>
                </div>
              )}

              {pendingCakesCount > 0 && (
                <button
                  onClick={() => { setActiveTab('custom_orders'); setIsMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg bg-purple-950/50 border border-purple-800/50 hover:bg-purple-950/70 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-purple-300">{pendingCakesCount} gâteau(x) en commande</span>
                </button>
              )}
            </div>
          </div>

          {/* Connectivité & Synchronisation */}
          <div className="bg-stone-800/50 rounded-xl p-4 border border-stone-800">
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Connectivité</h3>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-stone-900/50">
              {offlineState.isOnline ? (
                <>
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-300">En ligne</span>
                  {offlineState.pendingCount > 0 && (
                    <button
                      onClick={handleManualSync}
                      disabled={offlineState.isSyncing}
                      className="ml-auto flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-100 px-2 py-1 rounded-md bg-emerald-950/50 hover:bg-emerald-950/70 transition-all"
                    >
                      <RefreshCw className={`w-3 h-3 ${offlineState.isSyncing ? 'animate-spin' : ''}`} />
                      <span>Synchroniser ({offlineState.pendingCount})</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-rose-400" />
                  <span className="text-sm text-rose-300">Hors-ligne</span>
                  {offlineState.pendingCount > 0 && (
                    <span className="ml-auto text-sm text-rose-300 font-bold">{offlineState.pendingCount} en attente</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Devises */}
          <div className="bg-stone-800/50 rounded-xl p-4 border border-stone-800">
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Devise</h3>
            <div className="flex items-center bg-stone-900 rounded-lg p-1 border border-stone-700/80">
              <button
                onClick={() => setCurrency('XOF')}
                className={`flex-1 px-3 py-2 text-sm font-bold rounded-md transition-all ${currency === 'XOF'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
                  }`}
              >
                FCFA (CFA)
              </button>
              <button
                onClick={() => setCurrency('EUR')}
                className={`flex-1 px-3 py-2 text-sm font-bold rounded-md transition-all ${currency === 'EUR'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
                  }`}
              >
                EUR (€)
              </button>
            </div>
          </div>

          {/* Actions rapides */}
          <div className="bg-stone-800/50 rounded-xl p-4 border border-stone-800">
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Actions rapides</h3>
            <div className="space-y-2">
              <Button
                variant="secondary"
                onClick={() => { setActiveTab('production'); setIsMobileMenuOpen(false); }}
                icon={<PlusCircle className="w-4 h-4 text-amber-400" />}
                className="w-full justify-center"
              >
                Lancer une fournée
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};