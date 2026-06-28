# PERFORMANCE_RULES — Perf & UX shell

Lecture **avant toute modif du shell, d'un dashboard ou d'une route lourde**.
Détail + exemples : `docs/performance.md`.

## Règles obligatoires (résumé)
- Le **shell** (header public, sidebar admin, layout) reste **stable** en navigation :
  pas de spinner plein écran, pas de layout qui saute. La sidebar admin highlight la route
  active (`nav-main.tsx`).
- Toute route lourde a un `loading.tsx` **adapté à sa vraie structure** (pas un skeleton
  générique). Réutiliser `components/ui/skeletons.tsx` — **interdiction de dupliquer**.
- Premier rendu critique **côté serveur / RSC** quand possible (modèles : `app/page.tsx`,
  `app/actualites/page.tsx`). Ne pas migrer des données serveur critiques vers un fetch
  client `useEffect`. **Pas de TanStack Query** : critique → RSC ; secondaire → API + cache
  (`lib/data-client.ts`).
- **Zustand** = état UI local uniquement (`lib/page-builder/store.ts`, `confirm-dialog`).
  Jamais de données serveur lourdes / listes / analytics dedans.
- Composants lourds non visibles au démarrage (dialogs, drawers, TipTap, recharts, leaflet,
  OCR, PDF) → `next/dynamic` (ssr:false si DOM-only) avec fallback dimensionné
  (modèle `components/admin/changelog-manager.tsx`).
- Onglets : ne monter/charger que l'onglet actif.
- Listes : pagination + filtres **côté DB/API** ; `findMany` **toujours borné**.
- Index DB : **additifs uniquement** (`CREATE INDEX CONCURRENTLY`, `prisma/perf-indexes.sql`).
  ⚠️ Neon partagée → **jamais `db push`**.

## Après une modif shell / dashboard / route critique
Vérifier navigation rapide desktop **+ mobile** et l'absence d'erreurs console.
