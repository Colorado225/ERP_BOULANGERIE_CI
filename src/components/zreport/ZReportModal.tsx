import React, { useState } from 'react';
import { useBakery } from '../../context/BakeryContext';
import { Printer, X, Check, Bluetooth } from 'lucide-react';
import { generateZReport, printToBluetoothPrinter } from '../../services/escposPrinter';
import { Sale } from '../../types/bakery';

interface ZReportModalProps {
    onClose: () => void;
}

// Calculer les statistiques quotidiennes pour la clôture Z
const computeDailyStats = (sales: Sale[], currentStoreId: string) => {
    // Filtrer les ventes d'aujourd'hui pour le magasin courant
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysSales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= today && sale.storeId === currentStoreId;
    });

    let totalSales = 0;
    let cashTotal = 0;
    let waveTotal = 0;
    let orangeMoneyTotal = 0;
    let totalVat = 0;

    todaysSales.forEach(sale => {
        totalSales += sale.total;
        totalVat += sale.vatAmount || 0;

        switch (sale.paymentMethod) {
            case 'especes':
                cashTotal += sale.total;
                break;
            case 'wave':
                waveTotal += sale.total;
                break;
            case 'orange_money':
                orangeMoneyTotal += sale.total;
                break;
        }
    });

    return {
        salesCount: todaysSales.length,
        totalSales,
        cashTotal,
        waveTotal,
        orangeMoneyTotal,
        totalVat,
    };
};

export const ZReportModal: React.FC<ZReportModalProps> = ({ onClose }) => {
    const { formatMoney, stores, company, sales } = useBakery();
    const [isPrinting, setIsPrinting] = useState<boolean>(false);
    const currentStore = stores[0]; // On prend le premier magasin par défaut

    const reportData = computeDailyStats(sales, currentStore.id);
    const today = new Date();

    const handleBrowserPrint = () => {
        window.print();
    };

    const handleThermalPrint = async () => {
        setIsPrinting(true);

        const reportBuffer = generateZReport({
            store: {
                name: currentStore.name,
                location: currentStore.location,
                phone: currentStore.phone || '',
                rccm: company.rccm,
                taxpayerAccount: company.taxpayerAccount,
            },
            date: today,
            totalSales: reportData.totalSales,
            cashSales: reportData.cashTotal,
            mobileMoneySales: reportData.orangeMoneyTotal,
            cardSales: reportData.waveTotal,
            transactionCount: reportData.salesCount,
            cashierName: 'Aïcha Diallo',
            tvaCollected: reportData.totalVat,
        });

        await printToBluetoothPrinter(reportBuffer);
        setIsPrinting(false);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-stone-900 border border-stone-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Modal Top Bar */}
                <div className="px-5 py-3.5 bg-stone-800/80 border-b border-stone-700/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-stone-100">Clôture Z - Journal Quotidien</h3>
                            <p className="text-[11px] text-stone-400">{today.toLocaleDateString('fr-FR')}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-stone-400 hover:text-stone-200 p-1 rounded-lg hover:bg-stone-700/50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Z Report Content */}
                <div className="p-6 overflow-y-auto bg-stone-950 flex justify-center">
                    <div
                        id="printable-zreport"
                        className="w-full max-w-[320px] bg-stone-50 text-stone-900 p-5 rounded-md shadow font-mono text-xs leading-relaxed border-t-4 border-blue-600"
                    >
                        {/* Header */}
                        <div className="text-center pb-3 border-b border-dashed border-stone-300">
                            <h1 className="font-black text-base text-stone-900 mb-1">CLÔTURE Z</h1>
                            <p className="text-[11px] font-bold text-stone-700 uppercase">{currentStore.name}</p>
                            <p className="text-[10px] text-stone-600">{today.toLocaleDateString('fr-FR')}</p>
                            <p className="text-[9px] text-stone-500 mt-1">RC : {company.rccm} • CC : {company.taxpayerAccount}</p>
                        </div>

                        {/* Stats Section */}
                        <div className="py-3 border-b border-dashed border-stone-300 space-y-1.5">
                            <h2 className="font-bold text-stone-700 uppercase text-xs pb-1 border-b border-stone-200">
                                STATISTIQUES DU JOUR
                            </h2>
                            <div className="flex justify-between">
                                <span className="text-stone-600">Nombre de ventes :</span>
                                <span className="font-bold">{reportData.salesCount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-600">Chiffre d'affaires :</span>
                                <span className="font-bold">{formatMoney(reportData.totalSales)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-600">TVA collectée :</span>
                                <span className="font-bold">{formatMoney(reportData.totalVat)}</span>
                            </div>
                        </div>

                        {/* Payment Breakdown */}
                        <div className="py-3 border-b border-dashed border-stone-300 space-y-1.5">
                            <h2 className="font-bold text-stone-700 uppercase text-xs pb-1 border-b border-stone-200">
                                RÉPARTITION PAIEMENTS
                            </h2>
                            <div className="flex justify-between">
                                <span className="text-stone-600">Espèces :</span>
                                <span>{formatMoney(reportData.cashTotal)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-600">Wave Money :</span>
                                <span>{formatMoney(reportData.waveTotal)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-600">Orange Money :</span>
                                <span>{formatMoney(reportData.orangeMoneyTotal)}</span>
                            </div>
                        </div>

                        {/* Reconciliation Check */}
                        <div className="py-3 text-center">
                            {Math.abs((reportData.cashTotal + reportData.waveTotal + reportData.orangeMoneyTotal) - reportData.totalSales) < 1 ? (
                                <p className="text-emerald-600 font-bold text-sm">✓ COMPTABILITÉ OK - Écart nul</p>
                            ) : (
                                <p className="text-rose-600 font-bold text-sm">⚠ ÉCART DÉTECTÉ - Vérifier les encaissements</p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="text-center pt-3 text-[10px] text-stone-500">
                            <p>Rapport édité le {today.toLocaleString('fr-FR')}</p>
                            <p className="mt-1">BOULANGERIE PRO - Système de gestion</p>
                        </div>
                    </div>
                </div>

                {/* Modal Actions */}
                <div className="p-4 bg-stone-900 border-t border-stone-800 flex gap-3">
                    <button
                        onClick={handleBrowserPrint}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 font-bold text-xs shadow-md transition-colors"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Navigateur</span>
                    </button>
                    <button
                        onClick={handleThermalPrint}
                        disabled={isPrinting}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/50 text-white font-bold text-xs shadow-md transition-colors"
                    >
                        <Bluetooth className={`w-4 h-4 ${isPrinting ? 'animate-pulse' : ''}`} />
                        <span>{isPrinting ? 'Impression...' : 'Thermal BT'}</span>
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