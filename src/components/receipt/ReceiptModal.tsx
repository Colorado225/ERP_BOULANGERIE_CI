import React from 'react';
import { Sale } from '../../types/bakery';
import { useBakery } from '../../context/BakeryContext';
import { Printer, X, Check, Share2, Wheat } from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose }) => {
  const { formatMoney, stores } = useBakery();
  const currentStore = stores.find((s) => s.id === sale.storeId) || stores[0];

  const handlePrint = () => {
    window.print();
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'wave':
        return 'WAVE Mobile';
      case 'orange_money':
        return 'Orange Money';
      case 'mtn_money':
        return 'MTN Mobile Money';
      case 'carte':
        return 'Carte Bancaire';
      case 'credit_b2b':
        return 'Compte Client B2B (Différé)';
      default:
        return 'Espèces';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 bg-stone-800/80 border-b border-stone-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-stone-100">Ticket de Caisse</h3>
              <p className="text-[11px] text-stone-400">{sale.receiptNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-200 p-1 rounded-lg hover:bg-stone-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thermal Receipt Paper Container */}
        <div className="p-6 overflow-y-auto bg-stone-950 flex justify-center">
          <div
            id="printable-receipt"
            className="w-full max-w-[320px] bg-stone-50 text-stone-900 p-5 rounded-md shadow font-mono text-xs leading-relaxed border-t-4 border-amber-600"
          >
            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-stone-300">
              <div className="flex justify-center items-center gap-1.5 font-sans font-black text-base text-stone-900 mb-0.5">
                <Wheat className="w-4 h-4 text-amber-700" />
                <span>BOULANGERIE PRO</span>
              </div>
              <p className="text-[11px] font-bold text-stone-700 uppercase">{currentStore.name}</p>
              <p className="text-[10px] text-stone-600">{currentStore.location}</p>
              <p className="text-[10px] text-stone-600">Tél : {currentStore.phone}</p>
              <p className="text-[9px] text-stone-500 mt-1">RC : CI-ABJ-2024-B-14529 • CC : 2419082</p>
            </div>

            {/* Ticket Info */}
            <div className="py-2.5 border-b border-dashed border-stone-300 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-stone-600">Ticket :</span>
                <span className="font-bold">{sale.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Date :</span>
                <span>{new Date(sale.date).toLocaleString('fr-FR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Caissier :</span>
                <span>{sale.cashierName}</span>
              </div>
              {sale.customerName && (
                <div className="flex justify-between text-amber-900 font-semibold">
                  <span>Client :</span>
                  <span>{sale.customerName}</span>
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="py-3 border-b border-dashed border-stone-300 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-stone-600 uppercase pb-1 border-b border-stone-200">
                <span>Article</span>
                <span className="text-right">Qté x P.U = Total</span>
              </div>
              {sale.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-[11px]">
                  <div className="pr-2 font-medium max-w-[170px] truncate">
                    {item.name}
                  </div>
                  <div className="text-right whitespace-nowrap font-bold">
                    {item.quantity} x {item.unitPrice} = {item.total}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Calculation */}
            <div className="py-3 border-b border-dashed border-stone-300 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-600">Sous-total :</span>
                <span>{sale.subtotal} FCFA</span>
              </div>
              {sale.discountAmount > 0 && (
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span>Remise accordée :</span>
                  <span>-{sale.discountAmount} FCFA</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm font-black pt-1 border-t border-stone-300 text-stone-900">
                <span>TOTAL À PAYER :</span>
                <span className="text-base text-amber-800">{formatMoney(sale.total)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="py-2.5 border-b border-dashed border-stone-300 text-[11px] space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Mode de règlement :</span>
                <span className="uppercase text-stone-900">{getPaymentLabel(sale.paymentMethod)}</span>
              </div>
              {sale.paymentMethod === 'especes' && (
                <>
                  <div className="flex justify-between text-stone-600">
                    <span>Espèces reçues :</span>
                    <span>{sale.amountPaid} FCFA</span>
                  </div>
                  <div className="flex justify-between font-bold text-stone-900">
                    <span>Monnaie rendue :</span>
                    <span>{sale.changeReturned} FCFA</span>
                  </div>
                </>
              )}
            </div>

            {/* Footer barcode & thanks */}
            <div className="text-center pt-3 text-[10px] text-stone-500 space-y-1">
              <p className="font-semibold text-stone-700">🥖 Pains au levain & Pâtisseries pures 🥐</p>
              <p>Merci pour votre confiance et bonne dégustation !</p>
              <div className="pt-2 flex justify-center">
                <div className="h-8 w-44 bg-stone-300/60 rounded flex items-center justify-center font-mono text-[9px] tracking-widest text-stone-700 border border-stone-400">
                  ||||| | |||| ||| ||||| |||||
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-stone-900 border-t border-stone-800 flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer Ticket (80mm)</span>
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs border border-stone-700 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
