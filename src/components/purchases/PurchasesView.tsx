import React, { useState } from 'react';
import { useBakery } from '../../context/BakeryContext';
import { Supplier, PurchaseOrder } from '../../types/bakery';
import {
  Truck,
  Plus,
  CheckCircle,
  FileText,
  Building,
  Phone,
  Mail,
  DollarSign,
  X,
  PackageCheck,
  CreditCard,
} from 'lucide-react';

export const PurchasesView: React.FC = () => {
  const {
    purchases,
    suppliers,
    materials,
    formatMoney,
    createPurchaseOrder,
    receivePurchaseOrder,
    paySupplier,
    addSupplier,
  } = useBakery();

  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('orders');
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState<boolean>(false);
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState<boolean>(false);
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(50000);

  // New PO states
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [orderItems, setOrderItems] = useState<{
    materialId: string;
    materialName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }[]>([]);
  const [notes, setNotes] = useState<string>('');

  // Item selector in PO modal
  const [tempMatId, setTempMatId] = useState<string>(materials[0]?.id || '');
  const [tempQty, setTempQty] = useState<number>(50);

  // New Supplier form
  const [supName, setSupName] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [paymentTerms, setPaymentTerms] = useState<string>('30 jours fin de mois');

  const handleAddItemToOrder = () => {
    const mat = materials.find((m) => m.id === tempMatId);
    if (!mat || tempQty <= 0) return;

    const total = Math.round(mat.unitCost * tempQty);
    setOrderItems((prev) => [
      ...prev,
      {
        materialId: mat.id,
        materialName: mat.name,
        quantity: tempQty,
        unit: mat.unit,
        unitPrice: mat.unitCost,
        total,
      },
    ]);
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) return;

    const sup = suppliers.find((s) => s.id === selectedSupplierId);
    const totalAmount = orderItems.reduce((sum, item) => sum + item.total, 0);

    createPurchaseOrder({
      supplierId: selectedSupplierId,
      supplierName: sup?.name || 'Fournisseur',
      items: orderItems,
      totalAmount,
      notes,
    });

    setIsNewOrderModalOpen(false);
    setOrderItems([]);
    setNotes('');
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName) return;

    addSupplier({
      name: supName,
      contactName,
      phone,
      email,
      address,
      suppliedMaterials: ['Farine', 'Levure', 'Ingrédients'],
      paymentTerms,
    });

    setIsNewSupplierModalOpen(false);
    setSupName('');
  };

  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier || paymentAmount <= 0) return;
    paySupplier(payingSupplier.id, paymentAmount);
    setPayingSupplier(null);
  };

  const totalOutstandingSupplierDebts = suppliers.reduce((sum, s) => sum + s.pendingBalance, 0);

  return (
    <div className="flex-1 p-5 md:p-8 space-y-6 overflow-y-auto bg-stone-950 text-stone-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-6 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-stone-100">Achats & Fournisseurs</h1>
            <p className="text-xs text-stone-400">Bons de commande, réceptions d'ingrédients et suivi des dettes</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-stone-400 uppercase font-semibold">Dettes Fournisseurs en cours</span>
            <p className="text-base font-black text-rose-400">{formatMoney(totalOutstandingSupplierDebts)}</p>
          </div>

          <button
            onClick={() => setIsNewOrderModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Bon de Commande</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-stone-800 pb-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'orders'
              ? 'bg-amber-500 text-stone-950'
              : 'bg-stone-900 text-stone-400 hover:text-stone-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Bons de Commande & Réceptions ({purchases.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'suppliers'
              ? 'bg-amber-500 text-stone-950'
              : 'bg-stone-900 text-stone-400 hover:text-stone-200'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Répertoire Fournisseurs ({suppliers.length})</span>
        </button>
      </div>

      {/* VIEW 1: PURCHASE ORDERS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {purchases.map((po) => {
              const isReceived = po.status === 'recu';

              return (
                <div
                  key={po.id}
                  className="bg-stone-900 border border-stone-800 p-5 rounded-2xl space-y-4 hover:border-stone-700 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-black text-amber-400">{po.orderNumber}</span>
                      <h4 className="font-extrabold text-sm text-stone-100 mt-0.5">{po.supplierName}</h4>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isReceived
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                          : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                      }`}
                    >
                      {isReceived ? 'Stock Réceptionné ✓' : 'En transit / Commandé'}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-stone-800/80 text-xs">
                    {po.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-stone-300">
                        <span>
                          {it.materialName} ({it.quantity} {it.unit})
                        </span>
                        <span className="font-bold">{formatMoney(it.total)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-stone-800">
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase">Montant Total Facturé</span>
                      <p className="text-base font-black text-stone-100">{formatMoney(po.totalAmount)}</p>
                    </div>

                    {!isReceived ? (
                      <button
                        onClick={() => receivePurchaseOrder(po.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs uppercase shadow-md transition-all active:scale-95"
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>Valider Réception (+Stock)</span>
                      </button>
                    ) : (
                      <span className="text-xs text-stone-500 font-medium">Reçu le {po.date}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: SUPPLIERS LIST */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsNewSupplierModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-stone-850 hover:bg-stone-800 border border-stone-700 text-xs font-bold text-stone-200 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Ajouter un Fournisseur</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((sup) => (
              <div
                key={sup.id}
                className="bg-stone-900 border border-stone-800 p-5 rounded-2xl space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-stone-100 text-sm">{sup.name}</h4>
                    <span className="text-[10px] text-stone-400 bg-stone-800 px-2 py-0.5 rounded">
                      {sup.paymentTerms}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-1">Contact : <strong>{sup.contactName}</strong></p>

                  <div className="space-y-1 text-xs text-stone-300 mt-3 pt-3 border-t border-stone-800">
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-stone-400" />
                      <span>{sup.phone}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-stone-400" />
                      <span>{sup.email}</span>
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase">Encours dû</span>
                    <p
                      className={`text-sm font-black ${
                        sup.pendingBalance > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {formatMoney(sup.pendingBalance)}
                    </p>
                  </div>

                  {sup.pendingBalance > 0 && (
                    <button
                      onClick={() => {
                        setPayingSupplier(sup);
                        setPaymentAmount(sup.pendingBalance);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs border border-stone-700"
                    >
                      Régler
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: NEW PURCHASE ORDER */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-stone-800 pb-3">
              <h3 className="font-black text-lg text-stone-100">Nouveau Bon de Commande Matières</h3>
              <button
                onClick={() => setIsNewOrderModalOpen(false)}
                className="text-stone-400 hover:text-stone-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-stone-300">Fournisseur :</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.paymentTerms})
                    </option>
                  ))}
                </select>
              </div>

              {/* Add item box */}
              <div className="p-3 bg-stone-950 rounded-2xl border border-stone-800 space-y-2">
                <label className="font-bold text-amber-400 uppercase">Ajouter un ingrédient au bon :</label>
                <div className="flex gap-2">
                  <select
                    value={tempMatId}
                    onChange={(e) => setTempMatId(e.target.value)}
                    className="flex-1 bg-stone-900 border border-stone-700 rounded-xl px-2 py-1.5 text-stone-100"
                  >
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.currentStock} {m.unit} en stock)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={tempQty}
                    onChange={(e) => setTempQty(Number(e.target.value))}
                    className="w-20 bg-stone-900 border border-stone-700 rounded-xl px-2 py-1.5 text-stone-100 text-center font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleAddItemToOrder}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold"
                  >
                    + Ajouter
                  </button>
                </div>

                {orderItems.length > 0 && (
                  <div className="divide-y divide-stone-850 pt-2">
                    {orderItems.map((item, idx) => (
                      <div key={idx} className="py-1 flex justify-between text-stone-300">
                        <span>{item.materialName} ({item.quantity} {item.unit})</span>
                        <strong className="text-amber-400">{formatMoney(item.total)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold text-stone-300">Instructions de livraison :</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ex: Livraison à l'aube par camion réfrigéré"
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsNewOrderModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={orderItems.length === 0}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black uppercase disabled:opacity-50"
                >
                  Générer le Bon de Commande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PAY SUPPLIER */}
      {payingSupplier && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4">
            <h3 className="font-black text-base text-stone-100">Règlement Fournisseur</h3>
            <p className="text-xs text-stone-400">
              Fournisseur : <strong className="text-stone-200">{payingSupplier.name}</strong>
              <br />
              Dette actuelle : <strong className="text-rose-400">{formatMoney(payingSupplier.pendingBalance)}</strong>
            </p>

            <form onSubmit={handleExecutePayment} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-300">Montant à régler :</label>
                <input
                  type="number"
                  min="1"
                  max={payingSupplier.pendingBalance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-amber-400 font-black text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingSupplier(null)}
                  className="px-3 py-2 rounded-xl bg-stone-800 text-stone-300 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black"
                >
                  Enregistrer Paiement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
