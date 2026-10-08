/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BakeryProvider, useBakery } from './context/BakeryContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './components/auth/LoginView';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { PosView } from './components/pos/PosView';
import { ProductionView } from './components/production/ProductionView';
import { RecipesView } from './components/recipes/RecipesView';
import { ProductsView } from './components/products/ProductsView';
import { InventoryView } from './components/inventory/InventoryView';
import { StockMovementsView } from './components/inventory/StockMovementsView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { CustomersView } from './components/customers/CustomersView';
import { LossesView } from './components/losses/LossesView';
import { CashView } from './components/cash/CashView';
import { CustomOrdersView } from './components/orders/CustomOrdersView';
import { AiBakeryAssistant } from './components/ai/AiBakeryAssistant';
import { SettingsView } from './components/settings/SettingsView';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeTab, notification } = useBakery();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'pos':
        return <PosView />;
      case 'production':
        return <ProductionView />;
      case 'recipes':
        return <RecipesView />;
      case 'products':
        return <ProductsView />;
      case 'inventory':
        return <InventoryView />;
      case 'stock_movements':
        return <StockMovementsView />;
      case 'purchases':
        return <PurchasesView />;
      case 'customers':
        return <CustomersView />;
      case 'losses':
        return <LossesView />;
      case 'cash':
        return <CashView />;
      case 'custom_orders':
        return <CustomOrdersView />;
      case 'ai_assistant':
        return <AiBakeryAssistant />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex overflow-y-auto overflow-x-hidden">
          {renderActiveView()}
        </main>
      </div>

      {/* Floating Global Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-stone-900 border border-amber-500/50 text-amber-200 px-4 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-xs font-bold">{notification}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Garde d'authentification : affiche l'écran de connexion tant qu'aucune
 * session n'est active, puis l'application complète.
 */
const AuthGate: React.FC = () => {
  const { user, isRestoring } = useAuth();

  if (isRestoring) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-400 flex items-center justify-center text-sm">
        Restauration de la session…
      </div>
    );
  }

  if (!user) return <LoginView />;

  return (
    <BakeryProvider>
      <MainLayout />
    </BakeryProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}