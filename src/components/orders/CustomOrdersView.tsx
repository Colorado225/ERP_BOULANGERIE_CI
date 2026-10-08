import React, { useState } from 'react';
import { useBakery } from '../../context/BakeryContext';
import { CustomOrder } from '../../types/bakery';
import {
  Cake,
  Plus,
  Calendar,
  Clock,
  Sparkles,
  Phone,
  CheckCircle,
  AlertCircle,
  X,
  CreditCard,
} from 'lucide-react';

export const CustomOrdersView: React.FC = () => {
  const { customOrders, formatMoney, addCustomOrder, updateCustomOrderStatus, writeStoreId } = useBakery();

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // New Custom Cake form
  const [clientName, setClientName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [cakeType, setCakeType] = useState<string>('Number Cake Personnalisé');
  const [servingCount, setServingCount] = useState<number>(20);
  const [flavor, setFlavor] = useState<string>('Vanille Bourbon & Framboises fraîches');
  const [customInscription, setCustomInscription] = useState<string>('Joyeux Anniversaire ✨');
  const [themeColor, setThemeColor] = useState<string>('Doré & Blanc Nacré');
  const [pickupDate, setPickupDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [pickupTime, setPickupTime] = useState<string>('16:00');
  const [totalPrice, setTotalPrice] = useState<number>(35000);
  const [depositPaid, setDepositPaid] = useState<number>(20000);
  const [notes, setNotes] = useState<string>('');

  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !phone) return;

    addCustomOrder({
      clientName,
      phone,
      cakeType,
      servingCount,
      flavor,
      customInscription,
      themeColor,
      pickupDate,
      pickupTime,
      totalPrice,
      depositPaid,
      storeId: writeStoreId,
      notes,
    });

    setIsAddModalOpen(false);
    setClientName('');
    setPhone('');
  };

  const getStatusBadge = (status: CustomOrder['status']) => {
    switch (status) {
      case 'commande':
        return { label: 'Commande Reçue', color: 'bg-stone-800 text-stone-300 border-stone-700' };
      case 'en_preparation':
        return { label: 'En Préparation / Déco 👩‍🍳', color: 'bg-purple-950/60 text-purple-300 border-purple-800 animate-pulse' };
      case 'pret':
        return { label: 'Prêt en Chambre Froide ❄️', color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800' };
      case 'livre':
        return { label: 'Retiré / Livré ✓', color: 'bg-blue-950/60 text-blue-300 border-blue-800' };
    }
  };

  return (
    <div className="flex-1 p-5 md:p-8 space-y-6 overflow-y-auto bg-stone-950 text-stone-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-6 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
            <Cake className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-stone-100">Gâteaux Sur-Mesure & Commandes Spéciales</h1>
            <p className="text-xs text-stone-400">Anniversaires, mariages, pièces montées et gestion des acomptes</p>
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-pink-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Commande Gâteau</span>
        </button>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customOrders.map((ord) => {
          const badge = getStatusBadge(ord.status);
          const remainingDue = ord.totalPrice - ord.depositPaid;

          return (
            <div
              key={ord.id}
              className="bg-stone-900 border border-stone-800 p-5 rounded-2xl space-y-4 hover:border-stone-700 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-pink-400">{ord.orderNumber}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>

                {/* Cake details */}
                <div className="mt-2">
                  <h3 className="font-black text-base text-stone-100">{ord.cakeType}</h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Client : <strong className="text-stone-200">{ord.clientName}</strong> • {ord.phone}
                  </p>
                </div>

                {/* Inscription & Theme */}
                <div className="p-3 bg-stone-950 rounded-xl border border-stone-850 mt-3 text-xs space-y-1">
                  <p className="text-pink-300 font-bold italic">
                    "{ord.customInscription}"
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Parfum : <strong>{ord.flavor}</strong>
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Format : <strong>{ord.servingCount} parts</strong> • Thème : {ord.themeColor}
                  </p>
                </div>

                {/* Pickup details */}
                <div className="mt-3 flex items-center justify-between text-xs text-stone-400">
                  <span className="flex items-center gap-1 text-amber-300">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{ord.pickupDate}</span>
                  </span>
                  <span className="flex items-center gap-1 text-stone-300">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{ord.pickupTime}</span>
                  </span>
                </div>

                {/* Price & Deposit */}
                <div className="mt-3 pt-3 border-t border-stone-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase">Prix Total</span>
                    <p className="font-black text-sm text-stone-100">{formatMoney(ord.totalPrice)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 uppercase">Solde restant dû</span>
                    <p className={`font-black text-sm ${remainingDue > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {remainingDue > 0 ? formatMoney(remainingDue) : 'Payé en totalité ✓'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status progression button */}
              <div className="pt-2">
                {ord.status === 'commande' && (
                  <button
                    onClick={() => updateCustomOrderStatus(ord.id, 'en_preparation')}
                    className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-stone-950 font-bold text-xs"
                  >
                    Passer en préparation
                  </button>
                )}

                {ord.status === 'en_preparation' && (
                  <button
                    onClick={() => updateCustomOrderStatus(ord.id, 'pret')}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs"
                  >
                    Gâteau prêt en chambre froide
                  </button>
                )}

                {ord.status === 'pret' && (
                  <button
                    onClick={() => updateCustomOrderStatus(ord.id, 'livre')}
                    className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-stone-950 font-bold text-xs"
                  >
                    Valider le retrait client
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: NEW CUSTOM ORDER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-stone-800 pb-3">
              <h3 className="font-black text-lg text-stone-100">Nouvelle Commande de Gâteau</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-400 hover:text-stone-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-300">Nom du client *</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-300">Téléphone *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-300">Type de gâteau :</label>
                  <input
                    type="text"
                    value={cakeType}
                    onChange={(e) => setCakeType(e.target.value)}
                    className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-300">Nombre de parts :</label>
                  <input
                    type="number"
                    min="4"
                    value={servingCount}
                    onChange={(e) => setServingCount(Number(e.target.value))}
                    className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-300">Parfums & Garnitures :</label>
                <input
                  type="text"
                  value={flavor}
                  onChange={(e) => setFlavor(e.target.value)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-300">Texte / Inscription personnalisée :</label>
                <input
                  type="text"
                  value={customInscription}
                  onChange={(e) => setCustomInscription(e.target.value)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-300">Date de retrait :</label>
                  <input
                    type="date"
                    required
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-300">Heure de retrait :</label>
                  <input
                    type="time"
                    required
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-300">Prix Total (TTC) :</label>
                  <input
                    type="number"
                    required
                    value={totalPrice}
                    onChange={(e) => setTotalPrice(Number(e.target.value))}
                    className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-amber-400 font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-300">Acompte versé à la commande :</label>
                  <input
                    type="number"
                    value={depositPaid}
                    onChange={(e) => setDepositPaid(Number(e.target.value))}
                    className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-emerald-400 font-bold"
                  />
                </div>
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
                  className="px-5 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-stone-950 font-black uppercase"
                >
                  Valider Commande Gâteau
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
