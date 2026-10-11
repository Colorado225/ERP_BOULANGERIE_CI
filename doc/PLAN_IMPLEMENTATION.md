# Plan d'implémentation — corrections et mise en production

> **Statut** : proposition, à valider avant exécution
> **Date** : 11/10/2026
> **Base de référence** : commit `bdd3425` (branche `arena/6f9daeaa-erp-boulangerie-ci`)
> **Sources** : audit du code (`server/`, `src/`), `ActionDB.md` (C1–C7, A1–A9), `PLAN_ACTION.md`, `doc/C1-auth-restauration-session.md`
>
> Ce plan ne remplace pas `ActionDB.md` : il **ordonne** les corrections, ajoute les points absents
> de l'audit précédent et fixe les critères de validation.

---

## 0. Résumé

L'application compile (front et serveur : `tsc --noEmit` OK), mais elle **n'est pas exploitable en production** :

1. La majorité de l'API (catalogue, opérations) est **accessible sans authentification**.
2. Le **login** émet des jetons HS256 locaux alors que le serveur vérifie des jetons **Neon JWKS** : les routes protégées risquent de rejeter tout utilisateur réel.
3. Le **front** se connecte automatiquement en gérant (bypass démo) et accepte n'importe quel mot de passe pour les comptes démo en cas d'échec d'API.
4. Les **ventes** font confiance au client pour les prix, la TVA et le total.
5. Le **mode hors-ligne** envoie vers de mauvaises routes et peut créer des **doublons de ventes**.

Le plan est découpé en **5 lots** à livrer dans l'ordre. Les lots 1 à 3 sont **bloquants**.

| Lot | Thème                              | Bloquant ? | Taille estimée |
| --- | ---------------------------------- | ---------- | -------------- |
| 0   | Stabilisation & hygiène            | Oui        | S              |
| 1   | Authentification & contrôle d'accès | Oui        | M              |
| 2   | Intégrité métier (ventes, TVA, stock) | Oui     | M–L            |
| 3   | Hors-ligne fiable                  | Oui (caisse) | M            |
| 4   | Qualité, tests, CI, dette          | Non        | M–L            |
| 5   | Fonctionnalités (impression, lots, Mobile Money, IA) | Non | L |

Taille : S ≤ 1 jour, M ≈ 2–4 jours, L > 1 semaine (estimations indicatives, à affiner).

---

## 1. Décisions à prendre avant le lot 1

Ces choix conditionnent le code. Ils doivent être tranchés et consignés ici.

### D1 — Source d'identité : Neon Auth ou JWT local ?

Le code contient les deux systèmes : `server/auth.ts` annonce une « migration complète vers Neon Auth », mais `auth.routes.ts` émet ses propres jetons avec `signToken` (bcrypt + `JWT_SECRET`).

| Option | Principe | Avantages | Inconvénients |
| ------ | -------- | --------- | ------------- |
| **A. Neon Auth seul** (recommandée) | Login et jetons gérés par Neon ; le serveur ne fait que valider le JWKS | Pas de secret JWT à gérer, rotation des clés automatique | Les rôles (`role`, `storeId`) doivent être présents dans les claims du jeton ou récupérés en base ; dépendance externe |
| **B. JWT local seul** | Le serveur émet et vérifie ses jetons (HS256) | Autonome, hors-ligne possible côté tests | Gestion du secret et de la rotation à notre charge ; supprimer le code JWKS |

**Recommandation : A**, en vérifiant d'abord que Neon Auth fournit `role` et `storeId` (ou en mappant l'utilisateur via la table `users` à partir de `sub`).

> ⚠️ Tant que D1 n'est pas tranché, ne pas toucher à `requireAuth`.

### D2 — Validation des entrées

Options : **zod** (nouvelle dépendance, schémas typés réutilisables front/back) ou contrôles manuels.
**Recommandation : zod**, appliqué aux routes d'écriture uniquement dans un premier temps.

### D3 — Mode hors-ligne : une seule file

