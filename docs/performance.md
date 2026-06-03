# Performance & UX — Beldoc

Guide de référence pour garder l'app fluide et stable, et pour que les futures
fonctionnalités ne recréent pas de lenteur. Les **règles courtes** sont dans
[AGENTS.md](../AGENTS.md) (§ « Performance & UX App ») ; ce document donne le
détail, les exemples et les routes sensibles.

Stack pertinente : **Next.js 16 App Router** (server components par défaut),
React 19, Prisma + PostgreSQL (Neon), Zustand (UI only), Tailwind 4 / shadcn.
**Pas de TanStack Query** dans ce projet.

---

## 1. Routes sensibles

À tester en priorité après toute modif du shell, du routing ou d'une de ces
pages.

| Route | Type | Pourquoi sensible |
|---|---|---|
| `app/page.tsx` (accueil) | Public, RSC | Route la + visitée. Critique pour le LCP. |
| `app/[slug]` (pages CMS) | Public, RSC | Rendu page-builder ; cf. §8 (bundle public). |
| `app/outils`, `app/outils/bureaux`, `app/creer-ma-demande` | Public | Funnel + catalogue + carte. `loading.tsx` + carte lazy. |
| `app/actualites` | Public, RSC | Modèle RSC de référence (fetch serveur → vue client). |
| `app/admin` (dashboard) | Admin, RSC | Page admin la + chargée ; recharts lazy + requêtes bornées. |
| `app/admin/pages/[pageId]` | Admin | Éditeur page-builder (plus lourd écran ; dynamic + loading). |
| `app/admin/news/[newsId]`, `app/admin/pdf/analytics`, `app/admin/news/stats` | Admin | Éditeur TipTap / dashboards recharts (lazy). |
| `app/admin/*` listes (users, baremes, bureaux, chomage/lookup…) | Admin | Tables data-lourdes ; `loading.tsx` partagé + bornage DB. |

---

## 2. Navigation & shell (performance perçue)

- Le **shell reste monté** pendant les navigations : header public
  (`components/docbel/landing/header.tsx`) et sidebar admin
  (`components/admin-layout-provider.tsx` + `app-sidebar.tsx`) vivent **hors**
  de `{children}`. Ne pas les remonter à chaque route.
- **Pas de spinner plein écran** qui remplace toute la page. Le contenu charge
  via `loading.tsx` (skeleton) ; le shell ne bouge pas.
- **Feedback de navigation** : la sidebar admin (`nav-main.tsx`) highlight la
  route active (`isActive` dérivé de `usePathname`) et ouvre d'emblée le groupe
  contenant la route active. Le header public fait pareil (`resolveActiveNav`).
- Pas de `setState` synchrone dans un `useEffect` (ESLint
  `react-hooks/set-state-in-effect`). Pour seeder un état depuis la route,
  utiliser un **initializer lazy** de `useState` (cf. seed des groupes ouverts
  dans `nav-main.tsx`).

---

## 3. Skeletons & loading states

- Chaque route lourde a un `loading.tsx` **calqué sur sa vraie structure**
  (table pour une liste, KPI+charts pour un dashboard, hero+grille pour le
  funnel public, éditeur pour le builder).
- **Réutiliser** les briques de [`components/ui/skeletons.tsx`](../components/ui/skeletons.tsx) :
  `PageHeaderSkeleton`, `FilterBarSkeleton`, `TableSkeleton`, `KpiCardsSkeleton`,
  `CardGridSkeleton`, `ChartSkeleton`. **Interdiction de dupliquer** des
  skeletons similaires dans chaque route.
- Dimensions proches du rendu final → limite le **CLS**. Les fallbacks de
  composants `dynamic()` (carte, éditeur) sont aussi dimensionnés.
- `app/admin/loading.tsx` (table générique) couvre les routes admin de type
  **liste**. Les routes non-liste (dashboards, stats, éditeur) ont leur propre
  `loading.tsx`.

---

## 4. Server Components / RSC / données critiques

- Les **données critiques au premier paint** restent côté serveur (RSC). Fetch
  Prisma dans le `page.tsx` async, données passées en **props sérialisables**
  aux enfants client.
- Modèle de référence : `app/actualites/page.tsx`, `app/page.tsx`,
  `app/admin/employeurs/stats`. Anti-pattern : `page.tsx` `"use client"` qui
  `fetch()` en `useEffect` ce qui aurait pu être rendu côté serveur.
- Isoler les **petits îlots interactifs** dans des composants client séparés
  plutôt que de marquer toute la page `"use client"`.
- Ne pas envoyer de **gros objets** au client si seule une petite partie est
  utile (cf. §6, `select`).
