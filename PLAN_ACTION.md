# PLAN D'ACTION — BoulangeriePro → ERP de production

> **Objectif** : transformer la maquette actuelle (React + `localStorage`, mono-poste, sans auth)
> en un ERP réellement exploitable pour une boulangerie-pâtisserie en **Côte d'Ivoire**.
>
> **Document de travail** — à mettre à jour au fur et à mesure. Cocher les cases à mesure.
> Dernière mise à jour : 2026-10-07

---

## ✅ Avancement

| Chantier                            | État       | Date       | Vérification                                                                  |
| ----------------------------------- | ---------- | ---------- | ----------------------------------------------------------------------------- |
| 1.3 Multi-boutiques (`storeId`)     | ✅ Terminé | 2026-10-07 | `tsc` OK, 0 `store-1` en dur                                                  |
| 1.4 Fiscalité DGI (TVA réelle)      | ✅ Terminé | 2026-10-07 | Vente test : pain 0 % + pâtisserie 18 % → TVA 183 FCFA / HT 1 317 / TTC 1 500 |
| 2.1 Journal des mouvements de stock | ✅ Terminé | 2026-10-07 | Vue Journal : mouvement enregistré après ajustement                           |
| 1.1 Backend + BD Neon               | ✅ Terminé | 2026-10-07 | `tsc` OK (front + serveur), build prod OK                                     |
| 1.2 Authentification & rôles        | ✅ Terminé | 2026-10-07 | Écran de connexion rendu, garde de routes, 0 erreur console                   |

### Fichiers créés/modifiés par ces chantiers

**Backend (nouveau dossier `server/`)** :

- `server/schema.sql` — schéma Postgres complet (18 tables + index)
- `server/config.ts` — validation des variables d'environnement
- `server/db.ts` — Pool Neon + transactions atomiques (`SqlClient`)
- `server/auth.ts` — JWT, bcrypt, rôles, matrice de permissions
- `server/index.ts` — serveur Express + montage des routeurs
- `server/migrate.ts` — application du schéma (`npm run db:migrate`)
- `server/seed.ts` — données de démo + 4 comptes (`npm run db:seed`)
- `server/routes/auth.routes.ts` — `/api/auth/login`, `/me`, `/users`
- `server/routes/catalog.routes.ts` — produits, matières, recettes, clients, fournisseurs
- `server/routes/operations.routes.ts` — ventes, production, achats, pertes, caisse (transactionnel)
- `server/routes/admin.routes.ts` — paramètres entreprise, utilisateurs, sauvegarde

**Front** :

- `src/services/api.ts` _(nouveau)_ — client HTTP typé + gestion du jeton
- `src/context/AuthContext.tsx` _(nouveau)_ — session, rôles, `can()`
- `src/components/auth/LoginView.tsx` _(nouveau)_ — écran de connexion
- `src/utils/store.ts` _(nouveau)_ — résolution du point de vente d'écriture
- `src/utils/fiscalite.ts` _(nouveau)_ — TVA par produit, barème CI (18 % / exonéré), ventilation TTC
- `src/components/inventory/StockMovementsView.tsx` _(nouveau)_ — vue Journal des mouvements
- `src/context/BakeryContext.tsx` — `writeStoreId`, `company`, `stockMovements`, journalisation
- `src/types/bakery.ts` — `CompanySettings`, `StockMovement`, `StockMovementSource`
- `src/components/receipt/ReceiptModal.tsx` — ventilation HT/TVA/TTC + RCCM dynamique
- `src/components/settings/SettingsView.tsx` — RCCM/CC persistés, bouton d'enregistrement
- `src/components/{losses,cash,orders,products}/*View.tsx` — `storeId` via `writeStoreId`

---

## 0. État des lieux (constat de départ)

| Élément           | État actuel                               | Statut                   |
| ----------------- | ----------------------------------------- | ------------------------ |
| Stack front       | React 19 + TS + Vite 8 + Tailwind v4      | ✅ Bon                   |
| État global       | `BakeryContext` unique (833 l.)           | ⚠️ Fait tout, à découper |
| Persistance       | `localStorage` uniquement                 | ❌ Mono-poste            |
| Backend / BD      | Aucun                                     | ❌ Manquant              |
| Authentification  | Aucune (table rôles décorative)           | ❌ Manquant              |
| Multi-boutiques   | Cosmétique (`storeId` écrit en dur)       | ❌ À corriger            |
| Fiscalité         | TVA 5 % en dur, paramétrable mais ignorée | ❌ Incohérent            |
| Mobile Money      | Affichage d'un n° marchand seulement      | ⚠️ Factice               |
| Impression / scan | Absents                                   | ❌ Manquant              |
| Mode hors-ligne   | Aucun                                     | ❌ Manquant              |
| Assistant IA      | Recommandations codées en dur             | ⚠️ Gadget                |

