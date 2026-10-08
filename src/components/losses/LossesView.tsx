import React, { useState, useMemo } from 'react';
import { useBakery } from '../../context/BakeryContext';
import { LossRecord } from '../../types/bakery';
import {
  Trash2,
  Plus,
  AlertOctagon,
  Sparkles,
  PieChart,
  HeartHandshake,
  TrendingDown,
  X,
  Recycle,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatCard,
  Modal,
  ModalContent,
  ModalFooter,
  ChartCard,
  DonutDistributionChart,
  Badge,
  Button,
} from '../ui';

export const LossesView: React.FC = () => {
  const { losses, products, formatMoney, addLossRecord, writeStoreId } = useBakery();

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(5);
  const [reason, setReason] = useState<LossRecord['reason']>('invendu_veille');
  const [destination, setDestination] = useState<LossRecord['destination']>('chapelure');
  const [recordedBy, setRecordedBy] = useState<string>('Amadou Kouassi');
  const [notes, setNotes] = useState<string>('');

  // Total losses valuation
  const totalLossValue = losses.reduce((sum, l) => sum + l.lossValue, 0);
  const donatedCount = losses.filter((l) => l.destination === 'don_caritatif').length;
  const breadcrumbCount = losses.filter((l) => l.destination === 'chapelure').length;

  const handleSaveLoss = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod || quantity <= 0) return;

    const lossValue = Math.round(prod.costPrice * quantity);

    addLossRecord({
      productId: prod.id,
      productName: prod.name,
      quantity,
      unit: prod.unit + 's',
      lossValue,
      reason,
      destination,
      recordedBy,
      storeId: writeStoreId,
      notes,
    });

    setIsAddModalOpen(false);
    setQuantity(5);
    setNotes('');
  };

  const getReasonLabel = (r: LossRecord['reason']) => {
    switch (r) {
      case 'invendu_veille':
        return 'Invendu de la veille';
      case 'brule_four':
        return 'Brûlé / Incident four';
      case 'defaut_forme':
        return 'Défaut de façonnage';
      case 'casse_manutention':
        return 'Casse vitrine / chariot';
      case 'perime':
        return 'Périmé';
      default:
        return 'Autre';
    }
  };

  const getDestinationBadge = (d: LossRecord['destination']) => {
    switch (d) {
      case 'chapelure':
        return { label: 'Recyclé en Chapelure 🥖', color: 'bg-amber-950/60 text-amber-300 border-amber-800' };
      case 'don_caritatif':
        return { label: 'Don Caritatif 🤝', color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800' };
      case 'alimentation_animale':
        return { label: 'Alimentation Ferme 🐔', color: 'bg-blue-950/60 text-blue-300 border-blue-800' };
      default:
        return { label: 'Rebut / Poubelle 🗑️', color: 'bg-rose-950/60 text-rose-300 border-rose-800' };
    }
  };

  // Losses Chart breakdown by reason
  const lossReasonChartData = useMemo(() => {
    const map: Record<string, number> = {};
    losses.forEach((l) => {
      const lbl = getReasonLabel(l.reason);
      map[lbl] = (map[lbl] || 0) + l.lossValue;
    });
    const colors = ['#f43f5e', '#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#64748b'];
    return Object.entries(map).map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length],
    }));
  }, [losses]);

  return (
    <div className="flex-1 p-5 md:p-8 space-y-6 overflow-y-auto bg-stone-950 text-stone-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-6 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-stone-100">Pertes & Anti-Gaspillage</h1>
            <p className="text-xs text-stone-400">Suivi des invendus, transformation en chapelure et dons caritatifs</p>
          </div>
        </div>

        <Button
          variant="danger"
          onClick={() => setIsAddModalOpen(true)}
          icon={<Plus className="w-4 h-4" />}
        >
          Déclarer une Perte
        </Button>
      </div>

      {/* KPI StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Coût Total des Pertes"
          value={formatMoney(totalLossValue)}
          subtitle={`${losses.length} signalements enregistrés`}
          color="rose"
          icon={<Trash2 className="w-4 h-4" />}
        />
        <StatCard
          title="Revalorisé en Chapelure"
          value={`${breadcrumbCount} lots`}
          subtitle="Pour le snacking & la panure"
          color="amber"
          icon={<Recycle className="w-4 h-4" />}
        />
        <StatCard
          title="Dons Caritatifs"
          value={`${donatedCount} actions`}
          subtitle="Banques alimentaires & foyers"
          color="emerald"
          icon={<HeartHandshake className="w-4 h-4" />}
        />
        <StatCard
          title="Taux de Revalorisation"
          value={losses.length > 0 ? `${Math.round(((breadcrumbCount + donatedCount) / losses.length) * 100)}%` : '0%'}
          subtitle="Économie circulaire atelier"
          color="sky"
          icon={<Sparkles className="w-4 h-4" />}
          trend={{ value: 'Anti-Gaspi', isPositive: true }}
        />
      </div>

      {/* REUI ChartCard: Breakdown by cause */}
      {lossReasonChartData.length > 0 && (
        <ChartCard
          title="Répartition Financière des Pertes par Cause"
          subtitle="Analyse de la valeur marchande perdue par typologie d'incident ou invendu"
          badge={<Badge variant="rose">{losses.length} déclarations</Badge>}
        >
          <DonutDistributionChart
            data={lossReasonChartData}
            height={180}
            formatMoney={formatMoney}
          />
        </ChartCard>
      )}

      {/* Losses List Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Produit Concerné</th>
                <th className="py-3 px-4">Quantité Perdue</th>
                <th className="py-3 px-4">Valeur de Perte</th>
                <th className="py-3 px-4">Cause Déclarée</th>
                <th className="py-3 px-4">Destination Anti-Gaspi</th>
                <th className="py-3 px-4">Déclaré par</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {losses.map((loss) => {
                const badge = getDestinationBadge(loss.destination);

                return (
                  <tr key={loss.id} className="hover:bg-stone-850/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-stone-400">{loss.date}</td>
                    <td className="py-3 px-4 font-bold text-stone-100">{loss.productName}</td>
                    <td className="py-3 px-4 font-black text-stone-200">
                      {loss.quantity} {loss.unit}
                    </td>
                    <td className="py-3 px-4 font-black text-rose-400">
                      {formatMoney(loss.lossValue)}
                    </td>
                    <td className="py-3 px-4 text-stone-300">
                      {getReasonLabel(loss.reason)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-400">{loss.recordedBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD LOSS */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-stone-800 pb-3">
              <h3 className="font-black text-lg text-stone-100">Déclarer une Perte / Invendu</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-400 hover:text-stone-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLoss} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-300">Produit concerné :</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock actuel: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-300">Quantité perdue :</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-300">Cause :</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as any)}
                    className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                  >
                    <option value="invendu_veille">Invendu de la veille</option>
                    <option value="brule_four">Brûlé au four</option>
                    <option value="defaut_forme">Défaut de façonnage</option>
                    <option value="casse_manutention">Casse vitrine</option>
                    <option value="perime">Périmé</option>
                    <option value="autre">Autre incident</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-300">Destination anti-gaspillage :</label>
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value as any)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                >
                  <option value="chapelure">Revalorisation en chapelure</option>
                  <option value="don_caritatif">Don caritatif / Association</option>
                  <option value="alimentation_animale">Alimentation animale</option>
                  <option value="poubelle">Rebut / Poubelle</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-stone-300">Déclaré par :</label>
                <input
                  type="text"
                  value={recordedBy}
                  onChange={(e) => setRecordedBy(e.target.value)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-300">Observations / Notes :</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ex: Problème sonde température sole four 2"
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-stone-100 font-black uppercase"
                >
                  Enregistrer la Perte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