- Garder le **fail-soft** quand on déplace un fetch côté serveur : `.catch()`
  par requête pour ne pas transformer un hoquet DB en 500 (cf. `app/page.tsx`).

---

## 5. Données secondaires (remplace « TanStack Query »)

Ce projet **n'utilise pas TanStack Query**. Équivalents en place :

- Données **critiques** → RSC (cf. §4).
- Données **secondaires / à la demande / gros référentiels** → endpoint API +
  cache client léger avec TTL (`lib/data-client.ts`, ex. commissions paritaires,
  U1). Ne pas bundler les gros référentiels en statique.
- Refresh client ponctuel → `fetch` dans un composant client dédié (drawer,
  onglet). Ne pas dupliquer un fetch serveur **et** client pour la même donnée.

---

## 6. Listes, filtres, pagination, DB

- Pousser pagination + filtres **côté DB/API** (`where`, `take`/`skip`), pas de
  `.filter()`/`.slice()` côté JS après avoir chargé toute la table.
- `findMany` **toujours borné** par un `take` raisonnable (convention AGENTS).
- `select` explicite pour ne pas tirer de colonnes lourdes inutiles (JSON
  `content` page-builder, `content` HTML d'article, champs PDF, embeddings…)
  dans une vue qui n'en a pas besoin (ex. `app/admin/page.tsx` ne tire plus
  `content` pour lister les pages).
- `include` parcimonieux : ne pas charger des relations entières (logo,
  description, lat/lng) pour une liste qui n'affiche qu'un nom.
- Paralléliser les requêtes indépendantes (`Promise.all`), éviter les N+1
  (préférer un `findMany({ where: { id: { in } } })` à N `findUnique`).

### Index

- Additifs uniquement : `CREATE INDEX CONCURRENTLY IF NOT EXISTS` via
  [`prisma/perf-indexes.sql`](../prisma/perf-indexes.sql).
- ⚠️ **Base Neon PARTAGÉE + projet en PR → JAMAIS `prisma db push`** (détruit
  pgvector + tables PDF). Toujours du SQL additif (`prisma db execute` / `psql`).
- Pour un `ILIKE 'prefix%'` (Prisma `startsWith` + `mode:"insensitive"`), un
  btree simple ne sert pas : utiliser un **GIN trigram** (`pg_trgm`).

---

## 7. Zustand / stores client

