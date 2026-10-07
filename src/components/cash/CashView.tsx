import React, { useState } from 'react';
import { useBakery } from '../../context/BakeryContext';
import { CashTransaction } from '../../types/bakery';
import {
  Wallet,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  Calculator,
  Lock,
  Receipt,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

export const CashView: React.FC = () => {
  const { cashTransactions, formatMoney, addCashTransaction, sales } = useBakery();

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [isZModalOpen, setIsZModalOpen] = useState<boolean>(false);

  // Expense form
  const [expenseAmount, setExpenseAmount] = useState<number>(3000);
  const [expenseDescription, setExpenseDescription] = useState<string>('');
  const [expenseUser, setExpenseUser] = useState<string>('Aïcha Diallo');

  // Z Closing form
  const [countedCash, setCountedCash] = useState<number>(0);
  const [zNotes, setZNotes] = useState<string>('');

  // Cash Calculations
  const totalIn = cashTransactions
    .filter((t) => t.type === 'fond_ouverture' || t.type === 'encaissement_vente')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalOut = cashTransactions
    .filter((t) => t.type === 'depense_imprevue' || t.type === 'retrait_banque')
    .reduce((sum, t) => sum + t.amount, 0);

  const theoreticalDrawerCash = Math.max(0, totalIn - totalOut);
  const cashDiscrepancy = countedCash - theoreticalDrawerCash;

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0 || !expenseDescription) return;

    addCashTransaction({
      type: 'depense_imprevue',
      amount: expenseAmount,
      description: expenseDescription,
      recordedBy: expenseUser,
      storeId: 'store-1',
    });

    setIsExpenseModalOpen(false);
    setExpenseAmount(3000);
    setExpenseDescription('');
  };

  const handleSaveZClosing = (e: React.FormEvent) => {
    e.preventDefault();
    addCashTransaction({
      type: 'cloture_z',
      amount: countedCash,
      description: `Clôture Z journalière - Espèces comptées : ${countedCash} FCFA (Écart : ${cashDiscrepancy >= 0 ? '+' : ''}${cashDiscrepancy} FCFA) - ${zNotes}`,
      recordedBy: 'Responsable Caisse',
      storeId: 'store-1',
    });
    setIsZModalOpen(false);
  };

  return (
    <div className="flex-1 p-5 md:p-8 space-y-6 overflow-y-auto bg-stone-950 text-stone-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-6 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-stone-100">Caisse & Trésorerie Journalière</h1>
            <p className="text-xs text-stone-400">Fond de caisse, dépenses imprévues et Clôture Z du soir</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 font-bold text-xs transition-colors"
          >
            <ArrowDownCircle className="w-4 h-4 text-rose-400" />
            <span>Sortie d'Espèces (Dépense)</span>
          </button>

          <button
            onClick={() => {
              setCountedCash(theoreticalDrawerCash);
              setIsZModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Lock className="w-4 h-4" />
            <span>Clôture Z Journalière</span>
          </button>
        </div>
      </div>

      {/* Cash Box Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-stone-900 border border-stone-800 rounded-2xl space-y-2">
          <span className="text-xs font-semibold uppercase text-stone-400">Total Espèces Théorique en Caisse</span>
          <p className="text-2xl font-black text-emerald-400">{formatMoney(theoreticalDrawerCash)}</p>
          <p className="text-[11px] text-stone-500">Calculé en temps réel selon les tickets</p>
        </div>

        <div className="p-5 bg-stone-900 border border-stone-800 rounded-2xl space-y-2">
          <span className="text-xs font-semibold uppercase text-stone-400">Total Encaissements Espèces</span>
          <p className="text-2xl font-black text-stone-100">{formatMoney(totalIn)}</p>
          <p className="text-[11px] text-stone-500">Fond initial + Ventes comptant</p>
        </div>

        <div className="p-5 bg-stone-900 border border-stone-800 rounded-2xl space-y-2">
          <span className="text-xs font-semibold uppercase text-stone-400">Dépenses & Décaissements</span>
          <p className="text-2xl font-black text-rose-400">{formatMoney(totalOut)}</p>
          <p className="text-[11px] text-stone-500">Achats urgents et retraits</p>
        </div>
      </div>

      {/* Cash Transactions Journal */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-xl space-y-4 p-5">
        <h3 className="font-extrabold text-stone-100 text-sm">Journal des Mouvements de Caisse</h3>
        <div className="divide-y divide-stone-800/60">
          {cashTransactions.map((tx) => {
            const isCredit = tx.type === 'fond_ouverture' || tx.type === 'encaissement_vente';

            return (
              <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isCredit
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {isCredit ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-bold text-stone-200">{tx.description}</p>
                    <p className="text-[10px] text-stone-500">
                      {new Date(tx.date).toLocaleTimeString('fr-FR')} • Opérateur : {tx.recordedBy}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p
                    className={`font-black text-sm ${
                      isCredit ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isCredit ? '+' : '-'} {formatMoney(tx.amount)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: ADD EXPENSE */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
            <h3 className="font-black text-base text-stone-100">Sortie d'Espèces de la Caisse</h3>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-300">Montant décaissé :</label>
                <input
                  type="number"
                  min="100"
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(Number(e.target.value))}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-rose-400 font-black text-base"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-300">Motif de la dépense :</label>
                <input
                  type="text"
                  required
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder="ex: Achat glaçons marché ou transport dépannage"
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-300">Responsable du retrait :</label>
                <input
                  type="text"
                  value={expenseUser}
                  onChange={(e) => setExpenseUser(e.target.value)}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-stone-800 text-stone-300 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-stone-100 font-black"
                >
                  Enregistrer Sortie
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Z CLOSING */}
      {isZModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
            <h3 className="font-black text-base text-stone-100">Clôture Journalière de Caisse (Rapport Z)</h3>

            <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 space-y-1 text-xs">
              <div className="flex justify-between text-stone-400">
                <span>Espèces Théoriques :</span>
                <strong className="text-stone-200">{formatMoney(theoreticalDrawerCash)}</strong>
              </div>
            </div>

            <form onSubmit={handleSaveZClosing} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-300">Comptage physique des espèces :</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={countedCash}
                  onChange={(e) => setCountedCash(Number(e.target.value))}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-amber-400 font-black text-base"
                />
              </div>

              <div className="pt-2 border-t border-stone-800 flex justify-between items-center">
                <span className="font-semibold text-stone-400">Écart de caisse :</span>
                <span
                  className={`font-black text-sm ${
                    cashDiscrepancy === 0
                      ? 'text-emerald-400'
                      : cashDiscrepancy > 0
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {cashDiscrepancy === 0
                    ? '0 FCFA (Caisse parfaite ✓)'
                    : `${cashDiscrepancy > 0 ? '+' : ''}${formatMoney(cashDiscrepancy)}`}
                </span>
              </div>

              <div>
                <label className="font-semibold text-stone-300">Commentaire de clôture :</label>
                <input
                  type="text"
                  value={zNotes}
                  onChange={(e) => setZNotes(e.target.value)}
                  placeholder="ex: RAS, remise en coffre effectuée"
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsZModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-stone-800 text-stone-300 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black"
                >
                  Clôturer la Caisse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
