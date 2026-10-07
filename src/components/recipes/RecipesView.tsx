import React, { useState, useMemo } from 'react';
import { useBakery } from '../../context/BakeryContext';
import { Recipe, RecipeIngredient } from '../../types/bakery';
import {
  BookOpen,
  Plus,
  Flame,
  Clock,
  Thermometer,
  Calculator,
  Play,
  Trash2,
  Edit3,
  Layers,
  Check,
  X,
  PieChart as PieChartIcon,
  ChevronDown,
  Printer,
  Copy,
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
  DropdownDivider,
  ChartCard,
  DonutDistributionChart,
  Badge,
  Button,
} from '../ui';

export const RecipesView: React.FC = () => {
  const {
    recipes,
    materials,
    products,
    formatMoney,
    addRecipe,
    deleteRecipe,
    createProductionOrder,
    setActiveTab,
  } = useBakery();

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(recipes[0] || null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isLaunchBakeModalOpen, setIsLaunchBakeModalOpen] = useState<boolean>(false);

  // New Recipe form states
  const [newRecipeName, setNewRecipeName] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [outputYield, setOutputYield] = useState<number>(50);
  const [outputUnit, setOutputUnit] = useState<string>('pièces');
  const [prepTime, setPrepTime] = useState<number>(30);
  const [proofingTime, setProofingTime] = useState<number>(90);
  const [bakingTime, setBakingTime] = useState<number>(20);
  const [bakingTemp, setBakingTemp] = useState<number>(240);
  const [ingredientsList, setIngredientsList] = useState<RecipeIngredient[]>([]);
  const [instructionsText, setInstructionsText] = useState<string>('');

  // Selected ingredient addition temp state
  const [tempMatId, setTempMatId] = useState<string>(materials[0]?.id || '');
  const [tempQty, setTempQty] = useState<number>(1);

  // Launch Production Order Modal states
  const [batchMultiplier, setBatchMultiplier] = useState<number>(1);
  const [bakerName, setBakerName] = useState<string>('Amadou Kouassi');
  const [shift, setShift] = useState<'Matin (04h30)' | 'Midi (11h00)' | 'Soir (16h00)'>('Matin (04h30)');

  // Handlers for ingredients
  const handleAddIngredient = () => {
    const mat = materials.find((m) => m.id === tempMatId);
    if (!mat || tempQty <= 0) return;

    const cost = Math.round(mat.unitCost * tempQty);
    setIngredientsList((prev) => [
      ...prev,
      {
        materialId: mat.id,
        materialName: mat.name,
        quantity: tempQty,
        unit: mat.unit,
        cost,
      },
    ]);
    setTempQty(1);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredientsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipeName || ingredientsList.length === 0) return;

    const linkedProd = products.find((p) => p.id === selectedProductId);
    const totalCost = ingredientsList.reduce((sum, item) => sum + item.cost, 0);
    const costPerUnit = Math.round(totalCost / (outputYield || 1));

    const instructionsArray = instructionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    addRecipe({
      name: newRecipeName,
      productId: selectedProductId,
      productName: linkedProd?.name || 'Produit Boulangerie',
      outputYield,
      outputUnit,
      ingredients: ingredientsList,
      preparationTimeMin: prepTime,
      proofingTimeMin: proofingTime,
      bakingTimeMin: bakingTime,
      bakingTempC: bakingTemp,
      instructions: instructionsArray.length > 0 ? instructionsArray : ['Pétrissage standard, cuisson surveillée.'],
      totalCost,
      costPerUnit,
    });

    setIsAddModalOpen(false);
    // Reset form
    setNewRecipeName('');
    setIngredientsList([]);
    setInstructionsText('');
  };

  const handleLaunchProduction = () => {
    if (!selectedRecipe) return;
    createProductionOrder({
      recipeId: selectedRecipe.id,
      batchMultiplier,
      shift,
      bakerName,
    });
    setIsLaunchBakeModalOpen(false);
    setActiveTab('production');
  };

  // Associated product for current selected recipe
  const linkedProduct = selectedRecipe ? products.find((p) => p.id === selectedRecipe.productId) : null;
  const marginPerUnit = linkedProduct && selectedRecipe ? linkedProduct.price - selectedRecipe.costPerUnit : 0;
  const marginPercent = linkedProduct && linkedProduct.price > 0 ? Math.round((marginPerUnit / linkedProduct.price) * 100) : 0;

  // Donut chart of ingredient costs
  const ingredientChartData = useMemo(() => {
    if (!selectedRecipe || !selectedRecipe.ingredients.length) return [];
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#f97316', '#14b8a6'];
    return selectedRecipe.ingredients.map((ing, idx) => ({
      name: ing.materialName,
      value: ing.cost,
      color: colors[idx % colors.length],
    }));
  }, [selectedRecipe]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-stone-950">
      {/* LEFT: RECIPE DIRECTORY LIST */}
      <div className="w-full lg:w-80 bg-stone-900 border-r border-stone-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2 className="font-extrabold text-stone-100 text-sm">Fiches Techniques</h2>
          </div>
          <Button
            size="xs"
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Nouvelle
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {recipes.map((r) => {
            const isSelected = selectedRecipe?.id === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedRecipe(r)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/50 shadow-md'
                    : 'bg-stone-950/60 border-stone-800 hover:border-stone-700 hover:bg-stone-850'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-stone-100 line-clamp-1">{r.name}</span>
                  <Badge variant={isSelected ? 'amber' : 'stone'} size="sm">
                    {r.outputYield} {r.outputUnit}
                  </Badge>
                </div>
                <p className="text-[11px] text-stone-400 line-clamp-1">Pour : {r.productName}</p>
                <div className="mt-2 pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-stone-400">Coût / pièce :</span>
                  <span className="font-extrabold text-amber-300">{formatMoney(r.costPerUnit)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT: DETAILED RECIPE SHEET & COST BREAKDOWN */}
      <div className="flex-1 p-5 md:p-8 overflow-y-auto space-y-6">
        {selectedRecipe ? (
          <>
            {/* Header / Actions with REUI Dropdown & Buttons */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-6 rounded-3xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🥖</span>
                  <h1 className="text-xl font-black text-stone-100">{selectedRecipe.name}</h1>
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  Rendement théorique : <strong className="text-amber-400">{selectedRecipe.outputYield} {selectedRecipe.outputUnit}</strong> par pétrin standard.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => setIsLaunchBakeModalOpen(true)}
                  icon={<Play className="w-4 h-4 fill-stone-950" />}
                >
                  Lancer Fournée (OF)
                </Button>

                {/* REUI Dropdown for more recipe actions */}
                <Dropdown>
                  <DropdownTrigger>
                    <Button variant="secondary" icon={<ChevronDown className="w-3.5 h-3.5" />} iconPosition="right">
                      Actions
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu align="right">
                    <DropdownItem
                      icon={<Play className="w-4 h-4 text-amber-400" />}
                      onClick={() => setIsLaunchBakeModalOpen(true)}
                      variant="amber"
                    >
                      Lancer en production
                    </DropdownItem>
                    <DropdownItem
                      icon={<Copy className="w-4 h-4" />}
                      onClick={() => {
                        setNewRecipeName(`${selectedRecipe.name} (Copie)`);
                        setSelectedProductId(selectedRecipe.productId);
                        setOutputYield(selectedRecipe.outputYield);
                        setOutputUnit(selectedRecipe.outputUnit);
                        setPrepTime(selectedRecipe.preparationTimeMin);
                        setProofingTime(selectedRecipe.proofingTimeMin);
                        setBakingTime(selectedRecipe.bakingTimeMin);
                        setBakingTemp(selectedRecipe.bakingTempC);
                        setIngredientsList([...selectedRecipe.ingredients]);
                        setInstructionsText(selectedRecipe.instructions.join('\n'));
                        setIsAddModalOpen(true);
                      }}
                    >
                      Dupliquer cette fiche
                    </DropdownItem>
                    <DropdownDivider />
                    <DropdownItem
                      icon={<Trash2 className="w-4 h-4" />}
                      variant="danger"
                      onClick={() => deleteRecipe(selectedRecipe.id)}
                    >
                      Supprimer la recette
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
            </div>

            {/* Economic Calculations StatCards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <StatCard
                title="Coût Total Matières"
                value={formatMoney(selectedRecipe.totalCost)}
                subtitle="Pour 1 pétrin complet"
                color="sky"
                icon={<Calculator className="w-4 h-4" />}
              />
              <StatCard
                title="Coût Unitaire Matière"
                value={formatMoney(selectedRecipe.costPerUnit)}
                subtitle={`Par ${selectedRecipe.outputUnit.slice(0, -1) || 'pièce'}`}
                color="amber"
                icon={<Flame className="w-4 h-4" />}
              />
              <StatCard
                title="Prix Vente Conseillé"
                value={linkedProduct ? formatMoney(linkedProduct.price) : 'Non lié'}
                subtitle="Au comptoir boutique"
                color="purple"
                icon={<BookOpen className="w-4 h-4" />}
              />
              <StatCard
                title="Marge Brute / Pièce"
                value={formatMoney(marginPerUnit)}
                subtitle="Rentabilité unitaire"
                color="emerald"
                trend={{ value: `${marginPercent}%`, isPositive: marginPercent >= 40 }}
              />
            </div>

            {/* REUI ChartCard: Répartition des coûts matières & Donut chart */}
            {ingredientChartData.length > 0 && (
              <ChartCard
                title="Décomposition Analytique des Coûts Matières"
                subtitle="Part de chaque matière première dans le coût de revient du pétrin"
                badge={<Badge variant="amber">{ingredientChartData.length} ingrédients</Badge>}
              >
                <DonutDistributionChart
                  data={ingredientChartData}
                  height={180}
                  formatMoney={formatMoney}
                />
              </ChartCard>
            )}

            {/* Technical Baking Parameters Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-900/60 border border-stone-800 p-4 rounded-2xl text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="text-stone-400">Pétrissage :</p>
                  <strong className="text-stone-200">{selectedRecipe.preparationTimeMin} min</strong>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                <div>
                  <p className="text-stone-400">Pointage / Pousse :</p>
                  <strong className="text-stone-200">{selectedRecipe.proofingTimeMin} min</strong>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <div>
                  <p className="text-stone-400">Temps de cuisson :</p>
                  <strong className="text-stone-200">{selectedRecipe.bakingTimeMin} min</strong>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-rose-400" />
                <div>
                  <p className="text-stone-400">T° Four :</p>
                  <strong className="text-stone-200">{selectedRecipe.bakingTempC} °C</strong>
                </div>
              </div>
            </div>

            {/* Ingredients Table */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <h3 className="font-extrabold text-sm text-stone-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Composition des Ingrédients & Matières Premières</span>
                </h3>
                <span className="text-xs text-stone-400 font-mono">
                  {selectedRecipe.ingredients.length} ingrédients
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-950 text-stone-400 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Matière Première</th>
                      <th className="py-2.5 px-3">Quantité requise</th>
                      <th className="py-2.5 px-3">Unité</th>
                      <th className="py-2.5 px-3">Coût calculé</th>
                      <th className="py-2.5 px-3 rounded-r-lg text-right">% du coût</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60">
                    {selectedRecipe.ingredients.map((ing, idx) => {
                      const pctOfCost = selectedRecipe.totalCost > 0 ? Math.round((ing.cost / selectedRecipe.totalCost) * 100) : 0;
                      return (
                        <tr key={idx} className="hover:bg-stone-850/40">
                          <td className="py-2.5 px-3 font-bold text-stone-200">{ing.materialName}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-400">{ing.quantity}</td>
                          <td className="py-2.5 px-3 text-stone-400">{ing.unit}</td>
                          <td className="py-2.5 px-3 font-bold text-stone-200">{formatMoney(ing.cost)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-stone-400">{pctOfCost}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-3">
              <h3 className="font-extrabold text-sm text-stone-100">Protocole Artisanal de Fabrication</h3>
              <ol className="space-y-2 text-xs text-stone-300 list-decimal list-inside leading-relaxed">
                {selectedRecipe.instructions.map((step, idx) => (
                  <li key={idx} className="p-2 rounded-lg bg-stone-950 border border-stone-850">
                    <span className="font-semibold">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-stone-500 text-sm">
            Sélectionnez ou créez une fiche recette à gauche.
          </div>
        )}
      </div>

      {/* REUI MODAL: CREATE NEW RECIPE */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Nouvelle Fiche Recette & Coût de Revient"
        description="Définissez les dosages précis des ingrédients et le rendement par pétrin"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveRecipe}>
          <ModalContent className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-300">Nom de la recette *</label>
                <input
                  type="text"
                  required
                  value={newRecipeName}
                  onChange={(e) => setNewRecipeName(e.target.value)}
                  placeholder="ex: Pain Complet aux Noix (Fournée 60 pcs)"
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300">Produit final associé</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatMoney(p.price)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300">Rendement par pétrin</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    value={outputYield}
                    onChange={(e) => setOutputYield(Number(e.target.value))}
                    className="w-24 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
                  />
                  <input
                    type="text"
                    value={outputUnit}
                    onChange={(e) => setOutputUnit(e.target.value)}
                    placeholder="pièces / baguettes"
                    className="flex-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300">T° Cuisson Four (°C)</label>
                <input
                  type="number"
                  value={bakingTemp}
                  onChange={(e) => setBakingTemp(Number(e.target.value))}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
                />
              </div>
            </div>

            {/* INGREDIENTS SECTION */}
            <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 space-y-3">
              <h4 className="font-bold text-xs text-amber-400 uppercase">Ajouter des Ingrédients</h4>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={tempMatId}
                  onChange={(e) => setTempMatId(e.target.value)}
                  className="bg-stone-900 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-stone-100 flex-1 min-w-[160px]"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({formatMoney(m.unitCost)} / {m.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={tempQty}
                  onChange={(e) => setTempQty(Number(e.target.value))}
                  className="w-24 bg-stone-900 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-stone-100"
                  placeholder="Quantité"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="xs"
                  onClick={handleAddIngredient}
                >
                  + Ajouter
                </Button>
              </div>

              {/* Added ingredients list */}
              {ingredientsList.length > 0 && (
                <div className="divide-y divide-stone-850 pt-2 text-xs">
                  {ingredientsList.map((ing, idx) => (
                    <div key={idx} className="py-1.5 flex justify-between items-center text-stone-300">
                      <span>{ing.materialName} ({ing.quantity} {ing.unit})</span>
                      <div className="flex items-center gap-3">
                        <strong className="text-amber-400">{formatMoney(ing.cost)}</strong>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(idx)}
                          className="text-stone-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300">Instructions de fabrication (1 étape par ligne)</label>
              <textarea
                rows={3}
                value={instructionsText}
                onChange={(e) => setInstructionsText(e.target.value)}
                placeholder="Étape 1 : Autolyse 30 min&#10;Étape 2 : Pétrissage 10 min&#10;Étape 3 : Cuisson 22 min buée forte"
                className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
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
              disabled={ingredientsList.length === 0}
            >
              Enregistrer Recette
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* REUI MODAL: LAUNCH PRODUCTION ORDER */}
      {selectedRecipe && (
        <Modal
          isOpen={isLaunchBakeModalOpen}
          onClose={() => setIsLaunchBakeModalOpen(false)}
          title="Créer un Ordre de Fabrication (OF)"
          description={`Lancer la production atelier pour ${selectedRecipe.name}`}
          maxWidth="md"
        >
          <ModalContent className="space-y-3">
            <div className="p-3 bg-stone-950 rounded-xl border border-stone-800">
              <p className="font-bold text-amber-400">{selectedRecipe.name}</p>
              <p className="text-[11px] text-stone-400">
                Produira {selectedRecipe.outputYield * batchMultiplier} {selectedRecipe.outputUnit}.
              </p>
            </div>

            <div>
              <label className="font-semibold text-stone-300 text-xs">Multiplicateur de pétrin :</label>
              <div className="flex gap-2 mt-1">
                {[1, 2, 3, 4].map((mult) => (
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
                    {mult}x ({selectedRecipe.outputYield * mult} pcs)
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-semibold text-stone-300 text-xs">Shift de cuisson :</label>
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
              <label className="font-semibold text-stone-300 text-xs">Boulanger responsable :</label>
              <input
                type="text"
                value={bakerName}
                onChange={(e) => setBakerName(e.target.value)}
                className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
              />
            </div>
          </ModalContent>

          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => setIsLaunchBakeModalOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleLaunchProduction}
              icon={<Play className="w-4 h-4 fill-stone-950" />}
            >
              Lancer la Fournée
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
};
