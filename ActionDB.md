# ActionDB — Audit Front/Back + Plan de corrections

> Généré le 08/10/2026 — Analyse statique croisée `src/` vs `server/`.
> Aucun code modifié : ce fichier est le plan d'exécution.

## 1. Cartographie Back (source de vérité, `server/index.ts`)

| Mount | Router | Préfixe final |
|---|---|---|
| `app.use("/api/auth", authRouter)` | auth | `/api/auth/*` |
| `app.use("/api/catalog", catalogRouter)` | catalog | `/api/catalog/*` |
| `app.use("/api/operations", operationsRouter)` | operations | `/api/operations/*` |
| `app.use("/api", adminRouter)` | admin | `/api/*` |
| `app.use("/api", reportsRouter)` | reports | `/api/*` |

### 1.1 Auth (`auth.routes.ts`)
- `POST /api/auth/login` (public)
- `GET /api/auth/me` (requireAuth)
- `GET /api/auth/users` (gerant, check inline)

### 1.2 Catalog (`/api/catalog/*`)
- `/stores`, `/products`, `/materials`, `/recipes`, `/customers`, `/suppliers`
- Verbes : `GET` liste, `POST` create, `PUT /:id`, `DELETE /:id`

### 1.3 Operations (`/api/operations/*`)
- `POST|GET /sales`, `PUT|DELETE /sales/:id`
- `POST|GET /production-orders`, `PATCH /production-orders/:id/status`
- `POST|GET /purchase-orders`, `PATCH /purchase-orders/:id/status`
- `POST /losses`, `DELETE /losses/:id`
- `POST /cash-transactions`, `DELETE /cash-transactions/:id`
- `POST /custom-orders`, `PATCH /custom-orders/:id/status`, `PUT|DELETE /custom-orders/:id`

### 1.4 Admin (`/api/*`)
- `GET /api/company` | `PUT /api/company` (gerant)
- `POST /api/users` | `PATCH /api/users/:id` (gerant)
- `GET /api/backup` (gerant) | `GET /api/session`

### 1.5 Reports (`/api/*`)
- `GET /api/dashboard/stats|recent-sales|low-stock-products`
- `GET /api/inventory/materials/:id/movements` (+ doublon `/inventory/movements/:id`)
- `GET /api/references/stores|suppliers|customers|recipes|production-orders|purchase-orders`
- `GET /api/sales/history`
## 2. Relevé Front (src/)

### 2.1 Client API (`src/services/api.ts`) — sain
- `API_BASE = import.meta.env.VITE_API_URL ?? ""` → en dev s'appuie sur proxy Vite `/api` (cf `vite.config.ts`). OK.
- `NEON_AUTH_URL = "/api/auth/login"` → aligne avec back `POST /api/auth/login`. OK (fix deja applique).
- `me() = GET /api/auth/me`. OK.
- `api = { get, post, put, patch, del, delete }` — les deux alias `del`/`delete` existent, donc `BakeryContext` qui melange les deux ne casse pas.
- `apiFetch` : injecte `Authorization: Bearer <token>`, normalise `ApiError`, gere `204`. File les mutations offline via `enqueueOperation()` si `!navigator.onLine`.

### 2.2 Appels metier (`src/context/BakeryContext.tsx`, `src/services/*`)
- Catalogue : `/api/catalog/products|materials|recipes|customers|suppliers` + `/api/catalog/stores` en lecture. Aligne avec mount `/api/catalog`.
- Operations : `/api/operations/sales`, `/purchase-orders`, `/cash-transactions`, `/losses`, `/custom-orders`, `/production-orders`. Aligne avec mount `/api/operations`.
- Admin/refs : pas d'appel direct a `/api/company`, `/api/backup`, `/api/session`, `/api/dashboard/*`, `/api/references/*`, `/api/sales/history` trouve dans `src/` (hors `PLAN_ACTION.md`). Soit fonctionnalites non branchees, soit donnees `initialData` encore utilisees en fallback.
- `AuthContext.tsx` : bypass demo — `demoUser gerant` injecte en dur au mount, `isRestoring=false`, jamais d'appel `me()` si token present. Le login reel `apiLogin()` n'est donc jamais restaure au reload.

### 2.3 Files offline (2 systemes en parallele — a unifier)
- `src/services/syncQueue.ts` (localStorage, utilise par `apiFetch`) : stocke `{ path, options, type }`, rejoue via `apiFetch(op.path, op.options)` sur event `online` + `setTimeout(syncAll,2000)` au boot. Detection type par `path.includes("/sales"|"/production"|"/purchase"|"/materials"|"/inventory")` — fonctionne avec les prefixes `/api/...` actuels.
- `src/services/offlineQueue.ts` (IndexedDB, singleton `offlineQueue`) : `processAction()` tape a cote :
  - `CREATE_SALE → api.post("/sales", ...)` — manque prefixe, devrait etre `/api/operations/sales`.
  - `UPDATE_STOCK → api.patch("/stock/:id", ...)` — route inexistante cote back.
  - `ADD_CASH_TRANSACTION → api.post("/cash/transactions", ...)` — devrait etre `/api/operations/cash-transactions`.
  - En plus `api.patch` existe bien dans `api.ts`, donc seul le path est faux, pas le verbe.

