import React from 'react';
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
} from 'lucide-react';
import { SelectDropdown, Badge, Button } from '../ui';

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

  return (
    <header className="h-16 bg-stone-900 border-b border-stone-800 text-stone-100 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-md">
      {/* Brand & Boutique Switcher */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-xl bg-stone-800 text-stone-300 hover:text-stone-100"
          aria-label="Menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
            <Wheat className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-lg text-amber-50">Boulangerie<span className="text-amber-400">Pro</span></span>
              <Badge variant="amber">ERP & POS</Badge>
            </div>
            <p className="text-xs text-stone-400 hidden sm:block">Pilotage Artisanal & Multi-Boutiques</p>
          </div>
        </div>

        {/* Store Selector using ReUI Dropdown */}
        <div className="hidden lg:flex items-center gap-2 ml-4 pl-4 border-l border-stone-800">
          <StoreIcon className="w-4 h-4 text-stone-400" />
          <SelectDropdown
            value={currentStoreId}
            onChange={(val) => setCurrentStoreId(val)}
            options={storeOptions}
            width="w-72"
          />
        </div>
      </div>

      {/* Center Live Badges */}
      <div className="hidden md:flex items-center gap-3">
        {activeBakesCount > 0 && (
          <button
            onClick={() => setActiveTab('production')}
            className="transition-transform hover:scale-105"
          >
            <Badge variant="amber" size="md" className="bg-orange-950/70 text-orange-300 border-orange-800/80 animate-pulse">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>{activeBakesCount} fournée(s) au four</span>
            </Badge>
          </button>
        )}

        {criticalStockCount > 0 ? (
          <button
            onClick={() => setActiveTab('inventory')}
            className="transition-transform hover:scale-105"
          >
            <Badge variant="rose" size="md">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>{criticalStockCount} alerte(s) stock</span>
            </Badge>
          </button>
        ) : (
          <Badge variant="emerald" size="md">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Stocks optimaux</span>
          </Badge>
        )}

        {pendingCakesCount > 0 && (
          <button
            onClick={() => setActiveTab('custom_orders')}
            className="transition-transform hover:scale-105"
          >
            <Badge variant="purple" size="md">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>{pendingCakesCount} gâteau(x) en commande</span>
            </Badge>
          </button>
        )}
      </div>

      {/* Right Action Tools & Currency */}
      <div className="flex items-center gap-3">
        {/* Currency Switcher */}
        <div className="flex items-center bg-stone-800 rounded-lg p-0.5 border border-stone-700/80">
          <button
            onClick={() => setCurrency('XOF')}
            className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${
              currency === 'XOF'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Franc CFA (XOF)"
          >
            FCFA
          </button>
          <button
            onClick={() => setCurrency('EUR')}
            className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${
              currency === 'EUR'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Euro (€)"
          >
            EUR €
          </button>
        </div>

        {/* Quick Launch POS Button with ReUI Button */}
        <Button
          variant="primary"
          onClick={() => setActiveTab('pos')}
          icon={<Coins className="w-4 h-4" />}
        >
          <span className="hidden sm:inline">Caisse Tactile</span>
          <span className="sm:hidden">POS</span>
        </Button>

        {/* New Bake Action */}
        <Button
          variant="secondary"
          onClick={() => setActiveTab('production')}
          icon={<PlusCircle className="w-3.5 h-3.5 text-amber-400" />}
          className="hidden sm:inline-flex"
        >
          <span>Lancer Fournée</span>
        </Button>
      </div>
    </header>
  );
};
