import React, { useState, useRef } from 'react';
import { useBakery } from '../../context/BakeryContext';
import {
  Settings,
  Store,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  Building,
  CheckCircle,
  Wheat,
  Coins,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    stores,
    currentStoreId,
    setCurrentStoreId,
    currency,
    setCurrency,
    resetToDemoData,
    exportBackupJson,
    importBackupJson,
  } = useBakery();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [establishmentName, setEstablishmentName] = useState<string>('Maison du Pain & Pâtisserie d’Ivoire');
  const [legalId, setLegalId] = useState<string>('CI-ABJ-2024-B-14529');
  const [defaultVatRate, setDefaultVatRate] = useState<number>(0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        importBackupJson(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 p-5 md:p-8 space-y-6 overflow-y-auto bg-stone-950 text-stone-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-6 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-stone-800 text-stone-300 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-stone-100">Paramètres Généraux & Multi-Boutiques</h1>
            <p className="text-xs text-stone-400">Identité de l'entreprise, devises, points de vente et sauvegardes</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Establishment Profile */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-800 pb-3">
            <Wheat className="w-5 h-5 text-amber-400" />
            <h3 className="font-extrabold text-sm text-stone-100">Identité & Coordonnées Légales</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-stone-300">Enseigne Commerciale :</label>
              <input
                type="text"
                value={establishmentName}
                onChange={(e) => setEstablishmentName(e.target.value)}
                className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-stone-300">Registre du Commerce (RCCM / N° Contribuable) :</label>
              <input
                type="text"
                value={legalId}
                onChange={(e) => setLegalId(e.target.value)}
                className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-stone-300">Devise Principale :</label>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setCurrency('XOF')}
                    className={`flex-1 py-2 rounded-xl font-bold border transition-all ${
                      currency === 'XOF'
                        ? 'bg-amber-500 text-stone-950 border-amber-400'
                        : 'bg-stone-950 text-stone-300 border-stone-800'
                    }`}
                  >
                    FCFA (XOF)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('EUR')}
                    className={`flex-1 py-2 rounded-xl font-bold border transition-all ${
                      currency === 'EUR'
                        ? 'bg-amber-500 text-stone-950 border-amber-400'
                        : 'bg-stone-950 text-stone-300 border-stone-800'
                    }`}
                  >
                    EUR (€)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-300">Taux TVA Pains/Farines :</label>
                <input
                  type="number"
                  value={defaultVatRate}
                  onChange={(e) => setDefaultVatRate(Number(e.target.value))}
                  className="w-full mt-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 font-bold"
                />
                <span className="text-[10px] text-stone-500">Exonération habituelle sur pain brut</span>
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Store Points de Vente */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-sm text-stone-100">Réseau Multi-Boutiques</h3>
            </div>
            <span className="text-xs text-stone-400 font-bold">{stores.length} points de vente</span>
          </div>

          <div className="space-y-2.5">
            {stores.map((st) => {
              const isSelected = currentStoreId === st.id;

              return (
                <div
                  key={st.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-amber-950/20 border-amber-500/50 shadow-md'
                      : 'bg-stone-950 border-stone-850'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-xs text-stone-100">{st.name}</h4>
                      {st.isMain && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Fournil Principal
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-400 mt-0.5">{st.location}</p>
                    <p className="text-[10px] text-stone-500">Gérant : {st.managerName} • {st.phone}</p>
                  </div>

                  <button
                    onClick={() => setCurrentStoreId(st.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950 border-amber-400'
                        : 'bg-stone-800 hover:bg-stone-750 text-stone-300 border-stone-700'
                    }`}
                  >
                    {isSelected ? 'Actif ✓' : 'Sélectionner'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Roles & Permissions Reference */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-800 pb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-extrabold text-sm text-stone-100">Rôles & Permissions de l'Atelier</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-950 text-stone-400 uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3">Fonction</th>
                  <th className="py-2 px-2 text-center">Gérant</th>
                  <th className="py-2 px-2 text-center">Caissier</th>
                  <th className="py-2 px-2 text-center">Boulanger</th>
                  <th className="py-2 px-2 text-center">Magasinier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60">
                <tr>
                  <td className="py-2 px-3 font-semibold text-stone-300">Vente / Caisse POS</td>
                  <td className="text-center text-emerald-400">✅</td>
                  <td className="text-center text-emerald-400">✅</td>
                  <td className="text-center text-stone-600">❌</td>
                  <td className="text-center text-stone-600">❌</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold text-stone-300">Modifier Prix / Catalogue</td>
                  <td className="text-center text-emerald-400">✅</td>
                  <td className="text-center text-stone-600">❌</td>
                  <td className="text-center text-stone-600">❌</td>
                  <td className="text-center text-stone-600">❌</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold text-stone-300">Lancer Fournées / Production</td>
                  <td className="text-center text-emerald-400">✅</td>
                  <td className="text-center text-stone-600">❌</td>
                  <td className="text-center text-emerald-400">✅</td>
                  <td className="text-center text-stone-600">❌</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold text-stone-300">Réception Matières Premières</td>
                  <td className="text-center text-emerald-400">✅</td>
                  <td className="text-center text-stone-600">❌</td>
                  <td className="text-center text-stone-600">❌</td>
                  <td className="text-center text-emerald-400">✅</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold text-stone-300">Voir Bénéfices & Marges</td>
                  <td className="text-center text-emerald-400">✅</td>
                  <td className="text-center text-stone-600">❌</td>
                  <td className="text-center text-stone-600">❌</td>
                  <td className="text-center text-stone-600">❌</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Backup & System Operations */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-stone-800 pb-3">
              <Download className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-sm text-stone-100">Sauvegarde & Restauration des Données</h3>
            </div>

            <p className="text-xs text-stone-400 mt-3 leading-relaxed">
              Exportez à tout moment l'ensemble des données de votre boulangerie (produits, fiches recettes, stocks, ventes, créances clients et ordres de fabrication) dans un fichier JSON sécurisé.
            </p>
          </div>

          <div className="space-y-2.5 pt-4">
            <button
              onClick={exportBackupJson}
              className="w-full py-2.5 rounded-xl bg-stone-850 hover:bg-stone-800 border border-stone-700 text-stone-200 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Télécharger Sauvegarde JSON (.json)</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 rounded-xl bg-stone-850 hover:bg-stone-800 border border-stone-700 text-stone-200 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Upload className="w-4 h-4 text-sky-400" />
              <span>Importer / Restaurer depuis Fichier</span>
            </button>

            <button
              onClick={() => {
                if (confirm('Voulez-vous vraiment réinitialiser toutes les données de démonstration ?')) {
                  resetToDemoData();
                }
              }}
              className="w-full py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/60 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Réinitialiser Données Démo Complètes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