## 3. Corrections a effectuer (priorite P0 → P2)

### P0 — bloquant (404 / perte de donnees)
- [ ] **C1 — `offlineQueue.processAction()` tape a cote** (`src/services/offlineQueue.ts:198-210`).
  - `CREATE_SALE` : `"/sales"` → `"/api/operations/sales"`.
  - `UPDATE_STOCK` : `"/stock/:id"` → route back inexistante. Choisir : soit `PUT /api/catalog/materials/:id` (existant), soit ajouter `PATCH /api/operations/materials/:id/adjust` cote back. Ne pas laisser en l'etat (echec silencieux + retry x5 puis drop).
  - `ADD_CASH_TRANSACTION` : `"/cash/transactions"` → `"/api/operations/cash-transactions"`.
  - Ajouter le header `Authorization` (passer par `api.*`, deja le cas — verifier que le token est bien relu au replay IndexedDB, pas fige dans `action.data`).
- [ ] **C2 — Double systeme offline (`syncQueue` + `offlineQueue`)** : deux files, deux stockages (localStorage vs IndexedDB), deux triggers `online`. Risque de double-envoi (vente creee 2x) si les deux sont utilises. Decider : garder `syncQueue` (branche sur `apiFetch`) et deprecier `offlineQueue`, ou l'inverse. En attendant : ne pas `enqueue` dans les deux chemins pour la meme action.
- [ ] **C3 — `AuthContext` bypass demo** (`src/context/AuthContext.tsx:40-53`) : `demoUser gerant` ecrase toute session reelle, `me()` jamais appele au boot. En prod cela donne les droits max a tout visiteur. A minima : n'injecter le demo que si `!getToken()`, et tenter `apiMe()` quand un token existe.

### P1 — incoherences API (erreurs 400/403/500, UX cassee)
## 4. Ameliorations (P2 — robustesse, securite, DX)

- [ ] **A1 — Auth back** : `GET /api/auth/users` fait un check inline `role !== gerant` au lieu de `requireRole('gerant')` comme admin. Uniformiser. Verifier `requireAuth` sur toutes les routes catalog/operations (sinon lecture publique).
- [ ] **A2 — Validation inputs** : `admin PUT /company`, `POST /users`, `createSale`, `createProductionOrder` font confiance au body. Ajouter validation minimale (zod ou checks manuels) + codes 400 explicites. `POST /users` devrait generer l'`id` cote back (uuid) plutot que de le recevoir du front.
- [ ] **A3 — Pagination/filtrage** : listes `GET` sans `limit/offset` cote front (`stores`, `products`...). Ajouter `?limit=&offset=&storeId=` et brancher `storeId` du user (vs `"store-1"` en dur dans reports).
- [ ] **A4 — `storeOf()` reports** : fallback `"store-1"` masque les appels sans session. Preferer `401` si pas de `req.user.storeId`, ou documenter le mode demo.
- [ ] **A5 — SSE `/api/sse/mobilemoney`** : Set en memoire, pas de heartbeat, pas de nettoyage hors `close`, ne scale pas multi-instance. Ajouter `ping`, `retry`, limite de clients, et extraire dans un module.
- [ ] **A6 — Webhooks Mobile Money** : `express.raw` + `JSON.parse` manuel, lecture du secret en clair depuis `config`, comparaison `timingSafeEqual` sur buffers de tailles differentes (throw si tailles !=). Durcir : try/catch tailles, log sans payload sensible, test de signature par operateur.
- [ ] **A7 — Types** : `PendingAction.data: any` (offlineQueue), `PendingOperation.options: RequestInit` non serialisable proprement en localStorage (headers Body). Typer les payloads par action.
- [ ] **A8 — Supprimer le double `del`/`delete`** dans `api.ts` (garder `del` ou `delete`, pas les deux) une fois `BakeryContext` uniformise, pour eviter la confusion.
- [ ] **A9 — Brancher les ecrans orphelins** : `/api/company`, `/api/backup`, `/api/dashboard/*`, `/api/references/*`, `/api/sales/history` existent cote back mais ne sont appeles nulle part dans `src/`. Soit brancher les ecrans (Company, Dashboard, Backup), soit supprimer les routes mortes.

## 5. Verification (a lancer apres chaque correction)

```bash
# 1. Cohérence front/back (doit revenir vide = aucun 404 prévisible)
grep -rhoE "'/api/[^']+'" src --include='*.ts' --include='*.tsx' | sort -u > /tmp/front.txt
grep -rhoE '"/api/[^"]+"' server --include='*.ts' | sort -u > /tmp/back.txt
# comparer manuellement front.txt vs back.txt

# 2. Types + build
npx tsc --noEmit
npm run build

# 3. Smoke API (back lance sur :4000)
curl -s http://localhost:4000/api/health
curl -s -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@boulangerie.ci","password":"xxx"}'
```

> Ordre conseillé : C1 → C2 → C3 → C4 → C5 → C6/C7 → A1...A9.

