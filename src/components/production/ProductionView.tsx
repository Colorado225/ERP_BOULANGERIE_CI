import React, { useState, useMemo } from 'react';
import { useBakery } from '../../context/BakeryContext';
import { ProductionOrder, ProductionStatus } from '../../types/bakery';
import {
  Factory,
  Plus,
  Flame,
  CheckCircle,
  Clock,
  ArrowRight,
  Filter,
  Check,
  AlertCircle,
  FileSpreadsheet,
  ChevronDown,
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
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  ChartCard,
  BarComparisonChart,
  Badge,
  Button,
} from '../ui';

export const ProductionView: React.FC = () => {
  const {
    productionOrders,
    recipes,
    updateProductionStatus,
    createProductionOrder,
    materials,
  } = useBakery();

  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [isNewOfModalOpen, setIsNewOfModalOpen] = useState<boolean>(false);

  // New OF Form
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(recipes[0]?.id || '');
  const [batchMultiplier, setBatchMultiplier] = useState<number>(2);
  const [shift, setShift] = useState<'Matin (04h30)' | 'Midi (11h00)' | 'Soir (16h00)'>('Matin (04h30)');
  const [bakerName, setBakerName] = useState<string>('Amadou Kouassi');
  const [notes, setNotes] = useState<string>('');

  const filteredOrders = productionOrders.filter((order) => {
    if (selectedShift === 'all') return true;
    return order.shift.includes(selectedShift);
  });

  // Production Metrics
  const totalPlannedPieces = productionOrders.reduce((sum, o) => sum + o.targetQuantity, 0);
  const totalReadyPieces = productionOrders
    .filter((o) => o.status === 'pret_en_rayon')
    .reduce((sum, o) => sum + (o.actualQuantity || o.targetQuantity), 0);
  const activeBatchesCount = productionOrders.filter((o) => o.status !== 'pret_en_rayon').length;

  // Chart data: production volume by product
  const productionChartData = useMemo(() => {
    const map: Record<string, { product: string; prevu: number; realise: number }> = {};
    productionOrders.forEach((o) => {
      if (!map[o.productName]) {
        map[o.productName] = { product: o.productName, prevu: 0, realise: 0 };
      }
      map[o.productName].prevu += o.targetQuantity;
      map[o.productName].realise += (o.actualQuantity || o.targetQuantity);
    });
    return Object.values(map);
  }, [productionOrders]);

  const handleCreateOf = (e: React.FormEvent) => {
    e.preventDefault();
    createProductionOrder({
      recipeId: selectedRecipeId,
      batchMultiplier,
      shift,
      bakerName,
      notes,
    });
    setIsNewOfModalOpen(false);
    setNotes('');
  };

  const getStatusStep = (status: ProductionStatus) => {
    switch (status) {
      case 'planifie':
        return 1;
      case 'petrissage':
        return 2;
      case 'au_four':
        return 3;
      case 'pret_en_rayon':
        return 4;
      default:
        return 0;
    }
  };

  const activeRecipe = recipes.find((r) => r.id === selectedRecipeId);

  return (
    <div className="flex-1 p-5 md:p-8 space-y-6 overflow-y-auto bg-stone-950 text-stone-100">
      {/* Top Header & Launch Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-6 rounded-3xl shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-stone-100">Ordres de Fabrication & Fournées</h1>
              <p className="text-xs text-stone-400">Suivi direct de l'atelier de panification & pâtisserie</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Shift filter */}
          <div className="flex items-center bg-stone-950 rounded-xl p-1 border border-stone-800">
            {['all', 'Matin', 'Midi', 'Soir'].map((s) => (
              <button
                key={s}
                onClick={() => setSelectedShift(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedShift === s
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {s === 'all' ? 'Tous' : s}
              </button>
            ))}
          </div>

          <Button
            variant="primary"
            onClick={() => setIsNewOfModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Créer un OF
          </Button>
        </div>
      </div>

      {/* Production StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pièces Prévues Aujourd'hui"
          value={totalPlannedPieces}
          subtitle="Capacité atelier engagée"
          color="amber"
          icon={<Factory className="w-4 h-4" />}
        />
        <StatCard
          title="Pièces Prêtes en Rayon"
          value={totalReadyPieces}
          subtitle="Livrées au magasin"
          color="emerald"
          icon={<CheckCircle className="w-4 h-4" />}
          trend={{
            value: totalPlannedPieces > 0 ? `${Math.round((totalReadyPieces / totalPlannedPieces) * 100)}%` : '0%',
            isPositive: true,
          }}
        />
        <StatCard
          title="Fournées en Cours"
          value={activeBatchesCount}
          subtitle="Pétrissage & cuisson"
          color="orange"
          icon={<Flame className="w-4 h-4" />}
        />
        <StatCard
          title="Matières Farines & Levures"
          value={`${materials.length} réf.`}
          subtitle="Suivi des réservations"
          color="sky"
          icon={<FileSpreadsheet className="w-4 h-4" />}
        />
      </div>

      {/* REUI ChartCard: Production Volume Analysis */}
      {productionChartData.length > 0 && (
        <ChartCard
          title="Volumes de Production par Gamme"
          subtitle="Comparatif des volumes planifiés sur les différents shifts du fournil"
          badge={<Badge variant="orange">{productionChartData.length} produits actifs</Badge>}
        >
          <BarComparisonChart
            data={productionChartData}
            xKey="product"
            yKey="prevu"
            height={200}
            barColor="#f97316"
            yFormatter={(v) => `${v} pièces`}
          />
        </ChartCard>
      )}

      {/* Production Order Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredOrders.map((order) => {
          const step = getStatusStep(order.status);
          const isDone = order.status === 'pret_en_rayon';

          return (
            <div
              key={order.id}
              className={`p-5 rounded-2xl border transition-all space-y-4 ${
                isDone
                  ? 'bg-stone-900/60 border-stone-800'
                  : order.status === 'au_four'
                  ? 'bg-orange-950/20 border-orange-600/60 shadow-lg shadow-orange-500/10'
                  : 'bg-stone-900 border-stone-800'
              }`}
            >
              {/* Card Top: Code & Shift */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-amber-400">{order.code}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                  {order.shift}
                </span>
              </div>

              {/* Title & Quantities */}
              <div>
                <h3 className="font-extrabold text-base text-stone-100">{order.productName}</h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Recette : <span className="text-stone-300">{order.recipeName}</span>
                </p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-black text-amber-400">{order.targetQuantity}</span>
                  <span className="text-xs text-stone-400">pièces prévues</span>
                  <span className="text-[11px] text-stone-500">({order.batchMultiplier}x pétrins)</span>
                </div>
              </div>

              {/* Baker & Scheduled time */}
              <div className="flex items-center justify-between text-xs text-stone-400 pt-2 border-t border-stone-800/80">
                <span className="flex items-center gap-1">
                  👨‍🍳 <span>{order.bakerName}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <span>{order.scheduledTime}</span>
                </span>
              </div>

              {/* Step Progression Visualizer */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase">
                  <span className={step >= 1 ? 'text-amber-400' : ''}>1. Planifié</span>
                  <span className={step >= 2 ? 'text-amber-400' : ''}>2. Pousse</span>
                  <span className={step >= 3 ? 'text-orange-400' : ''}>3. Au Four</span>
                  <span className={step >= 4 ? 'text-emerald-400' : ''}>4. Rayon</span>
                </div>
                <div className="grid grid-cols-4 gap-1 h-2">
                  <div className={`rounded-full ${step >= 1 ? 'bg-amber-500' : 'bg-stone-800'}`} />
                  <div className={`rounded-full ${step >= 2 ? 'bg-amber-500' : 'bg-stone-800'}`} />
                  <div className={`rounded-full ${step >= 3 ? 'bg-orange-500 animate-pulse' : 'bg-stone-800'}`} />
                  <div className={`rounded-full ${step >= 4 ? 'bg-emerald-500' : 'bg-stone-800'}`} />
                </div>
              </div>

              {/* Action Buttons to Advance Status */}
              <div className="pt-2">
                {order.status === 'planifie' && (
                  <button
                    onClick={() => updateProductionStatus(order.id, 'petrissage')}
                    className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 font-bold text-xs flex items-center justify-center gap-2 border border-stone-700 transition-colors"
                  >
                    <span>Lancer Pétrissage & Pousse</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {order.status === 'petrissage' && (
                  <button
                    onClick={() => updateProductionStatus(order.id, 'au_four')}
                    className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-stone-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                  >
                    <Flame className="w-4 h-4" />
                    <span>Enfourner à Sole Chaude</span>
                  </button>
                )}

                {order.status === 'au_four' && (
                  <button
                    onClick={() => updateProductionStatus(order.id, 'pret_en_rayon')}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-colors active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Défourner & Sortir en Rayon (+Stock)</span>
                  </button>
                )}

                {order.status === 'pret_en_rayon' && (
                  <div className="py-2 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 font-bold text-xs text-center flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Fournée terminée & Stock incrémenté</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* REUI MODAL: NOUVEL ORDRE DE FABRICATION */}
      <Modal
        isOpen={isNewOfModalOpen}
        onClose={() => setIsNewOfModalOpen(false)}
        title="Nouvel Ordre de Fabrication (OF)"
        description="Planifiez une nouvelle fournée et réservez les farines requises"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateOf}>
          <ModalContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-stone-300">Sélectionner la Recette :</label>
              <select
                value={selectedRecipeId}
                onChange={(e) => setSelectedRecipeId(e.target.value)}
                className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
              >
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (Rendement: {r.outputYield} {r.outputUnit})
                  </option>
                ))}
              </select>
            </div>

            {activeRecipe && (
              <div className="p-3 bg-stone-950 rounded-xl border border-stone-850 text-xs text-stone-400 space-y-1">
                <div className="flex justify-between">
                  <span>Quantité produite :</span>
                  <strong className="text-amber-400">
                    {activeRecipe.outputYield * batchMultiplier} {activeRecipe.outputUnit}
                  </strong>
                </div>
                <p className="text-[11px] text-stone-500">
                  Les matières premières seront déduites automatiquement lors de la validation finale en rayon.
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-stone-300">Multiplicateur de pétrin :</label>
              <div className="flex gap-2 mt-1">
                {[1, 2, 3, 4, 5].map((mult) => (
                  <button
                    key={mult}
                    type="button"
                    onClick={() => setBatchMultiplier(mult)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      batchMultiplier === mult
                        ? 'bg-amber-500 text-stone-950 border-amber-400'
                        : 'bg-stone-850 text-stone-300 border-stone-750'
                    }`}
                  >
                    {mult}x
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-300">Shift Fournil :</label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value as any)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
                >
                  <option value="Matin (04h30)">Matin (04h30)</option>
                  <option value="Midi (11h00)">Midi (11h00)</option>
                  <option value="Soir (16h00)">Soir (16h00)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300">Boulanger Responsable :</label>
                <input
                  type="text"
                  value={bakerName}
                  onChange={(e) => setBakerName(e.target.value)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300">Consignes / Notes de fournée :</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ex: Bien surveiller la buée sur le four 1"
                className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
              />
            </div>
          </ModalContent>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsNewOfModalOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Confirmer et Planifier
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
};
