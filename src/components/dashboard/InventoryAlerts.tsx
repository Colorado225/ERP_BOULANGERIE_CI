import React, { useState, useEffect } from 'react';
import { useBakery } from '../../context/BakeryContext';
import { Product } from '../../types/bakery';
import { batchManager, BatchAlert, BatchAlertLevel } from '../../services/batchManager';
import {
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Flame,
  Plus,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  TrendingDown,
  Clock,
  XCircle,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
} from '../ui';

interface InventoryAlertsProps {
  className?: string;
  onNavigateTab?: (tab: string) => void;
}

export const InventoryAlerts: React.FC<InventoryAlertsProps> = ({
  className = '',
  onNavigateTab,
}) => {
  const {
    products,
    materials,
    recipes,
    updateProduct,
    createProductionOrder,
    setActiveTab,
    formatMoney,
    setNotification,
  } = useBakery();

  const [activeFilter, setActiveFilter] = useState<'all' | 'immediate' | 'warning'>('all');
  const [selectedRestockProduct, setSelectedRestockProduct] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(10);
  const [isBakingOrderModalOpen, setIsBakingOrderModalOpen] = useState(false);
  const [bakingProduct, setBakingProduct] = useState<Product | null>(null);
  const [bakingMultiplier, setBakingMultiplier] = useState<number>(2);

  // Products currently below or at their minStock threshold
  const belowMinStockProducts = products.filter((p) => p.stock <= p.minStock);

  // Items needing immediate replenishment: stock is 0 or less than 35% of minStock
  const immediateReplenishmentItems = belowMinStockProducts.filter(
    (p) => p.stock === 0 || p.stock <= Math.max(1, Math.floor(p.minStock * 0.35))
  );

  // Items with moderate warning (between 35% and 100% of minStock)
  const warningItems = belowMinStockProducts.filter(
    (p) => !immediateReplenishmentItems.some((imm) => imm.id === p.id)
  );

  // Filtered list based on active tab
  const displayedItems =
    activeFilter === 'immediate'
      ? immediateReplenishmentItems
      : activeFilter === 'warning'
        ? warningItems
        : belowMinStockProducts;

  // Total deficit in units needed to reach minStock
  const totalUnitsDeficit = belowMinStockProducts.reduce(
    (sum, p) => sum + Math.max(0, p.minStock - p.stock),
    0
  );

  // Alertes de lots expirés ou bientôt expirés (Phase 2.4 - Traçabilité DLC)
  const [batchAlerts, setBatchAlerts] = useState<BatchAlert[]>([]);

  useEffect(() => {
    // Met à jour le statut des lots au chargement du composant
    const alerts = batchManager.updateAllBatchesStatus(products);
    setBatchAlerts(alerts);
  }, [products]);

  // Nombre d'alertes de lots
  const expiredBatchesCount = batchAlerts.filter(a => a.level === BatchAlertLevel.EXPIRED).length;
  const criticalBatchesCount = batchAlerts.filter(a => a.level === BatchAlertLevel.CRITICAL).length;

  // Handler for quick replenishment
  const handleQuickRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestockProduct) return;

    const newStock = selectedRestockProduct.stock + Math.max(1, restockAmount);
    updateProduct(selectedRestockProduct.id, { stock: newStock });

    setNotification?.(
      `Stock réapprovisionné : +${restockAmount} ${selectedRestockProduct.unit} pour "${selectedRestockProduct.name}" (Total : ${newStock})`
    );

    setSelectedRestockProduct(null);
  };

  // Handler for launching a quick bake OF
  const handleLaunchBakeConfirm = () => {
    if (!bakingProduct) return;

    // Find linked recipe or first matching
    const recipe = recipes.find(
      (r) => r.productId === bakingProduct.id || r.id === bakingProduct.recipeId
    );

    if (recipe) {
      createProductionOrder({
        recipeId: recipe.id,
        batchMultiplier: bakingMultiplier,
        shift: 'Matin (04h30)',
        bakerName: 'Amadou Kouassi (Chef)',
        notes: `Fournée prioritaire d'urgence lancée depuis le Dashboard pour réapprovisionner "${bakingProduct.name}".`,
      });
      setNotification?.(
        `Ordre de fabrication généré avec succès pour "${recipe.name}" (x${bakingMultiplier}) !`
      );
    } else {
      // Fallback: navigate to production tab
      if (onNavigateTab) {
        onNavigateTab('production');
      } else {
        setActiveTab('production');
      }
    }

    setIsBakingOrderModalOpen(false);
    setBakingProduct(null);
  };

  return (
    <Card className={`overflow-hidden border-stone-850 shadow-xl ${className}`}>
      {/* CARD HEADER */}
      <CardHeader
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                if (onNavigateTab) onNavigateTab('products');
                else setActiveTab('products');
              }}
              icon={<ArrowRight className="w-3.5 h-3.5 text-amber-400" />}
              iconPosition="right"
            >
              <span className="text-amber-400 font-bold">Catalogue</span>
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-2.5">
          <CardTitle
            icon={
              immediateReplenishmentItems.length > 0 ? (
                <div className="relative">
                  <AlertOctagon className="w-5 h-5 text-rose-500 animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                </div>
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              )
            }
          >
            Alertes Stocks Rayon (minStock)
          </CardTitle>

          {belowMinStockProducts.length > 0 ? (
            <Badge
              variant={immediateReplenishmentItems.length > 0 ? 'rose' : 'amber'}
              size="sm"
            >
              {belowMinStockProducts.length} sous le seuil
            </Badge>
          ) : (
            <Badge variant="emerald" size="sm" dot>
              Conforme
            </Badge>
          )}
        </div>
        <CardDescription>
          Articles nécessitant un réapprovisionnement ou une fournée prioritaire
        </CardDescription>
      </CardHeader>

      {/* FILTER BUTTONS & URGENCY COUNTERS */}
      <div className="px-5 pt-1 pb-3 flex flex-wrap items-center justify-between gap-2 border-b border-stone-850 text-xs">
        <div className="flex items-center gap-1.5 bg-stone-950 p-1 rounded-xl border border-stone-800">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${activeFilter === 'all'
              ? 'bg-amber-500 text-stone-950 shadow'
              : 'text-stone-400 hover:text-stone-200'
              }`}
          >
            Tous ({belowMinStockProducts.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('immediate')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors ${activeFilter === 'immediate'
              ? 'bg-rose-500 text-white shadow'
              : 'text-stone-400 hover:text-rose-400'
              }`}
          >
            <AlertOctagon className="w-3 h-3 text-rose-400" />
            <span>Urgent / Immédiat ({immediateReplenishmentItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('warning')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${activeFilter === 'warning'
              ? 'bg-stone-700 text-stone-100 shadow'
              : 'text-stone-400 hover:text-stone-200'
              }`}
          >
            Stock Faible ({warningItems.length})
          </button>
        </div>

        {immediateReplenishmentItems.length > 0 && (
          <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
            <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
            <span>{immediateReplenishmentItems.length} article(s) en rupture imminente</span>
          </div>
        )}

        {/* Alertes DLC / Lots expirés (Phase 2.4) */}
        {batchAlerts.length > 0 && (
          <div className="flex items-center gap-2 mt-2 w-full">
            {expiredBatchesCount > 0 && (
              <div className="flex items-center gap-1 text-rose-500 font-bold text-[11px] bg-rose-500/10 px-2 py-1 rounded-lg">
                <XCircle className="w-3.5 h-3.5" />
                <span>{expiredBatchesCount} lot(s) expiré(s)</span>
              </div>
            )}
            {criticalBatchesCount > 0 && (
              <div className="flex items-center gap-1 text-amber-500 font-bold text-[11px] bg-amber-500/10 px-2 py-1 rounded-lg">
                <Clock className="w-3.5 h-3.5" />
                <span>{criticalBatchesCount} lot(s) critique(s)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CARD CONTENT: LIST OF ALERT ITEMS */}
      <CardContent className="p-4 space-y-2.5 max-h-[380px] overflow-y-auto">
        {displayedItems.length === 0 ? (
          <div className="py-8 px-4 text-center rounded-2xl bg-emerald-950/20 border border-emerald-900/40 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-emerald-300">
              {activeFilter === 'immediate'
                ? 'Aucun article en rupture immédiate'
                : 'Tous les stocks sont au-dessus de leur seuil minimal'}
            </p>
            <p className="text-xs text-stone-400 max-w-sm mx-auto">
              Les niveaux de stock en vitrine et réserve respectent les seuils de sécurité
              configurés.
            </p>
          </div>
        ) : (
          displayedItems.map((product) => {
            const isOutOfStock = product.stock === 0;
            const isImmediate =
              isOutOfStock || product.stock <= Math.max(1, Math.floor(product.minStock * 0.35));
            const deficit = Math.max(0, product.minStock - product.stock);
            const stockPct =
              product.minStock > 0
                ? Math.min(100, Math.round((product.stock / product.minStock) * 100))
                : 0;
            const hasLinkedRecipe = recipes.some(
              (r) => r.productId === product.id || r.id === product.recipeId
            );

            return (
              <div
                key={product.id}
                className={`p-3 rounded-2xl border transition-all ${isImmediate
                  ? 'bg-rose-950/25 border-rose-900/60 hover:border-rose-700/80'
                  : 'bg-stone-900/90 border-stone-800 hover:border-stone-700'
                  }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Product Info & Alert Icon */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border ${isImmediate
                        ? 'bg-rose-950/80 border-rose-800/80 text-rose-300 shadow-sm'
                        : 'bg-stone-850 border-stone-750 text-stone-200'
                        }`}
                    >
                      {product.imageIcon || '🥖'}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* ALERT ICON FOR ITEMS NEEDING IMMEDIATE REPLENISHMENT */}
                        {isImmediate ? (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-extrabold tracking-wide uppercase shadow-xs animate-pulse"
                            title="Réapprovisionnement Immédiat Requis"
                          >
                            <AlertOctagon className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>Immédiat</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold tracking-wide uppercase"
                            title="Niveau sous le seuil de sécurité"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Sous Seuil</span>
                          </span>
                        )}

                        <h4 className="font-bold text-xs sm:text-sm text-stone-100">
                          {product.name}
                        </h4>

                        <Badge variant="stone" size="sm">
                          {product.category}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-stone-400">
                        <span>
                          Réf: <strong className="font-mono text-stone-300">{product.sku}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Prix : <strong className="text-amber-400">{formatMoney(product.price)}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Manque :{' '}
                          <strong className="text-rose-400">
                            +{deficit} {product.unit}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Stock Gauge & Quick Action Buttons */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-800">
                    {/* Stock Value & Progress Bar */}
                    <div className="text-right min-w-[90px]">
                      <div className="flex items-center justify-end gap-1.5">
                        <span
                          className={`font-black text-sm ${isOutOfStock
                            ? 'text-rose-500'
                            : isImmediate
                              ? 'text-rose-400'
                              : 'text-amber-400'
                            }`}
                        >
                          {product.stock}
                        </span>
                        <span className="text-stone-500 text-xs">/</span>
                        <span className="text-stone-400 text-xs font-semibold">
                          {product.minStock} {product.unit}
                        </span>
                      </div>

                      {/* Mini visual gauge */}
                      <div className="w-full bg-stone-950 rounded-full h-1.5 overflow-hidden mt-1 border border-stone-800">
                        <div
                          className={`h-full rounded-full transition-all ${isOutOfStock
                            ? 'bg-rose-600 w-0'
                            : stockPct <= 35
                              ? 'bg-rose-500'
                              : 'bg-amber-400'
                            }`}
                          style={{ width: `${Math.max(5, stockPct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      {hasLinkedRecipe && (
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => {
                            setBakingProduct(product);
                            setIsBakingOrderModalOpen(true);
                          }}
                          icon={<Flame className="w-3.5 h-3.5 text-orange-400" />}
                          title="Lancer une fournée prioritaire en fabrication"
                        >
                          <span className="hidden md:inline">Fournée</span>
                        </Button>
                      )}

                      <Button
                        variant={isImmediate ? 'danger' : 'primary'}
                        size="xs"
                        onClick={() => {
                          setSelectedRestockProduct(product);
                          setRestockAmount(Math.max(5, deficit));
                        }}
                        icon={<Plus className="w-3.5 h-3.5" />}
                        title="Réapprovisionner le stock de cet article"
                      >
                        Réappro
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {/* CARD FOOTER: RECAP & SHORTCUTS */}
      <CardFooter className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-stone-950/70">
        <div className="flex items-center gap-4 text-stone-400">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            <span>
              Déficit global :{' '}
              <strong className="text-stone-200">
                {totalUnitsDeficit} unités à fabriquer / réapprovisionner
              </strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              if (onNavigateTab) onNavigateTab('production');
              else setActiveTab('production');
            }}
            icon={<Flame className="w-3.5 h-3.5 text-orange-400" />}
          >
            Planning Fournil
          </Button>

          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              if (onNavigateTab) onNavigateTab('inventory');
              else setActiveTab('inventory');
            }}
            icon={<Package className="w-3.5 h-3.5 text-amber-400" />}
          >
            Stocks Matières
          </Button>
        </div>
      </CardFooter>

      {/* REUI MODAL: QUICK REPLENISHMENT */}
      <Modal
        isOpen={Boolean(selectedRestockProduct)}
        onClose={() => setSelectedRestockProduct(null)}
        title="Réapprovisionnement Rapide"
        description={
          selectedRestockProduct
            ? `Entrée en stock pour "${selectedRestockProduct.name}" (${selectedRestockProduct.sku})`
            : ''
        }
        size="md"
      >
        {selectedRestockProduct && (
          <form onSubmit={handleQuickRestockSubmit} className="space-y-4">
            <ModalBody className="space-y-4">
              <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-stone-400">Stock Actuel</span>
                  <p className="text-base font-black text-rose-400">
                    {selectedRestockProduct.stock} {selectedRestockProduct.unit}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-stone-400">Seuil de Sécurité (minStock)</span>
                  <p className="text-base font-black text-amber-400">
                    {selectedRestockProduct.minStock} {selectedRestockProduct.unit}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-300">
                  Quantité à Ajouter (+ unités)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={restockAmount}
                    onChange={(e) => setRestockAmount(Math.max(1, parseInt(e.target.value) || 0))}
                    className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-bold focus:outline-hidden focus:border-amber-500"
                    required
                  />
                  <div className="flex gap-1">
                    {[5, 10, 20, 50].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRestockAmount(preset)}
                        className="px-2.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs font-bold transition-colors"
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-stone-400">
                  Nouveau stock après réapprovisionnement :{' '}
                  <strong className="text-emerald-400">
                    {selectedRestockProduct.stock + restockAmount} {selectedRestockProduct.unit}
                  </strong>
                </p>
              </div>
            </ModalBody>

            <ModalFooter>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setSelectedRestockProduct(null)}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Valider l'Entrée en Stock
              </Button>
            </ModalFooter>
          </form>
        )}
      </Modal>

      {/* REUI MODAL: QUICK BAKING ORDER LAUNCH */}
      <Modal
        isOpen={isBakingOrderModalOpen && Boolean(bakingProduct)}
        onClose={() => {
          setIsBakingOrderModalOpen(false);
          setBakingProduct(null);
        }}
        title="Lancer une Fournée d'Urgence"
        description={
          bakingProduct
            ? `Planification immédiate pour réapprovisionner "${bakingProduct.name}"`
            : ''
        }
        size="md"
      >
        {bakingProduct && (
          <div className="space-y-4">
            <ModalBody className="space-y-4">
              <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-400">Produit à cuire</span>
                  <span className="text-xs font-bold text-amber-400">{bakingProduct.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-400">Stock Actuel / Seuil</span>
                  <span className="text-xs font-bold text-rose-400">
                    {bakingProduct.stock} / {bakingProduct.minStock} {bakingProduct.unit}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-300">
                  Taille du Lot (Multiplicateur de Recette)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((mult) => (
                    <button
                      key={mult}
                      type="button"
                      onClick={() => setBakingMultiplier(mult)}
                      className={`p-3 rounded-xl border text-center transition-all ${bakingMultiplier === mult
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                        }`}
                    >
                      <span className="text-sm font-black">x{mult} Lot</span>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {mult === 1 ? 'Simple' : mult === 2 ? 'Double' : 'Triple'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </ModalBody>

            <ModalFooter>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsBakingOrderModalOpen(false);
                  setBakingProduct(null);
                }}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleLaunchBakeConfirm}
                icon={<Flame className="w-4 h-4 text-orange-400" />}
              >
                Lancer la Cuisson
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </Card>
  );
};