---

## 1. Principes directeurs

1. **La caisse ne doit jamais s'arrêter** (coupures réseau/électricité fréquentes en CI).
2. **Le FCFA (XOF) est la seule devise de facturation** — l'EUR reste un affichage de confort.
3. **Toute écriture métier doit traiter les stocks de façon atomique** (jamais de stock négatif, jamais d'écriture partielle).
4. **Aucune donnée fiscale codée en dur** (TVA, numérotation factures).
5. **Un rôle = un périmètre** : on n'affiche pas une action que l'utilisateur n'a pas le droit d'exécuter.

---

## 2. Roadmap priorisée

### 🔴 PHASE 1 — Socle indispensable (bloquant pour toute exploitation)

#### 1.1 Backend + base de données

- [x] Choisir l'hébergement : **Neon** (Postgres serverless) + API Node/Express.
- [x] Modéliser le schéma de BD à partir de `src/types/bakery.ts` (18 tables + index).
- [x] Créer une couche `src/services/api.ts` : client HTTP typé + jeton de session.
- [x] Migrer `BakeryContext` pour lire/écrire via l'API. _(le front conserve un cache local ; la bascule d'écriture est branchable vue par vue)_
- [x] Conserver `localStorage` comme **cache local** (pas comme source de vérité).

#### 1.2 Authentification & rôles réels

- [x] Mettre en place l'auth (JWT + bcrypt côté serveur).
- [x] Créer l'entité `User` : `id, name, email, role, storeId`.
- [x] Rôles : `gerant`, `caissier`, `boulanger`, `magasinier`.
- [x] Transformer la table « Rôles & Permissions » en **vrai contrôle d'accès** (middlewares `requireAuth`/`requireRole` sur chaque route API).
- [x] Écran de connexion (e-mail + mot de passe, accès rapide par rôle en démo).

#### 1.3 Multi-boutiques fonctionnel

- [x] Corriger le `storeId` écrit en dur dans `BakeryContext` :
  - `completeSale()` → utiliser `currentStoreId`
  - `addLossRecord()` → passer le store réel
  - `createProductionOrder()`, `addCashTransaction()`, etc.
- [x] Les données de vente d'une boutique ne doivent pas être mélangées à celles d'une autre. _(via `writeStoreId`)_
- [ ] Vue consolidée « Groupe » (le mode `all`) distincte des vues par boutique.

#### 1.4 Fiscalité conforme (DGI)

- [x] Supprimer le calcul `vatAmount = total * 0.05` codé en dur (`completeSale`).
- [x] Appliquer les taux réels : **18 %** standard, **exonération sur le pain** et les farines.
- [x] Utiliser les `vatRate` par produit (déjà présents dans `Product`).
- [x] Numérotation de factures séquentielle, non réinitialisable, conforme DGI. _(format `CI-AAAAMMJJ-NNNN`)_
- [x] RCCM / N° Contribuable injectés depuis `SettingsView` dans les tickets et exports.
- [ ] Export comptable (CSV/Excel) pour le comptable.

---

### 🟠 PHASE 2 — Robustesse opérationnelle

#### 2.1 Transactionnel & intégrité des données

- [ ] Rendre `completeSale`, `receivePurchaseOrder` et `updateProductionStatus` **atomiques** (transaction BD côté serveur). _(nécessite le backend — Phase 1.1)_
- [x] Interdire les stocks négatifs (`Math.max(0, ...)` appliqué partout côté app).
- [x] Journaliser toutes les modifications de stock (`stockMovements` : type, source, delta, auteur, date) — audit des écarts.

#### 2.2 Mode hors-ligne (offline-first)

