import React, { useState, useMemo } from 'react';
import { useBakery } from '../../context/BakeryContext';
import { Product, CartItem, PaymentMethod } from '../../types/bakery';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  Percent,
  CheckCircle,
  Coins,
  CreditCard,
  Smartphone,
  RotateCcw,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { ReceiptModal } from '../receipt/ReceiptModal';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
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

export const PosView: React.FC = () => {
  const {
    products,
    customers,
    formatMoney,
    completeSale,
    lastCompletedSale,
    setLastCompletedSale,
  } = useBakery();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('especes');
  const [cashGiven, setCashGiven] = useState<number>(0);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchQuery =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery));
      return matchCat && matchQuery && p.isActive;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart totals
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return Math.round((subtotal * discountPercent) / 100);
  }, [subtotal, discountPercent]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const changeDue = useMemo(() => {
    return Math.max(0, cashGiven - total);
  }, [cashGiven, total]);

  // Cart operations
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setSelectedCustomerId('');
  };

  const openPaymentModal = () => {
    if (cart.length === 0) return;
    setCashGiven(total);
    setSelectedPaymentMethod('especes');
    setIsPaymentModalOpen(true);
  };

  const handleFinalizeSale = () => {
    if (cart.length === 0) return;
    completeSale({
      cart,
      paymentMethod: selectedPaymentMethod,
      amountPaid: selectedPaymentMethod === 'especes' ? cashGiven : total,
      customerId: selectedCustomerId || undefined,
      discountPercent,
    });
    setIsPaymentModalOpen(false);
    clearCart();
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const categories = [
    { id: 'all', label: 'Tous les rayons', icon: '🧺' },
    { id: 'pains', label: 'Pains & Baguettes', icon: '🥖' },
    { id: 'viennoiseries', label: 'Viennoiseries', icon: '🥐' },
    { id: 'patisseries', label: 'Pâtisseries & Gâteaux', icon: '🍰' },
    { id: 'snacking', label: 'Snacking & Salé', icon: '🥪' },
    { id: 'boissons', label: 'Boissons Fraîches', icon: '🥤' },
  ];

  const quickCashPresets = [500, 1000, 2000, 5000, 10000, 20000];

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-stone-950">
      {/* LEFT: PRODUCTS CATALOG & SEARCH */}
      <div className="flex-1 flex flex-col border-r border-stone-800 overflow-hidden">
        {/* Search & Categories Bar */}
        <div className="p-4 bg-stone-900/90 border-b border-stone-800 space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un produit, référence ou code-barres..."
              className="w-full bg-stone-950 border border-stone-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-200"
              >
                Effacer
              </button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                    : 'bg-stone-800 hover:bg-stone-750 text-stone-300 border border-stone-700/60'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((prod) => {
              const inCartItem = cart.find((c) => c.product.id === prod.id);
              const isOutOfStock = prod.stock <= 0;

              return (
                <button
                  key={prod.id}
                  onClick={() => !isOutOfStock && addToCart(prod)}
                  disabled={isOutOfStock}
                  className={`group relative text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                    isOutOfStock
                      ? 'bg-stone-900/40 border-stone-800 opacity-50 cursor-not-allowed'
                      : inCartItem
                      ? 'bg-amber-950/20 border-amber-500/60 shadow-lg shadow-amber-500/5'
                      : 'bg-stone-900 border-stone-800 hover:border-amber-500/40 hover:bg-stone-850'
                  }`}
                >
                  {/* Top: Icon & Stock */}
                  <div className="flex items-start justify-between w-full mb-2">
                    <span className="text-2xl select-none">{prod.imageIcon}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        prod.stock <= prod.minStock
                          ? 'bg-red-950/60 text-red-300 border-red-800/60'
                          : 'bg-stone-800 text-stone-300 border-stone-700'
                      }`}
                    >
                      Stock: {prod.stock}
                    </span>
                  </div>

                  {/* Mid: Title */}
                  <div className="mb-2">
                    <h4 className="font-bold text-sm text-stone-100 group-hover:text-amber-300 line-clamp-2 leading-snug">
                      {prod.name}
                    </h4>
                    <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-1">{prod.sku}</p>
                  </div>

                  {/* Bottom: Price & In-Cart indicator */}
                  <div className="flex items-center justify-between pt-2 border-t border-stone-800/80 w-full">
                    <span className="font-extrabold text-amber-400 text-sm">
                      {formatMoney(prod.price)}
                    </span>

                    {inCartItem ? (
                      <span className="w-6 h-6 rounded-lg bg-amber-500 text-stone-950 font-bold text-xs flex items-center justify-center">
                        {inCartItem.quantity}
                      </span>
                    ) : (
                      <span className="w-6 h-6 rounded-lg bg-stone-800 text-stone-400 group-hover:bg-amber-500 group-hover:text-stone-950 flex items-center justify-center transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-stone-500 text-sm">
              <p>Aucun produit trouvé pour cette recherche.</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: TACTILE TICKET & CART */}
      <div className="w-full lg:w-96 bg-stone-900 border-t lg:border-t-0 flex flex-col justify-between shrink-0 shadow-xl">
        {/* Ticket Header & Customer Selection */}
        <div className="p-4 border-b border-stone-800 space-y-3 bg-stone-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-stone-200">Panier en cours</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                {cart.reduce((s, i) => s + i.quantity, 0)} articles
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-stone-400 hover:text-rose-400 text-xs flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Vider</span>
              </button>
            )}
          </div>

          {/* Customer Selector */}
          <div className="flex items-center gap-2 bg-stone-950 p-2 rounded-xl border border-stone-800">
            <User className="w-4 h-4 text-amber-400 shrink-0" />
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-transparent text-xs text-stone-200 font-medium focus:outline-none"
            >
              <option value="" className="bg-stone-900">Client Comptoir (Anonyme)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id} className="bg-stone-900">
                  {c.name} {c.type.startsWith('b2b') ? '🏢 (Compte Pro)' : `⭐ (${c.loyaltyPoints} pts)`}
                </option>
              ))}
            </select>
          </div>

          {selectedCustomer?.type.startsWith('b2b') && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-950/60 border border-blue-800/60 text-[11px] text-blue-200">
              <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Encours autorisé : {formatMoney(selectedCustomer.creditLimit - selectedCustomer.creditBalance)} restant</span>
            </div>
          )}
        </div>

        {/* Cart Item List */}
        <div className="flex-1 p-3 overflow-y-auto space-y-2">
          {cart.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-stone-500 text-xs text-center p-4">
              <span className="text-3xl mb-2">🥖</span>
              <p className="font-semibold text-stone-400">La caisse est prête</p>
              <p className="text-[11px] mt-1">Touchez les produits à gauche pour composer la commande.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="bg-stone-950 p-2.5 rounded-xl border border-stone-800/80 flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <h5 className="font-bold text-xs text-stone-200 truncate">{item.product.name}</h5>
                  <p className="text-[11px] text-amber-400 font-semibold">
                    {formatMoney(item.product.price)}
                  </p>
                </div>

                {/* Stepper buttons */}
                <div className="flex items-center gap-1.5 bg-stone-900 rounded-lg p-1 border border-stone-800">
                  <button
                    onClick={() => updateQuantity(item.product.id, -1)}
                    className="w-6 h-6 rounded flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-800"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-extrabold text-xs text-stone-100 px-1.5 min-w-[1.2rem] text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.product.id, 1)}
                    className="w-6 h-6 rounded flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-800"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-right min-w-[4rem]">
                  <span className="font-black text-xs text-stone-100">
                    {formatMoney(item.product.price * item.quantity)}
                  </span>
                </div>

                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-stone-500 hover:text-rose-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Bottom Totals & Pay Button */}
        <div className="p-4 bg-stone-950 border-t border-stone-800 space-y-3">
          {/* Quick Discount Pill Buttons */}
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span className="flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Remise :</span>
            </span>
            <div className="flex gap-1">
              {[0, 5, 10, 15].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setDiscountPercent(pct)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    discountPercent === pct
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 text-xs text-stone-400">
            <div className="flex justify-between">
              <span>Sous-total HT :</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-rose-400 font-semibold">
                <span>Remise ({discountPercent}%) :</span>
                <span>-{formatMoney(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-stone-800 text-stone-100">
              <span className="font-extrabold text-sm uppercase">Total TTC :</span>
              <span className="font-black text-xl text-amber-400">{formatMoney(total)}</span>
            </div>
          </div>

          {/* Large Checkout Button */}
          <button
            onClick={openPaymentModal}
            disabled={cart.length === 0}
            className={`w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
              cart.length === 0
                ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 active:scale-[0.98] shadow-amber-500/25'
            }`}
          >
            <Coins className="w-5 h-5" />
            <span>Encaisser {formatMoney(total)}</span>
          </button>
        </div>
      </div>

      {/* REUI PAYMENT MODAL (Tactile Cash & Mobile Money) */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Règlement Caisse Tactile"
        description="Sélectionnez le mode de paiement et encaissez"
        maxWidth="lg"
      >
        <ModalContent className="space-y-4">
          <div className="flex justify-between items-center bg-stone-950 p-3.5 rounded-2xl border border-stone-800">
            <div>
              <span className="text-[11px] text-stone-400 uppercase font-bold tracking-wider">Montant Net à Payer</span>
              <p className="text-2xl font-black text-amber-400">{formatMoney(total)}</p>
            </div>
            {discountAmount > 0 && (
              <Badge variant="rose">Remise -{formatMoney(discountAmount)}</Badge>
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              onClick={() => setSelectedPaymentMethod('especes')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                selectedPaymentMethod === 'especes'
                  ? 'bg-amber-500 text-stone-950 border-amber-400 font-bold'
                  : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-750'
              }`}
            >
              <Coins className="w-5 h-5" />
              <span className="text-xs">Espèces</span>
            </button>

            <button
              onClick={() => setSelectedPaymentMethod('wave')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                selectedPaymentMethod === 'wave'
                  ? 'bg-sky-500 text-stone-950 border-sky-400 font-bold'
                  : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-750'
              }`}
            >
              <Smartphone className="w-5 h-5" />
              <span className="text-xs">WAVE Money</span>
            </button>

            <button
              onClick={() => setSelectedPaymentMethod('orange_money')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                selectedPaymentMethod === 'orange_money'
                  ? 'bg-orange-500 text-stone-950 border-orange-400 font-bold'
                  : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-750'
              }`}
            >
              <Smartphone className="w-5 h-5" />
              <span className="text-xs">Orange Money</span>
            </button>

            <button
              onClick={() => setSelectedPaymentMethod('mtn_money')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                selectedPaymentMethod === 'mtn_money'
                  ? 'bg-yellow-400 text-stone-950 border-yellow-300 font-bold'
                  : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-750'
              }`}
            >
              <Smartphone className="w-5 h-5" />
              <span className="text-xs">MTN Money</span>
            </button>

            <button
              onClick={() => setSelectedPaymentMethod('carte')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                selectedPaymentMethod === 'carte'
                  ? 'bg-emerald-500 text-stone-950 border-emerald-400 font-bold'
                  : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-750'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-xs">Carte CB / TPE</span>
            </button>

            <button
              onClick={() => setSelectedPaymentMethod('credit_b2b')}
              disabled={!selectedCustomer?.type.startsWith('b2b')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                selectedPaymentMethod === 'credit_b2b'
                  ? 'bg-blue-500 text-stone-950 border-blue-400 font-bold'
                  : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-750 disabled:opacity-30 disabled:cursor-not-allowed'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="text-xs">Crédit B2B</span>
            </button>
          </div>

          {/* CASH SPECIFIC: CALCULATOR & QUICK BILLS */}
          {selectedPaymentMethod === 'especes' && (
            <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-300">Espèces reçues :</label>
                <input
                  type="number"
                  value={cashGiven || ''}
                  onChange={(e) => setCashGiven(Number(e.target.value))}
                  className="bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-right font-black text-amber-400 w-36 focus:outline-none focus:border-amber-500 text-base"
                />
              </div>

              {/* Quick Bills Buttons */}
              <div className="flex flex-wrap gap-2">
                {quickCashPresets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setCashGiven(preset)}
                    className="px-2.5 py-1 rounded-lg bg-stone-850 hover:bg-stone-800 border border-stone-700 text-xs font-bold text-stone-200"
                  >
                    {preset} F
                  </button>
                ))}
                <button
                  onClick={() => setCashGiven(total)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-bold text-amber-300"
                >
                  Montant exact
                </button>
              </div>

              {/* Change returned calculation */}
              <div className="pt-2 border-t border-stone-800 flex justify-between items-center">
                <span className="text-xs font-semibold text-stone-400">Monnaie à rendre :</span>
                <span
                  className={`text-lg font-black ${
                    changeDue >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {changeDue >= 0 ? formatMoney(changeDue) : `Manque ${formatMoney(Math.abs(changeDue))}`}
                </span>
              </div>
            </div>
          )}

          {/* MOBILE MONEY INFO */}
          {['wave', 'orange_money', 'mtn_money'].includes(selectedPaymentMethod) && (
            <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 text-xs text-stone-300 space-y-1.5">
              <p className="font-bold text-amber-400">QR Code / Paiement Marchand actif</p>
              <p>Numéro Marchand : <strong className="text-stone-100">+225 07 00 22 11 00</strong></p>
              <p className="text-[11px] text-stone-400">Demandez au client de valider sur son application mobile et vérifiez le SMS de confirmation.</p>
            </div>
          )}
        </ModalContent>

        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setIsPaymentModalOpen(false)}
          >
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleFinalizeSale}
            disabled={selectedPaymentMethod === 'especes' && cashGiven < total}
            icon={<CheckCircle className="w-4 h-4" />}
          >
            Valider & Imprimer Ticket
          </Button>
        </ModalFooter>
      </Modal>

      {/* TICKET RECEIPT MODAL */}
      {lastCompletedSale && (
        <ReceiptModal
          sale={lastCompletedSale}
          onClose={() => setLastCompletedSale(null)}
        />
      )}
    </div>
  );
};
