import React, { useState } from 'react';
import { useBakery } from '../../context/BakeryContext';
import { Product, ProductCategory } from '../../types/bakery';
import {
  Package,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  CheckCircle,
  AlertTriangle,
  Layers,
  X,
  MoreVertical,
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
  Badge,
  Button,
} from '../ui';

export const ProductsView: React.FC = () => {
  const { products, recipes, formatMoney, addProduct, updateProduct, deleteProduct } = useBakery();

  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [name, setName] = useState<string>('');
  const [sku, setSku] = useState<string>('');
  const [category, setCategory] = useState<ProductCategory>('pains');
  const [price, setPrice] = useState<number>(300);
  const [costPrice, setCostPrice] = useState<number>(150);
  const [stock, setStock] = useState<number>(50);
  const [minStock, setMinStock] = useState<number>(15);
  const [unit, setUnit] = useState<string>('pièce');
  const [imageIcon, setImageIcon] = useState<string>('🥖');
  const [description, setDescription] = useState<string>('');
  const [recipeId, setRecipeId] = useState<string>('');

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setSku(`PROD-${Date.now().toString().slice(-4)}`);
    setCategory('pains');
    setPrice(300);
    setCostPrice(150);
    setStock(50);
    setMinStock(15);
    setUnit('pièce');
    setImageIcon('🥖');
    setDescription('');
    setRecipeId('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setSku(p.sku);
    setCategory(p.category);
    setPrice(p.price);
    setCostPrice(p.costPrice);
    setStock(p.stock);
    setMinStock(p.minStock);
    setUnit(p.unit);
    setImageIcon(p.imageIcon);
    setDescription(p.description);
    setRecipeId(p.recipeId || '');
    setIsAddModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || price <= 0) return;

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        name,
        sku,
        category,
        price,
        costPrice,
        stock,
        minStock,
        unit,
        imageIcon,
        description,
        recipeId: recipeId || undefined,
      });
    } else {
      addProduct({
        name,
        sku,
        category,
        price,
        costPrice,
        vatRate: category === 'patisseries' || category === 'boissons' ? 18 : 0,
        stock,
        minStock,
        unit,
        imageIcon,
        description,
        recipeId: recipeId || undefined,
        storeId: 'store-1',
        isActive: true,
      });
    }
    setIsAddModalOpen(false);
  };

  const emojiIcons = ['🥖', '🍞', '🥐', '🍫', '🥯', '🍰', '🍮', '🍋', '🥪', '🥧', '🍍', '🥤', '🎂', '🍪', '🥨', '☕'];

  // Catalog metrics
  const totalStockValue = products.reduce((sum, p) => sum + p.stock * p.price, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const avgMarginPct = products.length > 0
    ? Math.round(
        products.reduce((sum, p) => sum + (p.price > 0 ? ((p.price - p.costPrice) / p.price) * 100 : 0), 0) /
          products.length
      )
    : 0;

  return (
    <div className="flex-1 p-5 md:p-8 space-y-6 overflow-y-auto bg-stone-950 text-stone-100">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-6 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-stone-100">Catalogue des Produits Finis</h1>
            <p className="text-xs text-stone-400">Gestion des prix de vente, coûts de revient et marges</p>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenAdd}
          icon={<Plus className="w-4 h-4" />}
        >
          Nouveau Produit
        </Button>
      </div>

      {/* Catalog StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Références au Catalogue"
          value={`${products.length} articles`}
          subtitle="Pains, viennoiseries, snacks"
          color="sky"
          icon={<Package className="w-4 h-4" />}
        />
        <StatCard
          title="Valeur Stock Rayon"
          value={formatMoney(totalStockValue)}
          subtitle="Valorisation prix de vente"
          color="amber"
          icon={<Layers className="w-4 h-4" />}
        />
        <StatCard
          title="Alertes Rupture Rayon"
          value={lowStockCount}
          subtitle="Stock inférieur au seuil min"
          color="rose"
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <StatCard
          title="Taux de Marge Moyen"
          value={`${avgMarginPct}%`}
          subtitle="Marge brute globale catalogue"
          color="emerald"
          icon={<CheckCircle className="w-4 h-4" />}
          trend={{ value: '+4.2%', isPositive: true }}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou référence SKU..."
            className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-stone-900 border border-stone-800 text-xs font-semibold rounded-xl px-3 py-2 text-stone-200 focus:outline-none focus:border-amber-500"
        >
          <option value="all">Toutes les catégories</option>
          <option value="pains">Pains & Baguettes</option>
          <option value="viennoiseries">Viennoiseries</option>
          <option value="patisseries">Pâtisseries & Tartes</option>
          <option value="snacking">Snacking & Traiteur</option>
          <option value="boissons">Boissons</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-950/80 text-stone-400 uppercase text-[10px] border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">Produit</th>
                <th className="py-3 px-4">Catégorie</th>
                <th className="py-3 px-4">Prix de Vente</th>
                <th className="py-3 px-4">Coût de Revient</th>
                <th className="py-3 px-4">Marge Brute</th>
                <th className="py-3 px-4">Stock Rayon</th>
                <th className="py-3 px-4">Fiche Recette</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {filteredProducts.map((p) => {
                const margin = p.price - p.costPrice;
                const marginPct = p.price > 0 ? Math.round((margin / p.price) * 100) : 0;
                const isLow = p.stock <= p.minStock;

                return (
                  <tr key={p.id} className="hover:bg-stone-850/50 transition-colors">
                    {/* Name & Icon */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl select-none">{p.imageIcon}</span>
                        <div>
                          <p className="font-bold text-stone-100">{p.name}</p>
                          <span className="text-[10px] text-stone-500 font-mono">{p.sku}</span>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700 capitalize">
                        {p.category}
                      </span>
                    </td>

                    {/* Retail Price */}
                    <td className="py-3.5 px-4 font-black text-amber-400 text-sm">
                      {formatMoney(p.price)}
                    </td>

                    {/* Cost */}
                    <td className="py-3.5 px-4 text-stone-400 font-medium">
                      {formatMoney(p.costPrice)}
                    </td>

                    {/* Margin */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-emerald-400">{formatMoney(margin)}</span>
                        <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                          {marginPct}%
                        </span>
                      </div>
                    </td>

                    {/* Stock */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full text-[11px] border ${
                          isLow
                            ? 'bg-red-950/60 text-red-300 border-red-800/60'
                            : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                        }`}
                      >
                        {p.stock} {p.unit}s
                      </span>
                    </td>

                    {/* Linked Recipe */}
                    <td className="py-3.5 px-4">
                      {p.recipeId ? (
                        <span className="text-[11px] font-semibold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                          Recette liée ✓
                        </span>
                      ) : (
                        <span className="text-[10px] text-stone-500">Achat direct / Snacking</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteProduct(p.id)}
                          className="p-1.5 rounded-lg bg-stone-800 hover:bg-rose-950 text-stone-400 hover:text-rose-400 transition-colors"
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

      {/* REUI ADD / EDIT PRODUCT MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={editingProduct ? 'Modifier le Produit' : 'Nouveau Produit Boulangerie'}
        description="Configurez le prix de vente, la recette associée et les seuils de stock"
        maxWidth="lg"
      >
        <form onSubmit={handleSave}>
          <ModalContent className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="text-xs font-semibold text-stone-300">Icône visuelle</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {emojiIcons.map((ico) => (
                  <button
                    key={ico}
                    type="button"
                    onClick={() => setImageIcon(ico)}
                    className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all ${
                      imageIcon === ico
                        ? 'bg-amber-500/20 border-amber-500 scale-105'
                        : 'bg-stone-950 border-stone-800 hover:bg-stone-850'
                    }`}
                  >
                    {ico}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-300">Nom du Produit *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Croissant Pur Beurre"
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300">Référence / SKU</label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-300">Catégorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ProductCategory)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
                >
                  <option value="pains">Pains</option>
                  <option value="viennoiseries">Viennoiseries</option>
                  <option value="patisseries">Pâtisseries</option>
                  <option value="snacking">Snacking & Traiteur</option>
                  <option value="boissons">Boissons</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300">Fiche Recette liée</label>
                <select
                  value={recipeId}
                  onChange={(e) => setRecipeId(e.target.value)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
                >
                  <option value="">Aucune (Achat/Direct)</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-300">Prix de Vente (TTC) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300">Coût de Revient Estimé</label>
                <input
                  type="number"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(Number(e.target.value))}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-300">Stock initial en rayon</label>
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(Number(e.target.value))}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300">Seuil alerte stock bas</label>
                <input
                  type="number"
                  min="0"
                  value={minStock}
                  onChange={(e) => setMinStock(Number(e.target.value))}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300">Description commerciale</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ex: Farine T65 Tradition, fermentation lente au levain..."
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
            >
              {editingProduct ? 'Enregistrer les Modifications' : 'Créer le Produit'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
};