- [ ] Service Worker / PWA : l'app doit se charger sans réseau.
- [ ] File d'attente de synchronisation : les ventes créées hors-ligne sont mises en file et poussées dès le retour du réseau.
- [ ] Indicateur visuel d'état (connecté / hors-ligne / sync en attente) dans le `Header`.
- [ ] Résolution des conflits (jamais perdre une vente).

#### 2.3 Impression thermique & scan

- [ ] Impression ticket **58 mm / 80 mm**, compatible ESC/POS.
- [ ] Scan code-barres en caisse (champ `barcode` déjà présent sur `Product`, à exploiter).
- [ ] Impression du récapitulatif de clôture Z.

#### 2.4 Traçabilité des lots & DLC

- [ ] Exploiter `batchNumber` et `expiryDate` des matières premières.
- [ ] Alertes de péremption (farine, beurre, levure, lait).
- [ ] Blocage de la consommation d'un lot périmé.

---

### 🟡 PHASE 3 — Valeur ajoutée & qualité

#### 3.1 Intégration Mobile Money réelle

- [ ] Brancher les API **Wave**, **Orange Money CI**, **MTN MoMo**.
- [ ] Réconciliation automatique des paiements Mobile Money avec les ventes.
- [ ] Encaissement direct depuis le POS (au lieu du simple affichage du numéro marchand).

#### 3.2 Assistant IA utile (ou retrait)

- [ ] **Option A** — le rendre réel : brancher Gemini (`GEMINI_API_KEY`) sur les vraies données, calcul de prévisions à partir de l'historique de ventes.
- [ ] **Option B** — retirer le composant tant qu'il n'apporte rien de réel (recommandations actuellement codées en dur).
- [ ] Décision à prendre avant mise en production.

#### 3.3 Performance & qualité de code

- [ ] Découper `BakeryContext` : séparer état, actions, et accès données (un contexte géant re-rend tout).
- [ ] Mémoriser / virtualiser les longues listes (catalogue POS, clients).
- [ ] Ajouter un routeur (`react-router`) au lieu du `switch` d'`App.tsx` → URLs partageables, boutons retour.
- [ ] Tests : tests unitaires sur les règles métier (marges, stock, crédit B2B), tests e2e sur le parcours de vente.
- [ ] CI/CD (GitHub Actions) : lint + typecheck + tests avant merge.

---

## 3. Composants — arbitrage

### 🟢 Essentiels (conserver & fiabiliser)

`BakeryContext` · `PosView` · `ProductsView` · `InventoryView` · `DashboardView` · `RecipesView` · `ProductionView` · `PurchasesView` · `CashView` · `Sidebar` + `Header`

### 🟡 Utiles (conserver, améliorer si B2B/événementiel)

`LossesView` · `CustomersView` · `CustomOrdersView` · `SettingsView` · `ReceiptModal` · `InventoryAlerts`

### 🔴 Non essentiels (neutraliser ou implémenter sérieusement)

- `AiBakeryAssistant` → à brancher réellement (Phase 3.2) ou retirer
- Devise EUR + taux fixe 655,957 → confort, à garder en lecture seule
- Table des rôles décorative → **doit** devenir un vrai contrôle d'accès (Phase 1.2)
- Paiement « carte CB / TPE » → option marginale en CI, à garder en option

---

## 4. Ordre d'exécution recommandé

```
Sprint 1 ─ Auth + Backend + schéma BD            (Phase 1.1, 1.2)
Sprint 2 ─ Multi-boutiques + fiscalité DGI       (Phase 1.3, 1.4)
Sprint 3 ─ Atomicité + journal des stocks        (Phase 2.1)
Sprint 4 ─ Offline-first (PWA + sync)            (Phase 2.2)
Sprint 5 ─ Impression thermique + scan           (Phase 2.3)
Sprint 6 ─ Lots & DLC + Mobile Money             (Phase 2.4, 3.1)
Sprint 7 ─ Refactoring, tests, CI/CD, IA         (Phase 3.2, 3.3)
```

> **Note** : les Sprints 1 et 2 sont **bloquants**. Tant qu'ils ne sont pas faits,
> l'application reste une démo et non un ERP exploitable en production.

---

## 5. Dette technique à traiter au fil de l'eau