- 2 stores seulement : `lib/page-builder/store.ts` (état de l'éditeur : blocs en
  cours d'édition, sélection, undo/redo borné, preview) et
  `components/ui/confirm-dialog.tsx` (open/options/resolver).
- Uniquement de l'**état UI local** : onglets, drawers, filtres brouillon,
  sélection, état optimiste, ouverture de modales.
- **Jamais** de données serveur lourdes, listes complètes, stats, données DB.

---

## 8. Lazy loading / dynamic imports

- Tout composant lourd **non visible au démarrage** → `next/dynamic`
  (`ssr:false` si DOM-only) avec fallback dimensionné.
- Pattern de référence : `components/admin/changelog-manager.tsx`
  (`dynamic(() => import(...).then(m => ({ default: m.X })), { ssr:false, loading })`).
- Pour utiliser `dynamic({ ssr:false })` depuis un **Server Component**, passer
  par un petit **wrapper client** (cf.
  `components/admin/chomage-ia/floating-chat/floating-chat-fab-lazy.tsx`).
- Déjà différés (ne pas re-bundler en statique) : leaflet, tesseract.js (OCR),
  pdfjs-dist, react-pdf, pdf-lib, jspdf, xlsx, mammoth, recharts (dashboard +
  analytics), TipTap (changelog + news), carte d3-geo/topojson (bureaux),
  FloatingChatFab.
- **Sujet ouvert (Phase 5)** : le rendu public du page-builder
  (`lib/page-builder/registry.ts`) étale statiquement les 17 modules de blocs et
  co-localise `Fields` (éditeur, importe TipTap) avec `Render` (public) → toute
  page publique embarque recharts + TipTap (~500 Ko). Refactor à faire :
  séparer `Fields`/`Render` + résolution lazy par type de bloc. **Mesurer
  avant/après.** Touche un système cœur → branche dédiée + QA éditeur+public.

---

## 9. Mobile / responsive

- Vérifier après chaque modif du shell : sidebar mobile (offcanvas), header
  mobile (Sheet), scroll, largeur des panneaux/drawers, menus, navigation
  rapide, absence d'overflow / de saut de layout.
- Les skeletons et grilles utilisent les breakpoints `sm:`/`lg:` cohérents avec
  la page rendue.

---

## 10. Checklist avant PR

- [ ] `loading.tsx` présent + réaliste pour toute nouvelle route lourde.
- [ ] Pas de skeleton dupliqué (réutilise `components/ui/skeletons.tsx`).
- [ ] Données critiques en RSC ; pas de fetch client `useEffect` évitable.
- [ ] Composants lourds non visibles au 1er écran en `dynamic()`.
- [ ] `findMany` borné (`take`) + `select`/`where` côté DB pour les listes.
- [ ] Pas de données serveur lourdes dans un store Zustand.
- [ ] Pas de spinner plein écran ; shell stable.
- [ ] Index DB éventuels = SQL additif (jamais `db push`).

## 11. Checklist avant merge

- [ ] `pnpm build` compile + TypeScript OK (cf. note build ci-dessous).
- [ ] Navigation rapide desktop **et** mobile, pas d'erreur console.
- [ ] Login/logout OK si touché à l'auth.
- [ ] Skeletons propres, pas de layout qui saute, pas de double-fetch.
- [ ] Pas de composant lourd hydraté inutilement.

> **Note build local** : `next build` peut échouer à l'**export** sur les
> routes ISR (`revalidate`) qui interrogent la DB (ex. `/api/baremes/lookup`)
> si la base Neon est injoignable depuis la machine. C'est **environnemental**
> (la DB est joignable au build sur Vercel). Pour valider le code en local, se
> fier au **`✓ Compiled successfully` + `Finished TypeScript`** ; l'échec
> d'export d'une route DB non modifiée n'indique pas une régression.

---

## 12. Exemples — bonnes / mauvaises pratiques

**RSC — bon (page d'accueil)**
```tsx
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const [articles, toolRows] = await Promise.all([
    prisma.news.findMany({ where: { status: "published", featured: true },
      orderBy: { createdAt: "desc" }, take: 10, select: { /* scalaires */ } })
      .catch(() => []),               // fail-soft
    fetchAllToolsActive().catch(() => []),
  ]);
  return <LandingHero article={articles[0] ?? null} loading={false} />;
}
```

**RSC — mauvais (avant)**
```tsx
"use client";
export default function HomePage() {
  const [news, setNews] = useState([]);
  useEffect(() => { fetch("/api/news?...").then(/* … */); }, []); // fetch client sur la route la + visitée
  return <LandingHero article={news[0]} loading={loading} />;
}
```

**Lazy — bon**
```tsx
const RichTextEditor = dynamic(
  () => import("@/components/docbel/rich-text-editor").then(m => ({ default: m.RichTextEditor })),
  { ssr: false, loading: () => <EditorSkeleton /> }
);
```

**Lazy — mauvais**
```tsx
import { RichTextEditor } from "@/components/docbel/rich-text-editor"; // TipTap dans le bundle initial
```

**DB — bon / mauvais**
```tsx
// bon : borné + select scalaire
prisma.page.findMany({ select: { id:true, title:true, status:true }, take: 200, orderBy:{ createdAt:"desc" } });
// mauvais : tout, non borné (tire `content` JSON lourd)
prisma.page.findMany({ orderBy: { createdAt: "desc" } });
```

---

## 13. État du cycle perf — fait / en suivi

**Fait** (branche `perf/optimization-cycle`) :
- Sidebar admin : états actifs + ouverture seedée des groupes.
- `loading.tsx` réalistes + module de skeletons partagé.
- `dynamic()` : FloatingChatFab, recharts (dashboard + analytics), TipTap
  (news-editor), carte bureaux (d3-geo).
- Accueil converti en Server Component (zéro fetch client).
- DB : `select`/`take` sur requêtes chaudes ; SQL d'index additifs
  (`prisma/perf-indexes.sql`, à exécuter).
- Docs : ce fichier + bloc AGENTS.md.

**En suivi** (non fait ce cycle, par priorité) :
1. **Phase 5 — page-builder** : sortir recharts + TipTap du bundle public
   (cf. §8). Plus gros gain restant.
2. Pages admin client-fetch → RSC : `admin/users`, `admin/news/stats`,
   `admin/news/[newsId]`, `admin/activity` (pattern `initial*` prop existant).
3. DB : drop `content` de la liste news admin (`ADMIN_LIST_FIELDS`), fix N+1
   autocomplete KBO (`lib/be-companies/kbo-lookup.ts`), cache memo sur
   `news/stats` + `lookup/stats`.
4. Exécuter `prisma/perf-indexes.sql` sur la base + vérifier les GIN `pg_trgm`
   du lookup ONEM.
5. (Optionnel) top-loader de navigation global (`useLinkStatus`) sur les liens.
