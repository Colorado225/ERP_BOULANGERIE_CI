import React, { useState } from 'react';
import { useBakery } from '../../context/BakeryContext';
import { RawMaterial } from '../../types/bakery';
import {
  Layers,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  SlidersHorizontal,
  Trash2,
  Calendar,
  X,
  PackageCheck,
  TrendingDown,
  Building,
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
  Badge,
  Button,
} from '../ui';

export const InventoryView: React.FC = () => {
  const {
    materials,
    suppliers,
    formatMoney,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    adjustMaterialStock,
  } = useBakery();

  const [search, setSearch] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [onlyAlerts, setOnlyAlerts] = useState<boolean>(false);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [adjustingMaterial, setAdjustingMaterial] = useState<RawMaterial | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(10);
  const [adjustReason, setAdjustReason] = useState<string>('Ajustement inventaire tournant');

  // New Material Form
  const [matName, setMatName] = useState<string>('');
  const [matCode, setMatCode] = useState<string>('');
  const [matCategory, setMatCategory] = useState<RawMaterial['category']>('farines');
  const [currentStock, setCurrentStock] = useState<number>(100);
  const [unit, setUnit] = useState<RawMaterial['unit']>('kg');
  const [minAlert, setMinAlert] = useState<number>(30);
  const [unitCost, setUnitCost] = useState<number>(650);
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [batchNum, setBatchNum] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [location, setLocation] = useState<string>('Réserve Centrale');

  // Filter materials
  const filteredMaterials = materials.filter((m) => {
    const matchCat = filterCategory === 'all' || m.category === filterCategory;
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.code.toLowerCase().includes(search.toLowerCase());
    const matchAlert = !onlyAlerts || m.currentStock <= m.minStockAlert;
    return matchCat && matchSearch && matchAlert;
  });

  // Total stock valuation
  const totalValuation = materials.reduce((sum, m) => sum + m.currentStock * m.unitCost, 0);
  const alertCount = materials.filter((m) => m.currentStock <= m.minStockAlert).length;

  const handleOpenAdd = () => {
    setMatName('');
    setMatCode(`MAT-${Date.now().toString().slice(-4)}`);
    setMatCategory('farines');
    setCurrentStock(50);
    setUnit('kg');
    setMinAlert(20);
    setUnitCost(700);
    setSupplierId(suppliers[0]?.id || '');
    setBatchNum(`LOT-${new Date().getFullYear()}-01`);
    setExpiryDate('2026-12-31');
    setLocation('Silo / Réserve');
    setIsAddModalOpen(true);
  };

  const handleSaveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matName || unitCost <= 0) return;

    addMaterial({
      name: matName,
      code: matCode,
      category: matCategory,
      currentStock,
      unit,
      minStockAlert: minAlert,
      unitCost,
      supplierId,
      batchNumber: batchNum,
      expiryDate,
      location,
    });
    setIsAddModalOpen(false);
  };

  const handleExecuteAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingMaterial) return;
    adjustMaterialStock(adjustingMaterial.id, adjustDelta, adjustReason);
    setAdjustingMaterial(null);
  };

  return (
    <div className="flex-1 p-5 md:p-8 space-y-6 overflow-y-auto bg-stone-950 text-stone-100">
      {/* Top Banner & KPI summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-6 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-stone-100">Stocks & Matières Premières</h1>
            <p className="text-xs text-stone-400">Farines, levures, beurres, emballages et valorisation du stock</p>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenAdd}
          icon={<Plus className="w-4 h-4" />}
        >
          Nouvelle Matière
        </Button>
      </div>

      {/* REUI StatCards: Inventory Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Valorisation Réserve & Silo"
          value={formatMoney(totalValuation)}
          subtitle="Au coût d'achat pondéré"
          color="amber"
          icon={<Layers className="w-4 h-4" />}
        />
        <StatCard
          title="Matières en Seuil Critique"
          value={alertCount}
          subtitle="Réapprovisionnement nécessaire"
          color="rose"
          icon={<AlertTriangle className="w-4 h-4" />}
          trend={{ value: alertCount > 0 ? 'Action requise' : 'Optimal', isPositive: alertCount === 0 }}
        />
        <StatCard
          title="Références Matières"
          value={`${materials.length} ingrédients`}
          subtitle="Farines, levures, chocolats"
          color="sky"
          icon={<PackageCheck className="w-4 h-4" />}
        />
        <StatCard
          title="Fournisseurs Actifs"
          value={`${suppliers.length} partenaires`}
          subtitle="Moulins, laiteries, emballage"
          color="purple"
          icon={<Building className="w-4 h-4" />}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-1 gap-2 w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par matière, code ou lot..."
              className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-stone-900 border border-stone-800 text-xs font-semibold rounded-xl px-3 py-2 text-stone-200 focus:outline-none"
          >
            <option value="all">Toutes matières</option>
            <option value="farines">Farines & Blés</option>
            <option value="produits_laitiers">Produits Laitiers & Beurres</option>
            <option value="levures_ameliorants">Levures & Ferments</option>
            <option value="sucres_aromes">Sucres & Sels</option>
            <option value="garnitures">Garnitures & Chocolats</option>
            <option value="emballages">Sachets & Boîtes</option>
          </select>
        </div>

        {/* Toggle only alerts */}
        <button
          onClick={() => setOnlyAlerts(!onlyAlerts)}
          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
            onlyAlerts
              ? 'bg-red-500/20 text-red-300 border-red-500/50'
              : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Alertes Seuil ({alertCount})</span>
        </button>
      </div>

      {/* Materials Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-950/80 text-stone-400 uppercase text-[10px] border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">Matière Première</th>
                <th className="py-3 px-4">Catégorie</th>
                <th className="py-3 px-4">Stock Actuel</th>
                <th className="py-3 px-4">Seuil Min</th>
                <th className="py-3 px-4">Coût Unitaire</th>
                <th className="py-3 px-4">Valeur Stock</th>
                <th className="py-3 px-4">N° Lot & Péremption</th>
                <th className="py-3 px-4 text-right">Ajuster</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {filteredMaterials.map((mat) => {
                const isCritical = mat.currentStock <= mat.minStockAlert;
                const value = mat.currentStock * mat.unitCost;

                return (
                  <tr key={mat.id} className="hover:bg-stone-850/50 transition-colors">
                    {/* Name & Code */}
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-bold text-stone-100">{mat.name}</p>
                        <span className="text-[10px] text-stone-500 font-mono">{mat.code} • {mat.location}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700 capitalize">
                        {mat.category.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Current Stock */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-black text-sm px-2.5 py-0.5 rounded-lg border ${
                          isCritical
                            ? 'bg-red-950/70 text-red-300 border-red-800'
                            : 'bg-stone-950 text-stone-200 border-stone-800'
                        }`}
                      >
                        {mat.currentStock} {mat.unit}
                      </span>
                    </td>

                    {/* Min Alert */}
                    <td className="py-3.5 px-4 text-stone-400">
                      {mat.minStockAlert} {mat.unit}
                    </td>

                    {/* Unit Cost */}
                    <td className="py-3.5 px-4 text-stone-300 font-medium">
                      {formatMoney(mat.unitCost)} / {mat.unit}
                    </td>

                    {/* Total Value */}
                    <td className="py-3.5 px-4 font-black text-amber-400">
                      {formatMoney(value)}
                    </td>

                    {/* Batch & Expiry */}
                    <td className="py-3.5 px-4 text-[11px]">
                      <p className="font-mono text-stone-300">{mat.batchNumber || 'N/A'}</p>
                      <p className="text-stone-500">{mat.expiryDate || 'N/A'}</p>
                    </td>

                    {/* Quick Adjust Button */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setAdjustingMaterial(mat);
                            setAdjustDelta(0);
                            setAdjustReason('Inventaire physique');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-[11px] border border-stone-700"
                        >
                          Ajuster
                        </button>
                        <button
                          onClick={() => deleteMaterial(mat.id)}
                          className="p-1 rounded-lg text-stone-500 hover:text-rose-400"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* REUI QUICK ADJUST MODAL */}
      {adjustingMaterial && (
        <Modal
          isOpen={Boolean(adjustingMaterial)}
          onClose={() => setAdjustingMaterial(null)}
          title="Ajuster le Stock Matière"
          description={`Correction manuelle ou inventaire physique pour ${adjustingMaterial.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleExecuteAdjust}>
            <ModalContent className="space-y-4">
              <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 text-xs">
                <p className="font-bold text-amber-400">{adjustingMaterial.name}</p>
                <p className="text-stone-400 mt-0.5">
                  Stock actuel : <strong>{adjustingMaterial.currentStock} {adjustingMaterial.unit}</strong>
                </p>
              </div>

              <div>
                <label className="font-semibold text-stone-300 text-xs">Variation de stock (+/-) :</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(Number(e.target.value))}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 font-bold text-sm"
                  />
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  Nouveau stock résultant : <strong className="text-amber-400">{Math.max(0, adjustingMaterial.currentStock + adjustDelta)} {adjustingMaterial.unit}</strong>
                </p>
              </div>

              <div>
                <label className="font-semibold text-stone-300 text-xs">Motif de l’ajustement :</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="ex: Écart d’inventaire pesée physique"
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
                />
              </div>
            </ModalContent>

            <ModalFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAdjustingMaterial(null)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
              >
                Valider l’Ajustement
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* REUI NEW MATERIAL MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Nouvelle Matière Première"
        description="Enregistrez une farine, un ferment ou un emballage avec son seuil d'alerte"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveMaterial}>
          <ModalContent className="space-y-4 text-xs max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-stone-300">Nom de la matière *</label>
                <input
                  type="text"
                  required
                  value={matName}
                  onChange={(e) => setMatName(e.target.value)}
                  placeholder="ex: Farine de Seigle Bio T130"
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-300">Code / Référence</label>
                <input
                  type="text"
                  value={matCode}
                  onChange={(e) => setMatCode(e.target.value)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-stone-300">Catégorie</label>
                <select
                  value={matCategory}
                  onChange={(e) => setMatCategory(e.target.value as any)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                >
                  <option value="farines">Farines & Blés</option>
                  <option value="produits_laitiers">Produits Laitiers & Beurres</option>
                  <option value="levures_ameliorants">Levures & Ferments</option>
                  <option value="sucres_aromes">Sucres & Sels</option>
                  <option value="garnitures">Garnitures & Chocolats</option>
                  <option value="emballages">Sachets & Boîtes</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-stone-300">Unité de mesure</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as any)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                >
                  <option value="kg">kg (Kilogrammes)</option>
                  <option value="g">g (Grammes)</option>
                  <option value="L">L (Litres)</option>
                  <option value="unite">unité (Pièces)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-stone-300">Stock initial</label>
                <input
                  type="number"
                  min="0"
                  value={currentStock}
                  onChange={(e) => setCurrentStock(Number(e.target.value))}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-300">Alerte Seuil Bas</label>
                <input
                  type="number"
                  min="0"
                  value={minAlert}
                  onChange={(e) => setMinAlert(Number(e.target.value))}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-300">Coût unitaire</label>
                <input
                  type="number"
                  min="1"
                  value={unitCost}
                  onChange={(e) => setUnitCost(Number(e.target.value))}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 font-bold text-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-stone-300">Numéro de Lot</label>
                <input
                  type="text"
                  value={batchNum}
                  onChange={(e) => setBatchNum(e.target.value)}
                  placeholder="LOT-2026-X"
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-300">Date de péremption</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-stone-300">Emplacement physique</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="ex: Silo A, Chambre Froide Positive 4°C"
                className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
              />
            </div>
          </ModalContent>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Enregistrer
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
};
