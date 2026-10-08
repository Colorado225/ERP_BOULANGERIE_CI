# C1 — Restauration session Auth (suppression bypass démo)

> Statut : EN COURS — 08/10/2026
> Source : `ActionDB.md` § C1 / §2.2
> Fichiers concernés : `src/context/AuthContext.tsx`

## 1. Constat

`AuthContext.tsx` (lignes 40-53) injecte un `demoUser` gérant en dur au montage :
- `setUser(demoUser)` inconditionnel, `isRestoring=false` immédiat.
- `apiMe()` (GET `/api/auth/me`) jamais appelé même si un token existe dans `localStorage`.
- Conséquence : droits max pour tout visiteur, session réelle jamais restaurée au reload, login réel inutile.

## 2. Objectif

- Si un token existe → tenter `GET /api/auth/me`, restaurer le profil réel.
- Si aucun token → ne pas donner les droits max en prod. Démo uniquement en `DEV`.
- `isRestoring=true` pendant la restauration (évite le flash UI non authentifiée).
- `can()` doit comprendre le wildcard `['*']` du démo (sinon `can('x')` retourne faux).

## 3. Modification prévue

Fichier `src/context/AuthContext.tsx` :
1. `useState(true)` pour `isRestoring`.
2. `useEffect` async `restore()` :
   - `token = getToken()` → si absent : démo seulement si `import.meta.env.DEV`, sinon `setUser(null)`.
   - Si présent : `await apiMe()` → `setUser(profile)`, échec → `apiLogout()` + `setUser(null)`.
   - `finally setIsRestoring(false)`.
3. `can()` : `if permissions includes '*' → true`.

## 4. Tests

- [ ] `npx tsc --noEmit` passe
- [ ] `npm run build` passe
- [ ] Reload avec token → profil réel restauré
- [ ] Sans token en prod → écran login (pas de gérant auto)

## 5. Résultat

(à compléter après application)
