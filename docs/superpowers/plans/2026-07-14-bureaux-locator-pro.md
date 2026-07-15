# Localisateur pro (carte interactive + recherche commune) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Faire du finder `/outils/bureaux` un localisateur professionnel de services publics belges : carte SVG **interactive** (pan, zoom continu, pinch, clustering, gestion des pins superposés et non-localisés) + recherche **par nom de commune** (autocomplete), **sans nouvelle dépendance cartographique** (fond de tuiles = étape séparée différée, derrière `OfficeMap`).

**Architecture:** On garde la carte SVG (d3-geo/TopoJSON) et son isolation `OfficeMap`/`OfficeMapProps`. On ajoute deux modules **purs testés** (`map-clustering.ts`, `commune-search.ts`), une **API autocomplete** `/api/bureaux/communes`, on enrichit `custom-belgium-map.tsx` (interaction + clustering + non-localisés) et `address-search.tsx`+orchestrateur (autocomplete + feedback géoloc). Le résolveur serveur `resolve.ts` **ne change pas** (la sélection d'une commune fournit un CP représentatif → `?cp=`).

**Tech Stack:** Next 16 · React 19 · TS · Tailwind 4 sous `.glass-root` · next-intl · vitest · d3-geo/topojson (existant) · Prisma (Commune/PostalCode). **Aucune nouvelle dépendance.**

## Global Constraints
- **Aucune nouvelle dépendance** (surtout carto : pas de Leaflet/MapLibre/Mapbox/clé API — décision tranchée, RGPD + CLAUDE.md + consigne user). Le vrai fond de rues reste différé derrière `OfficeMap`.
- **Isolation `OfficeMap` conservée** : seul `office-map.tsx` importe `custom-belgium-map`.
- Rendu sous `.glass-root` : `glass-surface` / `var(--primary)`, jamais `bg-white`/`#fff` en dur. Vouvoiement partout.
- **Zéro donnée fictive** : jamais `undefined`/`null`/`NaN` ; bureaux sans lat/lng **affichés honnêtement** (centroïde commune, style « approx. ») + comptés, jamais placés faussement précis.
- Interactions tactiles **et** souris (pas de dépendance au survol seul) ; `prefers-reduced-motion` respecté ; a11y (clavier sur les contrôles, `aria`).
- Résolution existante préservée (cache/abort/debounce 150ms/`?cp=`/géoloc). `resolve.ts` inchangé.
- Workdir partagé : `git add` explicite ; `dangerouslyDisableSandbox:true` pour git/tests/build/tsc. Baseline `tsc --noEmit`=0, vitest vert.
- Validation par lot : `pnpm test` · `pnpm build` · `pnpm lint` (pas de NOUVELLE erreur) · `pnpm i18n:check`.

---

## Phase 0 — Logique pure (TDD)

### Task 1: `map-clustering.ts` — regroupement des pins superposés
**Files:** Create `lib/bureaus/map-clustering.ts` ; Test `lib/bureaus/__tests__/map-clustering.test.ts`.
**Produces:**
- `interface ClusterPoint { id: string; x: number; y: number }`
- `interface Cluster { x: number; y: number; ids: string[]; count: number }` (x,y = centroïde du groupe)
- `function clusterPoints(points: ClusterPoint[], radiusPx: number): Cluster[]` — greedy déterministe : trie par `id`, pour chaque point non encore pris, ouvre un cluster et absorbe tous les points dans `radiusPx` (distance euclidienne au point-graine) ; renvoie clusters (count 1 = singleton), x/y = moyenne des membres. `radiusPx <= 0` → tous singletons.

- [ ] **Step 1: tests (RED)**
```ts
import { describe, it, expect } from 'vitest'
import { clusterPoints, type ClusterPoint } from '../map-clustering'
const P = (id: string, x: number, y: number): ClusterPoint => ({ id, x, y })
describe('clusterPoints', () => {
  it('regroupe les points dans le rayon', () => {
    const c = clusterPoints([P('a', 0, 0), P('b', 3, 4), P('z', 200, 200)], 10)
    // a,b (dist 5 <=10) groupés ; z seul
    const grouped = c.find((cl) => cl.count === 2)
    expect(grouped?.ids.sort()).toEqual(['a', 'b'])
    expect(grouped?.x).toBeCloseTo(1.5); expect(grouped?.y).toBeCloseTo(2)
    expect(c.find((cl) => cl.ids.includes('z'))?.count).toBe(1)
  })
  it('rayon 0 → tous singletons', () => {
    expect(clusterPoints([P('a',0,0),P('b',0,0)], 0).every((c) => c.count === 1)).toBe(true)
  })
  it('vide → vide ; déterministe (indépendant de l’ordre d’entrée)', () => {
    expect(clusterPoints([], 10)).toEqual([])
    const a = clusterPoints([P('a',0,0),P('b',1,1),P('c',2,2)], 5)
    const b = clusterPoints([P('c',2,2),P('a',0,0),P('b',1,1)], 5)
    expect(a).toEqual(b)
  })
})
```
- [ ] **Step 2:** `pnpm test -- map-clustering` → RED.
- [ ] **Step 3: impl**
```ts
// lib/bureaus/map-clustering.ts
export interface ClusterPoint { id: string; x: number; y: number }
export interface Cluster { x: number; y: number; ids: string[]; count: number }

/** Regroupe les points proches (distance écran < radiusPx) en clusters
 * déterministes (tri par id). x/y = centroïde des membres. count 1 = singleton. */
export function clusterPoints(points: ClusterPoint[], radiusPx: number): Cluster[] {
  const sorted = [...points].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const taken = new Set<string>()
  const r2 = radiusPx * radiusPx
  const clusters: Cluster[] = []
  for (const seed of sorted) {
    if (taken.has(seed.id)) continue
    taken.add(seed.id)
    const members = [seed]
    if (radiusPx > 0) {
      for (const p of sorted) {
        if (taken.has(p.id)) continue
        const dx = p.x - seed.x, dy = p.y - seed.y
        if (dx * dx + dy * dy <= r2) { taken.add(p.id); members.push(p) }
      }
    }
    const n = members.length
    clusters.push({
      x: members.reduce((s, m) => s + m.x, 0) / n,
      y: members.reduce((s, m) => s + m.y, 0) / n,
      ids: members.map((m) => m.id),
      count: n,
    })
  }
  return clusters
}
```
- [ ] **Step 4:** `pnpm test -- map-clustering` → GREEN. `pnpm tsc --noEmit`=0.
- [ ] **Step 5: commit** `feat(bureaux): clusterPoints pur (regroupement pins superposés, testé)`.

### Task 2: `commune-search.ts` — normalisation + ranking (pur, TDD)
**Files:** Create `lib/bureaus/commune-search.ts` ; Test `lib/bureaus/__tests__/commune-search.test.ts`.
**Produces:**
- `function normalizeForSearch(s: string): string` — minuscule, sans accents (`normalize('NFD').replace(/\p{Diacritic}/gu,'')`), trim, espaces multiples → un.
- `interface CommuneLite { insCode: string; nameFr: string; nameNl?: string | null; cp: string }`
- `function rankCommuneMatches(query: string, communes: CommuneLite[], limit?: number): CommuneLite[]` — filtre : le query normalisé est inclus dans nameFr/nameNl normalisés ; classe préfixe-exact avant sous-chaîne, puis alpha ; `limit` (défaut 8).
- Tests : « schaer » matche « Schaerbeek » ; accents (« liege » → « Liège ») ; préfixe avant milieu ; limite respectée ; query vide → [].

- [ ] Steps TDD (RED→impl→GREEN→commit `feat(bureaux): commune-search pur (normalisation accents + ranking, testé)`). Chemins explicites.

---

## Phase 1 — API autocomplete

### Task 3: `/api/bureaux/communes` — suggestions de communes
**Files:** Create `app/api/bureaux/communes/route.ts`.
**Behaviour:** `GET ?q=` (min 2 car.). Requête Prisma `Commune` sur `nameFr`/`nameNl`/`nameDe` (contains, insensitive), prend le `PostalCode` représentatif (le plus petit code de la commune via la relation), renvoie `{ items: { insCode, nameFr, cp }[] }` (≤ 8, triés préfixe puis alpha via `rankCommuneMatches`). Gère q<2 → `{items:[]}`. `export const dynamic = 'force-dynamic'`. Pas de PII en query log. Réutilise `normalizeForSearch`/`rankCommuneMatches`.
- [ ] Impl → `tsc`/build → commit `feat(bureaux): API /api/bureaux/communes (autocomplete par nom, CP représentatif)`.

---

## Phase 2 — Carte interactive

### Task 4: pan + zoom continu + pinch (`custom-belgium-map.tsx`)
**Approche :** garder `fitExtent` comme **cadrage initial** de la commune. Ajouter un état `view = { tx, ty, scale }` (pan + zoom libres) appliqué via un **`<g transform="translate(tx,ty) scale(scale)">`** qui enveloppe polygones + pins. 
- **Pan** : `onPointerDown/Move/Up` sur le SVG (drag → maj `tx,ty`), `touch-action:none`, curseur grab.
- **Zoom continu** : `onWheel` (molette) zoome vers le curseur (ajuste tx,ty pour garder le point sous le curseur fixe), `scale` borné (ex. 0.5–8).
- **Pinch** : 2 pointeurs → ratio des distances → `scale` (pointer events, pas de lib).
- **Reset** : nouveau `selectedInsCode` → `view` remis à identité (le fitExtent recadre). Bouton « recentrer ».
- Les **3 boutons de cran** existants deviennent des raccourcis de `scale`/recentrage (garder l'UX).
- **Stroke non-scalant** déjà en place (`vectorEffect="non-scaling-stroke"`) → les contours restent fins quel que soit le zoom.
- `prefers-reduced-motion` : pas d'animation de zoom, application directe.
- [ ] Impl → `tsc`/eslint (2 pré-existants tolérés) → build → commit `feat(bureaux): carte — pan, zoom continu, pinch (SVG transform, sans dépendance)`.

### Task 5: clustering + bureaux non-localisés (`custom-belgium-map.tsx` + `office-map.tsx`)
- **Clustering** : après projection+transform, calculer les positions écran des pins, appeler `clusterPoints(points, RADIUS)` (RADIUS ~ 28px) au `scale` courant. Rendre : un cluster `count>1` = bulle ronde avec le nombre + halo ; clic → **zoom vers le cluster** (augmente `scale`, recentre) ce qui le dé-cluster ; singletons = `Dot` normal (avec numéro/recommandé). Recommandé n°1 **jamais absorbé** (toujours un pin visible).
- **Non-localisés** : `OfficeMap` passe aussi les marqueurs sans lat/lng ; la carte les place au **centroïde de la commune sélectionnée** avec un style distinct (anneau pointillé « approx. ») OU un petit encart « N bureaux sans adresse cartographiée » cliquable listant leurs numéros. Honnête : jamais présentés comme précis.
- `OfficeMap` : garder l'interface `OfficeMapProps` inchangée (les non-localisés y sont déjà, on cesse juste de les jeter).
- [ ] Impl → `tsc`/eslint → build → commit `feat(bureaux): carte — clustering des pins superposés + bureaux non-localisés (honnête)`.

---

## Phase 3 — Recherche par commune

### Task 6: autocomplete `AddressSearch` + feedback géoloc + câblage
**Files:** Modify `address-search.tsx`, `bureaux-finder.tsx`.
- `AddressSearch` : liste déroulante de suggestions (fetch `/api/bureaux/communes?q=` avec debounce + abort) sous le champ ; clavier (↑↓/Enter/Esc), `role="listbox"`/`option`, sélection → `onSelectCommune({insCode, nameFr, cp})`. Le CP à 4 chiffres tapé directement reste géré (résout sans suggestion). Props : `{ value, onChange, onSelectCommune, onUseLocation, locating, geolocError }`.
- Orchestrateur : `onSelectCommune` → `setAddressInput(cp)` (déclenche la résolution) + mémorise le nom pour l'`ActiveFilters`. **Feedback géoloc** : `handleUseLocation` pose un `geolocError` (message vouvoiement) sur refus/échec/HTTP non-HTTPS, passé à `AddressSearch`.
- [ ] Impl → `tsc`/eslint → build → commit `feat(bureaux): recherche par commune (autocomplete) + message d'erreur géoloc`.

---

## Phase 4 — i18n, validation, compte rendu

### Task 7: i18n + validation finale
- Clés `fr.json` : `communeSuggestLabel`, `geolocDenied`/`geolocUnavailable`/`geolocInsecure`, `mapUnlocatedTitle`, `mapClusterAria`, `mapRecenter`, `mapDragHint`, etc. (`i18n:check` vert).
- `pnpm test` (tous verts + nouveaux) · `pnpm build` (0) · `pnpm lint` (pas de nouvelle erreur) · `pnpm i18n:check`.
- Revue whole-branch (opus) + compte rendu honnête (ce qui est fait / le fond de tuiles différé).
- [ ] commit i18n (`fr.json` seul) + validation.

---

## Self-Review (couverture)
- Pan/drag → T4 · zoom continu → T4 · pinch → T4 · clustering/pins superposés → T1+T5 · non-localisés → T5 · recherche commune → T2+T3+T6 · feedback géoloc → T6 · isolation conservée → T5 (OfficeMap intact) · zéro dépendance → global · zéro donnée fictive → T5. 
- **Différé assumé (honnête)** : fond de rues (tuiles) = dépendance/RGPD non tranchée → reste un swap 1-fichier derrière `OfficeMap`.

## Execution
Subagent-driven, commits verts incrémentaux.