Deux files coexistent (`syncQueue.ts` en localStorage, `offlineQueue.ts` en IndexedDB).
**Recommandation : IndexedDB uniquement** (plus de capacité, pas de sérialisation fragile de `RequestInit`), `syncQueue.ts` supprimé.

### D4 — Numérotation des factures

Le numéro actuel `RCPT-${Date.now().toString(36)}` n'est **ni séquentiel ni conforme** à la numérotation DGI que `PLAN_ACTION.md` (1.4) déclare comme faite.
**À trancher** : format et source de la séquence (table `invoice_sequences` par boutique, verrouillée en transaction).

### D5 — Périmètre du mode démo

Le bypass démo doit disparaître en production. Options : (a) démo uniquement avec `import.meta.env.DEV` côté front et seed séparé côté base ; (b) supprimer complètement le mode démo. **Recommandation : (a)**.

---

## 2. Lot 0 — Stabilisation & hygiène (préalable)

Objectif : un dépôt reproductible et des secrets qui ne fuient pas.

| #    | Tâche | Fichiers | Critère de validation |
| ---- | ----- | -------- | --------------------- |
| 0.1  | Ajouter `.env`, `.env.*` (sauf `.env.example`), `dist/`, `*.log` au `.gitignore` | `.gitignore` | `git check-ignore .env` renvoie le fichier |
| 0.2  | Générer et committer un `package-lock.json` | racine | `npm ci` passe sans erreur |
| 0.3  | Résoudre le conflit peer `esbuild` ↔ `vite` / `@tailwindcss/vite` (aligner la version d'esbuild ou `overrides`) ; retirer le besoin de `--legacy-peer-deps` | `package.json` | `npm ci` et `npm run build` passent sans flag |
| 0.4  | Revoir `typescript: ^7.0.2` (version inhabituelle) : figer une version validée par `tsc` | `package.json` | `npm run lint` passe |
| 0.5  | Rendre obligatoires en production `JWT_SECRET` et les 3 secrets webhooks : supprimer les valeurs par défaut en `NODE_ENV=production` | `server/config.ts` | Démarrage en prod sans variable → erreur explicite |
| 0.6  | Consolider les scripts de seed : `seed.ts` (17 INSERT, non branché) et `seeds.ts` (branché sur `db:seed`) ne doivent former qu'un seul script | `server/seed*.ts`, `package.json` | Un seul fichier de seed, `npm run db:seed` crée les 4 comptes |
| 0.7  | Mettre à jour `PLAN_ACTION.md` : décocher ce qui n'est pas vrai (1.2, 1.3, 1.4, 2.1 et la « Definition of Done ») | `PLAN_ACTION.md` | Cohérence entre les cases cochées et le code |

**Vérification** : `npm ci && npm run lint && npm run build` depuis un clone propre.

---

## 3. Lot 1 — Authentification & contrôle d'accès (bloquant)

Objectif : aucune donnée métier accessible sans session valide ; un seul système d'identité.

| #    | Tâche | Fichiers | Critère de validation |
| ---- | ----- | -------- | --------------------- |
| 1.1  | **Trancher D1** et consigner la décision dans ce document | — | Décision écrite (§1) |
| 1.2  | Unifier l'émission et la vérification des jetons (supprimer le système non retenu : `signToken` ou `createRemoteJWKSet`) | `server/auth.ts`, `server/neon-auth.ts`, `server/routes/auth.routes.ts` | Un jeton émis par `POST /api/auth/login` passe `GET /api/auth/me` |
| 1.3  | Appliquer `requireAuth` **au niveau routeur** sur `catalogRouter` et `operationsRouter` (`router.use(requireAuth)`) ; garder `/api/health` et `/api/auth/login` publics | `server/routes/catalog.routes.ts`, `operations.routes.ts`, `server/index.ts` | `curl /api/catalog/products` sans jeton → 401 |
| 1.4 | Définir une matrice rôle × action pour chaque routeur (lecture : tout rôle authentifié ; écriture : rôles listés) et l'appliquer avec `requireRole` ; supprimer les vérifications inline | `server/auth.ts` (`PERMISSIONS`), tous les routeurs | Tests : un `caissier` ne peut pas `DELETE /api/catalog/products/:id` |
| 1.5 | Remplacer les fallbacks `req.user?.storeId ?? "store-1"` par un refus : sans `storeId` → 403 (ou 401) | `operations.routes.ts`, `reports.routes.ts` (`storeOf`) | Aucun `"store-1"` en dur côté serveur (hors seeds) |
| 1.6 | Uniformiser `GET /api/auth/users` sur `requireRole("gerant")` (ActionDB A1) | `auth.routes.ts` | Même comportement que `/api/users` |
| 1.7 | **Exécuter le plan C1** (`doc/C1-auth-restauration-session.md`) : restaurer la session par `GET /api/auth/me` ; démo seulement en `DEV` | `src/context/AuthContext.tsx` | Reload avec jeton → profil réel ; sans jeton en prod → écran de connexion |
| 1.8 | Corriger `can()` : le wildcard `'*'` doit retourner vrai | `src/context/AuthContext.tsx` | `can('x')` avec `['*']` → `true` |
| 1.9 | Supprimer le repli démo dans `login()` : une erreur d'API reste une erreur | `src/context/AuthContext.tsx` | Mauvais mot de passe pour `gerant@…` → message d'erreur, pas de session |
| 1.10 | Limiter les tentatives de connexion (ex. `express-rate-limit`, 5 essais / 15 min par IP+e-mail) | `server/routes/auth.routes.ts` | 6e tentative → 429 |
| 1.11 | Mettre les rôles de démo sous contrôle : mots de passe des seeds hors du code de production, documentés pour le seul environnement de dev | `server/seeds.ts` | Pas de mot de passe de démo affiché en production |

**Tests de non-régression (manuels ou automatisés, voir lot 4)** :
- Accès non authentifié à chaque routeur → 401.
- Accès avec chaque rôle → 200 ou 403 selon la matrice.
- Jeton expiré ou falsifié → 401.

---

## 4. Lot 2 — Intégrité métier : ventes, TVA, stock (bloquant)

Objectif : le serveur est la seule source de vérité pour les prix, la TVA, les totaux et les stocks.

| #    | Tâche | Fichiers | Critère de validation |
| ---- | ----- | -------- | --------------------- |
| 2.1  | **Ne plus accepter `unitPrice`, `vatAmount`, `total` du client** : prix lus en base, TVA calculée par produit (`vat_rate`), total recalculé | `server/services/salesService.ts` | Une vente envoyée avec un prix falsifié est facturée au prix de la base |
| 2.2  | Calcul TVA CI : taux par produit (18 % standard, 0 % pain / farines selon `fiscalite.ts`), arrondi FCFA défini et testé | `salesService.ts`, `src/utils/fiscalite.ts` (miroir) | Vente test : pain 0 % + pâtisserie 18 % → TVA 183 FCFA, HT 1 317, TTC 1 500 (valeur de `PLAN_ACTION.md`) |
| 2.3  | Accepter l'`id` de vente fourni par le client (UUID généré hors-ligne) et le dédupliquer : `INSERT … ON CONFLICT (id) DO NOTHING` puis renvoyer la vente existante | `salesService.ts`, `schema.sql` | Rejouer deux fois la même vente → une seule ligne en base |
| 2.4  | **Trancher D4** puis implémenter la numérotation séquentielle par boutique (table de séquence verrouillée `FOR UPDATE` dans la transaction) | `salesService.ts`, `schema.sql` | Numéros consécutifs sans trou sur 100 ventes concurrentes |
| 2.5  | Validation des entrées sur les écritures (zod, D2) : ventes, production, achats, pertes, caisse, produits, utilisateurs (ActionDB A2). Réponses `400` explicites | `server/routes/*.ts`, nouveau `server/validation/` | Corps invalide → 400 avec détail ; aucun 500 pour une entrée invalide |
| 2.6  | Contraintes en base : `CHECK (current_stock >= 0)` sur `materials`, `CHECK (quantity > 0)` sur `sale_items`, `CHECK (total >= 0)` sur `sales` | `server/schema.sql` + migration | Une écriture qui rendrait le stock négatif échoue au niveau SQL |
| 2.7  | Rendre atomiques les opérations multi-tables restantes : `receivePurchaseOrder`, `updateProductionStatus` (`PLAN_ACTION.md` 2.1 non coché) | `purchaseService.ts`, `productionService.ts` | Échec au milieu d'une réception → aucune écriture partielle (test avec erreur injectée) |
| 2.8  | Journaliser chaque variation de stock avec auteur et source (vérifier la table et les appels de `inventoryService.ts`) | `inventoryService.ts`, `schema.sql` | Chaque vente / perte / réception crée une ligne de mouvement |
| 2.9  | Supprimer les fallbacks `"Caisse"` et `cashierName` venant du corps : le nom de caissier vient du jeton | `operations.routes.ts` | Le caissier enregistré est celui du jeton |

**Points de vigilance** :
- 2.1 change le contrat de l'API : le front doit être adapté dans le même lot (`BakeryContext.completeSale`).
- Le calcul de TVA doit être **identique** côté front (affichage du ticket) et serveur (enregistrement). Préférer une fonction partagée dans `src/utils/fiscalite.ts` importée aussi par le serveur, ou un test de non-régression qui compare les deux.

---

## 5. Lot 3 — Hors-ligne fiable (bloquant pour la caisse)

Objectif : une vente faite pendant une coupure n'est jamais perdue ni dupliquée.

| #    | Tâche | Fichiers | Critère de validation |
| ---- | ----- | -------- | --------------------- |
| 3.1  | Décider D3 (une seule file, IndexedDB) et supprimer `syncQueue.ts` ou `offlineQueue.ts` | `src/services/` | Une seule implémentation de file dans le dépôt |
| 3.2  | Corriger les chemins de `processAction` (ActionDB C1) : `/api/operations/sales`, `/api/operations/cash-transactions` | `src/services/offlineQueue.ts` | Replay d'une vente → 201 |
| 3.3  | Supprimer `UPDATE_STOCK` tant qu'aucun endpoint n'existe, ou créer `PATCH /api/operations/materials/:id/adjust` | `offlineQueue.ts`, `operations.routes.ts` | Plus aucune route inexistante appelée |
| 3.4  | Générer l'`id` de vente côté client (UUID) et l'envoyer au serveur (dépend de 2.3) | `BakeryContext.tsx`, `PosView.tsx` | Même UUID avant et après synchronisation |
| 3.5  | Rejeu idempotent : en cas de réponse perdue, renvoyer le même `id` ; le serveur répond `200` avec la vente existante | `salesService.ts` | Tester : timeout simulé après création → pas de doublon |
| 3.6  | Ne pas réessayer indéfiniment : statut `failed` visible, action rejouable manuellement, aucune suppression silencieuse après 5 essais (ActionDB C1) | `offlineQueue.ts` | Une action en échec reste visible dans l'interface |
| 3.7  | Indicateur d'état dans le `Header` : en ligne / hors-ligne / N opérations en attente | `src/components/layout/Header.tsx` | Passage hors-ligne visible en < 2 s |
| 3.8  | Vérifier la configuration PWA existante (`vite-plugin-pwa` est déjà présent) : cache de l'application shell, chargement sans réseau | `vite.config.ts` | Application rechargée hors-ligne depuis le cache |
| 3.9  | Typer les payloads de file (`PendingAction` par type, ActionDB A7) | `offlineQueue.ts` | Plus de `any` dans la file |

**Scénario de recette obligatoire** : mode avion → 3 ventes + 1 encaissement → retour réseau → 4 enregistrements en base, aucun doublon, aucune perte, relance de la synchronisation sans duplication.

---

## 6. Lot 4 — Qualité, tests, CI et dette technique

### 4.1 Tests

| #     | Tâche | Critère |
| ----- | ----- | ------- |
| 4.1.1 | Ajouter **Vitest** ; tests unitaires de `fiscalite.ts` et du calcul de vente | Couverture des taux 0 %, 18 %, arrondis |
| 4.1.2 | Tests d'intégration API (Supertest ou équivalent) contre une base Postgres de test (ex. Docker Postgres ou branche Neon dédiée) : auth, matrice de rôles, ventes, stock | Suite exécutable en local avec une seule commande |
| 4.1.3 | Test de concurrence sur la numérotation des factures et les stocks | Pas de doublon, pas de stock négatif |
| 4.1.4 | Test e2e (Playwright) du parcours : connexion → vente → ticket → rapport du jour | Parcours vert en CI |

### 4.2 Intégration continue

| #     | Tâche | Critère |
| ----- | ----- | ------- |
| 4.2.1 | Workflow GitHub Actions : `npm ci` → `lint` → `test` → `build` sur chaque PR | PR bloquée si rouge |
| 4.2.2 | Protéger la branche principale (revue obligatoire, checks requis) | Configuration effective dans GitHub |

### 4.3 Refactoring

| #     | Tâche | Fichiers | Critère |
| ----- | ----- | -------- | ------- |
| 4.3.1 | Découper `BakeryContext` (833 lignes) en contextes par domaine (ventes, stock, production, achats, caisse) ou en hooks + services | `src/context/` | Aucun fichier > 300 lignes ; `tsc` et tests verts |
| 4.3.2 | Pagination et filtre `storeId` sur les listes (`?limit=&offset=&storeId=`) — ActionDB A3 | `server/routes/*.ts`, `src/services/api.ts` | Liste de 10 000 lignes paginée |
| 4.3.3 | Ajouter `react-router` pour les URL partageables (ActionDB / PLAN 3.3) | `src/App.tsx` | Retour arrière du navigateur fonctionnel |
| 4.3.4 | Supprimer le double alias `del`/`delete` (ActionDB A8) | `src/services/api.ts` | Un seul nom utilisé |
| 4.3.5 | Supprimer la route en double `/api/inventory/movements/:id` ou la documenter (ActionDB A9) | `reports.routes.ts` | Une seule route par ressource |
| 4.3.6 | Brancher ou supprimer les routes orphelines (`/api/company`, `/api/backup`, `/api/dashboard/*`, `/api/references/*`, `/api/sales/history`) — ActionDB A9 | `src/`, `server/routes/` | Chaque route serveur est appelée ou retirée |
| 4.3.7 | Webhooks Mobile Money : remplacer `JSON.parse` manuel par un schéma, gérer les signatures de tailles différentes sans lever d'exception (ActionDB A6) | `server/index.ts` | Signature invalide → 401, jamais de 500 |
| 4.3.8 | SSE : heartbeat, limite de clients, module dédié (ActionDB A5) | `server/index.ts` → nouveau module | Connexions fantômes nettoyées |
| 4.3.9 | Corriger les avertissements connus : `__dirname` dans `vite.config.ts`, dépendance `react-is` ajoutée à la main | `vite.config.ts`, `package.json` | Build sans avertissement |

---

## 7. Lot 5 — Fonctionnalités métier (après stabilisation)

Ces tâches ne doivent commencer qu'une fois les lots 0 à 3 validés.

| #    | Fonctionnalité | Prérequis | Points d'attention |
| ---- | -------------- | --------- | ------------------ |
| 5.1  | Impression ticket ESC/POS 58/80 mm (`escposPrinter.ts` existe, à valider) | 2.1 (ticket issu du serveur) | Test sur une vraie imprimante ; fallback « imprimer le PDF » |
| 5.2  | Clôture Z imprimable et exportable | 2.4 | Totaux TVA par taux |
| 5.3  | Scan code-barres en caisse (`@zxing/library` présent) | — | Champ `barcode` déjà sur `Product` ; index unique par boutique |
| 5.4  | Lots et DLC des matières premières, blocage des lots périmés | 2.8 | Règle de blocage côté serveur, pas seulement en affichage |
| 5.5  | Mobile Money : Wave, Orange Money CI, MTN MoMo (encaissement, webhooks, réconciliation) | 1.x, 4.3.7 | Secrets réels hors dépôt ; environnement sandbox d'abord ; réconciliation idempotente |
| 5.6  | Export comptable CSV/Excel (PLAN 1.4) | 2.4 | Format attendu par le comptable du client |
| 5.7  | Assistant IA : **décision** (brancher Gemini sur les données réelles, ou retirer le composant) | 4.1 (tests des données) | Tant que non décidé, les recommandations codées en dur restent masquées ou étiquetées « exemple » |
| 5.8  | Vue consolidée « Groupe » multi-boutiques (PLAN 1.3, case non cochée) | 1.5 | Droits : réservé au gérant |

---

## 8. Calendrier indicatif

```
Semaine 1  ─ Lot 0 (hygiène) + décisions D1 à D5 + Lot 1.1–1.6
Semaine 2  ─ Lot 1 (fin : 1.7–1.11) + Lot 2.1–2.3
Semaine 3  ─ Lot 2 (2.4–2.9) + Lot 3.1–3.5
Semaine 4  ─ Lot 3 (3.6–3.9) + recette hors-ligne + Lot 4.1
Semaine 5+ ─ Lot 4 (CI, refactoring) puis Lot 5 par priorité métier
```

> Hypothèse : une personne à temps plein. Les lots 0 à 3 sont un prérequis pour toute mise en
> production avec de vraies données de clients et de paiements.

---

## 9. Risques

| Risque | Impact | Parade |
| ------ | ------ | ------ |
| Neon Auth ne fournit pas `role`/`storeId` dans le jeton | Matrice de rôles impossible | Mapper via la table `users` (`sub` → rôle) ; vérifier avant 1.2 |
| Changement de contrat de l'API (2.1, 2.3) | Casse du front | Lots 2 et front livrés ensemble ; versionner `/api/v1` si nécessaire |
| Données de production existantes avec stock négatif | Échec de la contrainte 2.6 | Requête de diagnostic + correction des données avant migration |
| Numéros de factures déjà émis (`RCPT-…`) | Rupture de séquence | Conserver l'ancien numéro en colonne `legacy_receipt_number`, nouvelle séquence à partir d'une date d'effet |
| Dépendance à Neon (réseau) | Caisse bloquée | Lot 3 : la caisse fonctionne hors-ligne |
| Secrets présents dans l'historique Git | Compromission | Rotation de tout secret réel ayant pu être commité ; vérifier l'historique avec `git log -p` et `git grep` sur les motifs de clés |

---

## 10. Critères de sortie (Definition of Done — mise en production)

- [ ] Aucune route métier accessible sans jeton valide (test automatisé).
- [ ] Un seul système d'identité ; aucun mot de passe de démo actif en production.
- [ ] Prix, TVA et totaux calculés par le serveur ; TVA conforme aux taux CI.
- [ ] Numérotation des factures séquentielle, sans trou, testée en concurrence.
- [ ] Stock jamais négatif (contrainte SQL + test).
- [ ] Vente hors-ligne rejouée : aucune perte, aucun doublon.
- [ ] `npm ci && npm run lint && npm test && npm run build` passent sur un clone propre.
- [ ] CI active sur la branche principale.
- [ ] `PLAN_ACTION.md` et `ActionDB.md` reflètent l'état réel.

---

## 11. Vérifications rapides (à lancer après chaque lot)

```bash
# Dépôt propre et reproductible
npm ci && npm run lint && npm run build

# API : routes protégées
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/catalog/products   # attendu : 401
curl -s http://localhost:4000/api/health                                              # attendu : status ok

# Login (remplacer par un compte seedé en dev)
curl -s -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"gerant@boulangeriepro.ci","password":"mauvais"}'                       # attendu : 401

# Cohérence des routes front/back (ActionDB §5)
grep -rhoE "['\"]/api/[^'\"]+['\"]" src --include='*.ts' --include='*.tsx' | sort -u > /tmp/front.txt
grep -rhoE "['\"]/api/[^'\"]+['\"]" server --include='*.ts' | sort -u > /tmp/back.txt
```
