import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Camera,
  X,
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
import type { Result } from '@zxing/library';
// Import du service d'impression ESC/POS
import { generateReceipt, printToBluetoothPrinter, PaperWidth, SaleItem, StoreInfo, ReceiptData } from '../../services/escposPrinter';
import { MobileMoneyManager, MobileMoneyOperator, MobileMoneyTransactionStatus } from '../../services/mobileMoney';
// Import du service singleton de scan de codes-barres
import { barcodeScanner } from '../../services/barcodeScanner';

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
  // États pour le scan de codes-barres
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // États pour Mobile Money
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [mobileMoneyError, setMobileMoneyError] = useState<string | null>(null);

  // Nettoyer le scanner quand le composant se démonte
  useEffect(() => {
    return () => {
      if (isScanning) {
        barcodeScanner.destroy();
      }
    };
  }, [isScanning]);

  // Handler de scan réussi - recherche le produit par barcode/SKU
  const handleScanSuccess = (result: Result) => {
    const scannedCode = result.getText();
    console.log(`Code-barres scanné : ${scannedCode}`);

    // Rechercher le produit correspondant au code scanné
    const product = products.find(p =>
      p.barcode === scannedCode || p.sku === scannedCode
    );

    if (product) {
      addToCart(product);
      setIsScanning(false);
      setSearchQuery('');
    } else {
      console.warn(`Aucun produit trouvé pour le code : ${scannedCode}`);
      setSearchQuery(scannedCode); // Afficher le code dans la recherche si pas trouvé
    }
  };

  // Démarrer le scan
  const startBarcodeScan = async () => {
    if (!videoRef.current) return;

    setIsScanning(true);
    const success = await barcodeScanner.startScanning(videoRef.current, handleScanSuccess);

    if (!success) {
      const state = barcodeScanner.getState();
      console.error('Échec scan :', state.lastError);
      setIsScanning(false);
    }
  };

  // Arrêter le scan
  const stopBarcodeScan = () => {
    barcodeScanner.stopScanning();
    setIsScanning(false);
  };

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

  // Mapper les PaymentMethod internes vers les opérateurs MobileMoneyOperator
  const getMobileMoneyOperator = (paymentMethod: PaymentMethod): MobileMoneyOperator | null => {
    switch (paymentMethod) {
      case 'wave': return MobileMoneyOperator.WAVE;
      case 'orange_money': return MobileMoneyOperator.ORANGE_MONEY;
      case 'mtn_money': return MobileMoneyOperator.MTN_MOMO;
      default: return null;
    }
  };

  const handleFinalizeSale = async () => {
    if (cart.length === 0) return;

    // 1. Récupérer l'instance du gestionnaire Mobile Money
    const mobileMoneyManager = MobileMoneyManager.getInstance();
    const mobileOperator = getMobileMoneyOperator(selectedPaymentMethod);

    // 2. Si c'est un paiement Mobile Money, lancer d'abord le paiement
    if (mobileOperator) {
      setIsProcessingPayment(true);
      setMobileMoneyError(null);
    }

    // 3. Valider la vente dans le contexte
    const completedSale = completeSale({
      cart,
      paymentMethod: selectedPaymentMethod,
      amountPaid: selectedPaymentMethod === 'especes' ? cashGiven : total,
      customerId: selectedCustomerId || undefined,
      discountPercent,
    });

    // 4. Traitement du paiement Mobile Money si nécessaire
    if (mobileOperator) {
      try {
        // Valider et normaliser le numéro de téléphone avant envoi à l'API
        let normalizedPhone: string;
        try {
          normalizedPhone = mobileMoneyManager.normalizePhoneNumber(customerPhone);
        } catch (phoneError) {
          setIsProcessingPayment(false);
          setMobileMoneyError("Numéro de téléphone invalide (format ivoirien requis : 0708091011)");
          return;
        }

        const transaction = await mobileMoneyManager.initiatePayment(
          completedSale,
          mobileOperator,
          normalizedPhone
        );
        console.log('Paiement Mobile Money initié, en attente de confirmation webhook:', transaction);

        // Observer les changements de statut de la transaction (mis à jour en temps réel via SSE/webhooks)
        const statusChecker = setInterval(() => {
          const updatedTx = mobileMoneyManager.getTransaction(transaction.id);
          if (updatedTx) {
            console.log('Statut transaction:', updatedTx.status);

            if (updatedTx.status === MobileMoneyTransactionStatus.SUCCESS) {
              clearInterval(statusChecker);
              setIsProcessingPayment(false);
              // Réinitialiser le numéro de téléphone pour la prochaine vente
              setCustomerPhone('');
              setIsPaymentModalOpen(false);
              clearCart();
            } else if (updatedTx.status === MobileMoneyTransactionStatus.FAILED) {
              clearInterval(statusChecker);
              setIsProcessingPayment(false);
              setMobileMoneyError(updatedTx.failureReason || 'Paiement échoué : veuillez réessayer');
            }
          }
        }, 1000); // Vérification locale légère (1s) uniquement pour l'UI, pas de polling API

      } catch (error) {
        setIsProcessingPayment(false);
        setMobileMoneyError(error instanceof Error ? error.message : "Erreur lors du paiement");
        return;
      }
    }

    // 2. Préparer les données pour le ticket ESC/POS
    const storeInfo: StoreInfo = {
      name: "Boulangerie Artisanale",
      location: "Abidjan, Côte d'Ivoire",
      phone: "+225 01 23 45 67 89",
      rccm: "CI-ABJ-2024-123456",
      taxpayerAccount: "CI123456789",
    };

    const saleItems: SaleItem[] = cart.map(item => ({
      name: item.product.name,
      quantity: item.quantity,
      price: item.product.price,
    }));

    const receiptData: ReceiptData = {
      store: storeInfo,
      saleId: completedSale.id,
      date: new Date(),
      items: saleItems,
      subtotal,
      discountAmount,
      total,
      paymentMethod: selectedPaymentMethod,
      amountPaid: selectedPaymentMethod === 'especes' ? cashGiven : total,
      change: changeDue,
      cashierName: "Caissier",
      tvaRate: 0
    };

    // 3. Générer et imprimer le ticket (58mm par défaut, standard pour les petites caisses)
    // Imprimer le ticket seulement pour les paiements en espèces (les Mobile Money sont gérés dans le polling)
    if (selectedPaymentMethod === 'especes') {
      try {
        const buffer = generateReceipt(receiptData, "WIDTH_58");
        await printToBluetoothPrinter(buffer);
      } catch (printError) {
        console.error("Erreur lors de l'impression:", printError);
        // L'erreur est déjà gérée dans printToBluetoothPrinter avec un alert
      }

      setIsPaymentModalOpen(false);
      clearCart();
    }
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
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-stone-950 w-full">
      {/* Cart Panel - Fixed on top for mobile, right for desktop */}
      <div className="order-first lg:order-last w-full lg:w-96 bg-stone-900 border-b lg:border-b-0 lg:border-l border-stone-800 flex flex-col shrink-0 max-h-[40vh] lg:max-h-none overflow-hidden">
        <div className="p-4 border-b border-stone-800">
          <h2 className="text-lg font-bold text-stone-100">Panier ({cart.reduce((sum, item) => sum + item.quantity, 0)})</h2>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-500">
              <Coins className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">Panier vide</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="bg-stone-800/50 rounded-xl p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-100 truncate">{item.product.name}</p>
                      <p className="text-xs text-stone-400">{formatMoney(item.product.price)}</p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-stone-900 rounded-lg p-1">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="p-1 rounded-md text-stone-400 hover:text-stone-100 hover:bg-stone-800"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-medium text-stone-100">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="p-1 rounded-md text-stone-400 hover:text-stone-100 hover:bg-stone-800"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="font-bold text-amber-400">{formatMoney(item.product.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {cart.length > 0 && (
          <div className="p-4 border-t border-stone-800 space-y-3 bg-stone-900/95">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-400">Sous-total</span>
                <span className="text-stone-300">{formatMoney(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-400">Remise {discountPercent}%</span>
                  <span className="text-emerald-400">-{formatMoney(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-stone-800">
                <span className="text-base font-bold text-stone-100">Total</span>
                <span className="text-xl font-extrabold text-amber-400">{formatMoney(total)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearCart}
                className="flex-1 py-2.5 px-4 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Vider</span>
              </button>
              <button
                onClick={openPaymentModal}
                className="flex-[2] py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
              >
                <Coins className="w-4 h-4" />
                Payer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE PAIEMENT */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Valider la vente"
        description="Sélectionnez le mode de paiement et finalisez la transaction"
        maxWidth="md"
      >
        <ModalContent className="space-y-5">
          {/* Total de la vente */}
          <div className="bg-stone-900 rounded-xl p-4 text-center">
            <p className="text-sm text-stone-400 mb-1">Total à encaisser</p>
            <p className="text-3xl font-extrabold text-amber-400">{formatMoney(total)}</p>
          </div>

          {/* Sélection du mode de paiement */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-stone-200">Mode de paiement</h3>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setSelectedPaymentMethod('especes')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${selectedPaymentMethod === 'especes'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-stone-700 bg-stone-900 hover:border-stone-600'
                  }`}
              >
                <span className="text-xl">💵</span>
                <span className="text-xs font-medium text-stone-300">Espèces</span>
              </button>
              <button
                onClick={() => setSelectedPaymentMethod('wave')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${selectedPaymentMethod === 'wave'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-stone-700 bg-stone-900 hover:border-stone-600'
                  }`}
              >
                <span className="text-xl">🌊</span>
                <span className="text-xs font-medium text-stone-300">Wave</span>
              </button>
              <button
                onClick={() => setSelectedPaymentMethod('orange_money')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${selectedPaymentMethod === 'orange_money'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-stone-700 bg-stone-900 hover:border-stone-600'
                  }`}
              >
                <span className="text-xl">🍊</span>
                <span className="text-xs font-medium text-stone-300">Orange Money</span>
              </button>
              <button
                onClick={() => setSelectedPaymentMethod('mtn_money')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${selectedPaymentMethod === 'mtn_money'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-stone-700 bg-stone-900 hover:border-stone-600'
                  }`}
              >
                <span className="text-xl">🟡</span>
                <span className="text-xs font-medium text-stone-300">MTN MoMo</span>
              </button>
            </div>
          </div>

          {/* Si espèces : champ montant donné */}
          {selectedPaymentMethod === 'especes' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-200">Montant reçu</h3>
              <input
                type="number"
                value={cashGiven || ''}
                onChange={(e) => setCashGiven(Number(e.target.value))}
                placeholder="Entrez le montant donné par le client"
                className="w-full px-4 py-3 bg-stone-900 border border-stone-700 rounded-xl text-stone-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-lg"
                min={total}
              />
              {changeDue > 0 && (
                <div className="bg-emerald-950/50 border border-emerald-800/60 rounded-xl p-4 text-center">
                  <p className="text-xs text-emerald-400 mb-1">Monnaie à rendre</p>
                  <p className="text-2xl font-bold text-emerald-400">{formatMoney(changeDue)}</p>
                </div>
              )}
            </div>
          )}

          {(selectedPaymentMethod === 'wave' || selectedPaymentMethod === 'orange_money' || selectedPaymentMethod === 'mtn_money') && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-200">Numéro du client</h3>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => {
                  setCustomerPhone(e.target.value);
                  setMobileMoneyError(null);
                }}
                placeholder="0708091011"
                className="w-full px-4 py-3 bg-stone-900 border border-stone-700 rounded-xl text-stone-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-lg"
              />
              {mobileMoneyError && (
                <div className="bg-rose-950/50 border border-rose-800/60 rounded-xl p-4 text-center">
                  <p className="text-sm text-rose-400">{mobileMoneyError}</p>
                </div>
              )}
              <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-4">
                <p className="text-sm text-blue-300 text-center">
                  Le client recevra une demande de paiement sur son application Mobile Money.
                </p>
              </div>
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
            disabled={
              isProcessingPayment ||
              (selectedPaymentMethod === 'especes' && cashGiven < total) ||
              ((selectedPaymentMethod === 'wave' || selectedPaymentMethod === 'orange_money' || selectedPaymentMethod === 'mtn_money') && !customerPhone)
            }
            icon={isProcessingPayment ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : <CheckCircle className="w-4 h-4" />}
          >
            {isProcessingPayment ? 'Traitement en cours...' : 'Valider & Imprimer Ticket'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Main Products Grid */}
      <div className="flex-1 p-3 sm:p-4 overflow-auto">
        {/* Search Bar */}
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-12 py-3 bg-stone-900 border border-stone-800 rounded-xl text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all text-base"
            />
            {/* Bouton de scan */}
            <button
              onClick={isScanning ? stopBarcodeScan : startBarcodeScan}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${isScanning
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-amber-400'
                }`}
              aria-label={isScanning ? "Arrêter le scan" : "Scanner un code-barres"}
            >
              {isScanning ? <X className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Vidéo pour le scan de code-barres (affichée seulement pendant le scan) */}
        {isScanning && (
          <div className="mb-4 relative overflow-hidden rounded-xl border-2 border-amber-500 bg-black">
            <video
              ref={videoRef}
              className="w-full h-64 object-cover"
              autoPlay
              playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-32 border-2 border-amber-400 rounded-lg opacity-80" />
            </div>
            <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded">
              Placez le code-barres dans le cadre
            </p>
          </div>
        )}


        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${selectedCategory === cat.id
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
                className={`group relative text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${isOutOfStock
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
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${prod.stock <= prod.minStock
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