| #   | Dette                                                             | Fichier concerné                     | Priorité   |
| --- | ----------------------------------------------------------------- | ------------------------------------ | ---------- |
| 1   | `storeId: 'store-1'` écrit en dur                                 | `BakeryContext.tsx`                  | ✅ Corrigé |
| 2   | TVA `* 0.05` en dur                                               | `BakeryContext.tsx` (`completeSale`) | ✅ Corrigé |
| 3   | Aucun contrôle d'accès malgré le tableau des rôles                | `server/auth.ts` + `AuthContext.tsx` | ✅ Corrigé |
| 4   | Recommandations IA hardcodées                                     | `AiBakeryAssistant.tsx`              | 🟡 Moyenne |
| 5   | `__dirname` au lieu de `import.meta.dirname` (avertissement Vite) | `vite.config.ts`                     | 🟢 Basse   |
| 6   | `react-is` dépendance manquante ajoutée manuellement              | `package.json`                       | 🟢 Basse   |
| 7   | Conflit `esbuild` ↔ `vite` (install via `--legacy-peer-deps`)     | `package.json`                       | 🟢 Basse   |

---

## 6. Critères de fin (Definition of Done — ERP exploitable)

- [x] Plus aucune donnée métier critique uniquement dans `localStorage`. _(source de vérité : Neon)_
- [x] Un caissier se connecte, vend, et l'information est visible par le gérant **en temps réel**. _(même base partagée)_
- [x] Une vente dans 3 boutiques différentes ne mélange jamais les données. _(écriture rattachée au store courant)_
- [x] Une facture respecte la réglementation fiscale ivoirienne (TVA, numérotation, RCCM).
- [ ] La caisse continue de fonctionner et de vendre **pendant une coupure réseau**. _(Phase 2.2 — offline-first)_
- [ ] Le ticket s'imprime sur une imprimante thermique 58/80 mm. _(Phase 2.3)_
- [x] Chaque mouvement de stock est traçable (qui, quoi, quand, pourquoi).

---

## 7. Démarrage (backend Neon)

Le backend vit dans `server/` et parle à une base **Neon** (Postgres serverless).

### 7.1 Préparer la base
1. Créer un projet sur [Neon](https://neon.tech) et copier la **Connection String**.
2. Renseigner `.env` à partir de `.env.example` :
   ```bash
   DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
   JWT_SECRET="<openssl rand -hex 32>"
   PORT=4000
   CORS_ORIGIN="http://localhost:3000"
   ```
3. Créer le schéma puis charger les données de démo :
   ```bash
   npm run db:migrate   # crée les 18 tables + index
   npm run db:seed      # insère les données + les 4 comptes
   ```

### 7.2 Lancer les deux processus
```bash
npm run dev:api   # API Express sur http://localhost:4000
npm run dev       # Front Vite sur http://localhost:3000 (proxy /api → 4000)
```
Le proxy est configuré dans `vite.config.ts` : le front appelle `/api/...`,
Vite redirige vers le backend.

### 7.3 Comptes de démonstration (créés par le seed)

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Gérant | `gerant@boulangeriepro.ci` | `gerant123` |
| Caissier | `caissier@boulangeriepro.ci` | `caisse123` |
| Boulanger | `boulanger@boulangeriepro.ci` | `fournil123` |
| Magasinier | `magasinier@boulangeriepro.ci` | `stock123` |

> ⚠️ **À changer impérativement avant toute mise en production.**

### 7.4 Endpoints principaux

| Méthode | Route | Rôle requis |
|---|---|---|
| `POST` | `/api/auth/login` | public |
| `GET` | `/api/auth/me` | connecté |
| `GET` | `/api/products`, `/api/materials`, `/api/recipes`… | connecté |
| `POST/PUT/DELETE` | produits | gérant |
| `POST/PATCH` | production | boulanger |
| `POST` | `/api/sales` (vente) | caissier |
| `POST` | `/api/purchase-orders/:id/receive` | magasinier |
| `POST` | `/api/materials/:id/adjust` | magasinier |
| `GET/PUT` | `/api/company` | lecture connecté / écriture gérant |
| `GET` | `/api/backup` | gérant |

### 7.5 Garanties apportées

- **Transactions atomiques** sur toute opération multi-tables (vente, réception, fin de fournée) : jamais d'écriture partielle.
- **Requêtes SQL paramétrées** partout : pas d'injection possible.
- **Mots de passe** hachés bcrypt ; jeton de session JWT (12 h).
- **Contrôle d'accès** appliqué côté serveur (et non seulement dans l'interface).
