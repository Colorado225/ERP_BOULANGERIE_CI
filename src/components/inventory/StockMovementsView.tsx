import React, { useState, useMemo } from 'react';
import { useBakery } from '../../context/BakeryContext';
import { StockMovementSource } from '../../types/bakery';
import {
  History,
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  Factory,
  Truck,
  Trash2,
  SlidersHorizontal,
  ShoppingCart,
  ClipboardList,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatCard,
  Badge,
} from '../ui';

/**
 * Journal des mouvements de stock.
 *
 * Rend visible la traçabilité des variations de matières premières
 * (production, réceptions d'achat, ajustements, pertes) : qui, quoi,
 * quand, pourquoi, et le stock résultant. Indispensable pour auditer
 * les écarts d'inventaire en boulangerie.
 */
export const StockMovementsView: React.FC = () => {
  const { stockMovements, materials, formatMoney } = useBakery();

  const [search, setSearch] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('all');

  const filtered = useMemo(() => {
    return stockMovements.filter((mv) => {
      const matchSource = filterSource === 'all' || mv.source === filterSource;
      const matchSearch =
        mv.materialName.toLowerCase().includes(search.toLowerCase()) ||
        (mv.reference || '').toLowerCase().includes(search.toLowerCase()) ||
        mv.recordedBy.toLowerCase().includes(search.toLowerCase());
      return matchSource && matchSearch;
    });
  }, [stockMovements, filterSource, search]);

  const totalIn = stockMovements
    .filter((m) => m.delta > 0)
    .reduce((sum, m) => sum + m.delta, 0);
  const totalOut = stockMovements
    .filter((m) => m.delta < 0)
    .reduce((sum, m) => sum + Math.abs(m.delta), 0);

  const getSourceMeta = (source: StockMovementSource) => {
    switch (source) {
      case 'production':
        return { label: 'Production', icon: Factory, color: 'text-orange-400' };
      case 'reception_achat':
        return { label: 'Réception achat', icon: Truck, color: 'text-teal-400' };
      case 'perte':
        return { label: 'Perte', icon: Trash2, color: 'text-rose-400' };
      case 'ajustement_manuel':
        return { label: 'Ajustement', icon: SlidersHorizontal, color: 'text-amber-400' };
      case 'vente':
        return { label: 'Vente', icon: ShoppingCart, color: 'text-emerald-400' };
      case 'inventaire':
        return { label: 'Inventaire', icon: ClipboardList, color: 'text-sky-400' };
      default:
        return { label: 'Autre', icon: ClipboardList, color: 'text-stone-400' };
    }
  };

  const sources = [
    { id: 'all', label: 'Toutes les sources' },
    { id: 'production', label: 'Production' },
    { id: 'reception_achat', label: 'Réceptions' },
    { id: 'ajustement_manuel', label: 'Ajustements' },
    { id: 'perte', label: 'Pertes' },
  ];

  return (
    <div className="flex-1 p-5 md:p-8 space-y-6 overflow-y-auto bg-stone-950 text-stone-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-6 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-stone-100">Journal des Mouvements de Stock</h1>
            <p className="text-xs text-stone-400">
              Traçabilité complète des entrées et sorties de matières premières (audit des écarts)
            </p>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Mouvements Enregistrés"
          value={stockMovements.length}
          subtitle="Historique complet"
          color="sky"
          icon={<History className="w-4 h-4" />}
        />
        <StatCard
          title="Entrées Cumulées"
          value={`+${totalIn.toFixed(1)}`}
          subtitle="Réceptions & ajustements positifs"
          color="emerald"
          icon={<ArrowUpCircle className="w-4 h-4" />}
        />
        <StatCard
          title="Sorties Cumulées"
          value={`-${totalOut.toFixed(1)}`}
          subtitle="Consommation production & pertes"
          color="rose"
          icon={<ArrowDownCircle className="w-4 h-4" />}
        />
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par matière, référence (OF-, BC-) ou auteur..."
            className="w-full bg-stone-900 border border-stone-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => setFilterSource(s.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterSource === s.id
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-800 hover:bg-stone-750 text-stone-300 border border-stone-700/60'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Journal */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des mouvements ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-stone-500 text-sm">
              Aucun mouvement de stock enregistré pour ces critères.
              <p className="text-xs mt-1">
                Les réceptions d'achat, fins de fournées et ajustements apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-950 text-stone-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Matière</th>
                    <th className="py-2 px-3 text-center">Source</th>
                    <th className="py-2 px-3 text-right">Variation</th>
                    <th className="py-2 px-3 text-right">Stock résultant</th>
                    <th className="py-2 px-3">Réf. / Motif</th>
                    <th className="py-2 px-3">Auteur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60">
                  {filtered.map((mv) => {
                    const meta = getSourceMeta(mv.source);
                    const Icon = meta.icon;
                    const isIn = mv.delta > 0;
                    return (
                      <tr key={mv.id} className="hover:bg-stone-800/30">
                        <td className="py-2.5 px-3 text-stone-400 whitespace-nowrap">
                          {new Date(mv.date).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-stone-200">{mv.materialName}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 font-bold ${meta.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {meta.label}
                          </span>
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${
                            isIn ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isIn ? '+' : ''}
                          {mv.delta} {mv.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right text-stone-300 whitespace-nowrap">
                          {mv.resultingStock} {mv.unit}
                        </td>
                        <td className="py-2.5 px-3 text-stone-400">
                          {mv.reference && <span className="font-mono">{mv.reference}</span>}
                          {mv.reason && <span className="block text-[11px]">{mv.reason}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-stone-400">{mv.recordedBy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
