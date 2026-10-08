import React from 'react';
import { useBakery } from '../../context/BakeryContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Factory,
  BookOpen,
  Package,
  Layers,
  History,
  Truck,
  Users,
  Trash2,
  Wallet,
  Cake,
  Bot,
  Settings,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    materials,
    productionOrders,
    customOrders,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
  } = useBakery();

  const handleSelectTab = (id: string) => {
    setActiveTab(id);
    setIsMobileMenuOpen(false);
  };

  const criticalMaterials = materials.filter((m) => m.currentStock <= m.minStockAlert).length;
  const inProgressProduction = productionOrders.filter((p) => p.status === 'au_four' || p.status === 'petrissage').length;
  const pendingCakes = customOrders.filter((c) => c.status === 'commande' || c.status === 'en_preparation').length;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Tableau de bord',
      icon: LayoutDashboard,
      badge: null,
      color: 'text-amber-400',
    },
    {
      id: 'pos',
      label: 'Caisse / POS Tactile',
      icon: ShoppingCart,
      badge: 'Vente',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      color: 'text-emerald-400',
    },
    {
      id: 'production',
      label: 'Production & Fournées',
      icon: Factory,
      badge: inProgressProduction > 0 ? `${inProgressProduction} en cours` : null,
      badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      color: 'text-orange-400',
    },
    {
      id: 'recipes',
      label: 'Recettes & Coûts',
      icon: BookOpen,
      badge: null,
      color: 'text-amber-300',
    },
    {
      id: 'products',
      label: 'Produits & Catalogue',
      icon: Package,
      badge: null,
      color: 'text-sky-400',
    },
    {
      id: 'inventory',
      label: 'Stocks & Matières',
      icon: Layers,
      badge: criticalMaterials > 0 ? `${criticalMaterials} alerte` : null,
      badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30',
      color: 'text-indigo-400',
    },
    {
      id: 'stock_movements',
      label: 'Journal des Mouvements',
      icon: History,
      badge: null,
      color: 'text-sky-300',
    },
    {
      id: 'purchases',
      label: 'Achats & Fournisseurs',
      icon: Truck,
      badge: null,
      color: 'text-teal-400',
    },
    {
      id: 'customers',
      label: 'Clients & Fidélité B2B',
      icon: Users,
      badge: null,
      color: 'text-blue-400',
    },
    {
      id: 'custom_orders',
      label: 'Gâteaux Sur-Mesure',
      icon: Cake,
      badge: pendingCakes > 0 ? `${pendingCakes}` : null,
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      color: 'text-pink-400',
    },
    {
      id: 'losses',
      label: 'Pertes & Anti-Gaspillage',
      icon: Trash2,
      badge: null,
      color: 'text-rose-400',
    },
    {
      id: 'cash',
      label: 'Caisse & Dépenses (Z)',
      icon: Wallet,
      badge: null,
      color: 'text-emerald-300',
    },
    {
      id: 'ai_assistant',
      label: 'Assistant IA Boulanger',
      icon: Bot,
      badge: 'Smart',
      badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
      color: 'text-violet-400',
    },
    {
      id: 'settings',
      label: 'Paramètres & Boutiques',
      icon: Settings,
      badge: null,
      color: 'text-stone-400',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-35 md:hidden"
        />
      )}

      <aside
        className={`fixed md:sticky top-16 z-40 md:z-10 w-72 md:w-64 bg-stone-900 border-r border-stone-800 flex flex-col justify-between h-[calc(100vh-4rem)] select-none shrink-0 transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
      >
        <div className="py-4 px-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">
            Exploitation Fournil
          </div>

          {navItems.slice(0, 7).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-4 md:py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${isActive
                    ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30 shadow-sm'
                    : 'text-stone-300 hover:text-stone-100 hover:bg-stone-800/60'
                  }`}
              >
                <div className="flex items-center gap-4 md:gap-3">
                  <Icon className={`w-6 h-6 md:w-4 md:h-4 ${isActive ? 'text-amber-400' : 'text-stone-400'}`} />
                  <span className="text-base md:text-sm">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded-full border ${item.badgeColor || 'bg-stone-800 text-stone-300 border-stone-700'}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-5 px-3 pb-3 text-[11px] font-bold uppercase tracking-wider text-stone-500 border-t border-stone-800/80 mt-3">
            Gestion Commerciale & Pilotage
          </div>

          {navItems.slice(7).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-4 md:py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${isActive
                    ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30 shadow-sm'
                    : 'text-stone-300 hover:text-stone-100 hover:bg-stone-800/60'
                  }`}
              >
                <div className="flex items-center gap-4 md:gap-3">
                  <Icon className={`w-6 h-6 md:w-4 md:h-4 ${isActive ? 'text-amber-400' : 'text-stone-400'}`} />
                  <span className="text-base md:text-sm">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded-full border ${item.badgeColor || 'bg-stone-800 text-stone-300 border-stone-700'}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Info Box - version mobile optimisée */}
        <div className="p-4 md:p-3 border-t border-stone-800/80 bg-stone-950/40">
          <div className="p-4 md:p-3 rounded-xl bg-stone-800/60 border border-stone-700/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm md:text-xs font-semibold text-stone-300">Mode Connecté</span>
              <span className="w-3 h-3 md:w-2 md:h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <p className="text-xs md:text-[11px] text-stone-400">Synchronisé • Caisse Prête</p>
            <div className="mt-3 md:mt-2 pt-3 md:pt-2 border-t border-stone-700/60 flex items-center justify-between text-xs md:text-[11px] text-stone-400">
              <span>Devise:</span>
              <span className="font-bold text-amber-400">FCFA (XOF)</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};