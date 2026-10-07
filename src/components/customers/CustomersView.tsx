import React, { useState } from 'react';
import { useBakery } from '../../context/BakeryContext';
import { Customer } from '../../types/bakery';
import {
  Users,
  Plus,
  Star,
  Building,
  Phone,
  Mail,
  CreditCard,
  DollarSign,
  Search,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const { customers, formatMoney, addCustomer, updateCustomer, payCustomerCredit } = useBakery();

  const [search, setSearch] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState<number>(10000);

  // New Customer form
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [type, setType] = useState<Customer['type']>('particulier');
  const [address, setAddress] = useState<string>('');
  const [creditLimit, setCreditLimit] = useState<number>(50000);
  const [notes, setNotes] = useState<string>('');

  const filteredCustomers = customers.filter((c) => {
    const matchType = filterType === 'all' || c.type === filterType;
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()));
    return matchType && matchSearch;
  });

  const totalOutstandingCredit = customers.reduce((sum, c) => sum + c.creditBalance, 0);

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    addCustomer({
      name,
      phone,
      email: email || undefined,
      type,
      address: address || undefined,
      creditLimit,
      notes: notes || undefined,
    });

    setIsAddModalOpen(false);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
  };

  const handleExecuteCreditPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCustomer || payAmount <= 0) return;
    payCustomerCredit(payingCustomer.id, payAmount);
    setPayingCustomer(null);
  };

  return (
    <div className="flex-1 p-5 md:p-8 space-y-6 overflow-y-auto bg-stone-950 text-stone-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-6 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-stone-100">Clients, Fidélité & Comptes B2B</h1>
            <p className="text-xs text-stone-400">Programme de points, encours clients pro (Hôtels, Restaurants)</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-stone-400 uppercase font-semibold">Créances Clients Totales</span>
            <p className="text-base font-black text-blue-400">{formatMoney(totalOutstandingCredit)}</p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Client</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone ou email..."
            className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-stone-900 border border-stone-800 text-xs font-semibold rounded-xl px-3 py-2 text-stone-200 focus:outline-none"
        >
          <option value="all">Tous les profils</option>
          <option value="particulier">Particuliers</option>
          <option value="b2b_hotel">B2B - Hôtels</option>
          <option value="b2b_restaurant">B2B - Restaurants</option>
          <option value="b2b_revendeur">B2B - Dépôts & Revendeurs</option>
        </select>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((cust) => {
          const isB2B = cust.type.startsWith('b2b');

          return (
            <div
              key={cust.id}
              className="bg-stone-900 border border-stone-800 p-5 rounded-2xl space-y-4 hover:border-stone-700 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-stone-100 text-sm line-clamp-1">{cust.name}</h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isB2B
                        ? 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                        : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                    }`}
                  >
                    {isB2B ? '🏢 B2B' : '⭐ Particulier'}
                  </span>
                </div>

                {/* Contact */}
                <div className="mt-2 space-y-1 text-xs text-stone-400">
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-stone-500" />
                    <span>{cust.phone}</span>
                  </p>
                  {cust.email && (
                    <p className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-stone-500" />
                      <span className="truncate">{cust.email}</span>
                    </p>
                  )}
                  {cust.address && (
                    <p className="text-[11px] text-stone-500 truncate mt-1">📍 {cust.address}</p>
                  )}
                </div>

                {/* Loyalty or Credit stats */}
                <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase">Fidélité</span>
                    <p className="font-bold text-amber-400 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{cust.loyaltyPoints} points</span>
                    </p>
                  </div>

                  {isB2B && (
                    <div className="text-right">
                      <span className="text-[10px] text-stone-400 uppercase">Encours Dû</span>
                      <p
                        className={`font-black text-sm ${
                          cust.creditBalance > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {formatMoney(cust.creditBalance)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              {isB2B && cust.creditBalance > 0 && (
                <button
                  onClick={() => {
                    setPayingCustomer(cust);
                    setPayAmount(cust.creditBalance);
                  }}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-stone-950 font-bold text-xs uppercase flex items-center justify-center gap-1.5 shadow-md transition-colors"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Encaisser Règlement ({formatMoney(cust.creditBalance)})</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL: ADD CUSTOMER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-stone-800 pb-3">
              <h3 className="font-black text-lg text-stone-100">Nouveau Client / Compte Pro</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-400 hover:text-stone-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-300">Nom complet ou Établissement *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Hôtel Ivoire ou Mme Kouassi"
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-300">Téléphone *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+225 07..."
                    className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-300">Type de Compte</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                  >
                    <option value="particulier">Particulier</option>
                    <option value="b2b_hotel">B2B - Hôtel</option>
                    <option value="b2b_restaurant">B2B - Restaurant</option>
                    <option value="b2b_revendeur">B2B - Dépôt de pain</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-300">Email (facultatif)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="direction@hotel.ci"
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-300">Adresse / Quartier de livraison</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Cocody, Plateau, Zone 4..."
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>

              {type.startsWith('b2b') && (
                <div>
                  <label className="font-semibold text-stone-300">Plafond de Crédit Autorisé</label>
                  <input
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(Number(e.target.value))}
                    className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 font-bold"
                  />
                </div>
              )}

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
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black uppercase"
                >
                  Enregistrer Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PAY CREDIT */}
      {payingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4">
            <h3 className="font-black text-base text-stone-100">Encaisser Règlement Client</h3>
            <p className="text-xs text-stone-400">
              Client : <strong className="text-stone-200">{payingCustomer.name}</strong>
              <br />
              Créance actuelle : <strong className="text-rose-400">{formatMoney(payingCustomer.creditBalance)}</strong>
            </p>

            <form onSubmit={handleExecuteCreditPayment} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-300">Montant reçu :</label>
                <input
                  type="number"
                  min="1"
                  max={payingCustomer.creditBalance}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-emerald-400 font-black text-base"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingCustomer(null)}
                  className="px-3 py-2 rounded-xl bg-stone-800 text-stone-300 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black"
                >
                  Valider Encaissement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
