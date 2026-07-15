# Finder bureaux V2 — démarche → recommandé → action — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development pour exécuter ce plan tâche par tâche. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Refondre `/outils/bureaux` d'une liste filtrée-par-type vers une expérience **orientée démarche → bureau recommandé → action** : sélecteur de démarche, carte « bureau recommandé » mise en avant (compétence territoriale), lignes de résultats compactes numérotées synchronisées avec des marqueurs numérotés sur la carte, trust bar, switcher Liste/Carte mobile.

**Architecture:** Le résolveur serveur (`/api/bureaux/resolve`, `lib/bureaus/resolve.ts`) **ne change pas**. On étend l'adaptateur pur (`lib/bureaus/finder-model.ts`) + on ajoute **deux modules purs testés** : `demarche-map.ts` (démarche → types d'organismes) et `office-ranking.ts` (`rankOffices`/`getRecommendedOffice`, déterministe). La carte SVG existante (`CustomBelgiumMap`) est **enrichie** (marqueurs numérotés + sync + popup) et **isolée derrière un composant `OfficeMap` avec une interface de données propre** (swap Mapbox/MapLibre plus tard sans refaire la page). Tout le reste = composants de présentation réutilisant la fondation (résolveur, géoloc, horaires, téléphone, signalement, verre mauve).

**Tech Stack:** Next 16 (App Router, `force-dynamic`) · React 19 (`'use client'`) · Tailwind 4 + shadcn sous `.glass-root` · next-intl 4 (`public.outils`) · vitest · d3-geo/topojson (carte existante, **aucune nouvelle dépendance**).

## Global Constraints

- **Aucune nouvelle dépendance** (carte = `CustomBelgiumMap` d3-geo ; pas de Mapbox/SDK/clé API — décision user : le fond « rues » du mockup est une inspiration, pas une demande d'intégration).
- **Carte isolée** derrière `OfficeMap` + interface `OfficeMapProps`/`OfficeMapMarker` — toute impl future (Mapbox/MapLibre) doit pouvoir la satisfaire sans toucher l'orchestrateur.
- **Rendu sous `.glass-root`** : surfaces via `glass-surface` / `lib/glass-classes.ts`, accent `var(--primary)`. **Jamais `bg-white`/`#FFFFFF` en dur.** Identité Docbel : fond lilas très léger, cartes claires, violet principal, vert = statut positif, coins arrondis, ombres discrètes. Pas de glassmorphism excessif ni gros dégradés derrière le texte.
- **Vouvoiement partout.** Tous les textes user-facing en français correct, via `public.outils` (fr.json, fallback FR). `t(dynamicKey)` (labels démarche/type) = cast `as (key: string) => string` (idiome repo, cf. `office-card.tsx`) ; clés littérales = `useTranslations` normal.
- **5 démarches uniquement** : Chômage et allocations, Aide sociale, Documents communaux, Recherche d'emploi, Je ne sais pas. **Pas** de Pension ni Mutuelle (données absentes — masquées jusqu'à câblage).
- **Zéro donnée fictive.** Jamais afficher `undefined`/`null`/`NaN`/icône sans texte/ligne vide/distance inventée. Valeurs absentes gérées (tél/horaires/site/lat-lng/distance/image manquants). **Pas de photo** de bureau (données sans champ photo) → carte recommandée sans image, mise en page adaptée.
- **Numérotation partagée** : la liste ordonnée (recommandé = 1, puis rang) et les marqueurs carte utilisent **le même numéro**.
- **Compétence territoriale** : les bureaux issus de `attitre.*` SONT compétents (BureauAssignment). Wording « Compétent pour votre adresse » autorisé pour eux ; sinon « Bureau correspondant à votre recherche ».
- **Ne pas casser l'existant** : résolution CP (cache 60 s / `AbortController` / debounce / `?cp=` sync), géoloc + reverse-geocode, itinéraire Google Maps, signalement `/api/reports`, statut ouvert/fermé (fériés), `force-dynamic`.
- **Perf** : ne pas recréer tous les marqueurs à chaque frappe (mémoïser) ; pas de re-render carte inutile ; clés de liste stables.
- **Validation** chaque lot : `pnpm test` · `pnpm build` (typecheck ; PAS `pnpm typecheck`) · `pnpm lint` (ne pas AJOUTER d'erreurs aux pré-existantes) · `pnpm i18n:check`. **Écran** : `/outils/bureaux` (route publique).
- **Workdir partagé multi-agents** : `git add` chemins EXPLICITES uniquement ; `dangerouslyDisableSandbox: true` sur Bash git/tests/build/tsc. Baseline `tsc --noEmit` = 0, vitest vert.

---

## File Structure

**Créés (pur, testé) :**
- `lib/bureaus/demarche-map.ts` — `Demarche`, `DEMARCHE_ORDER`, `DEMARCHE_META` (labelKey/icon/officeTypes), `demarcheToOfficeTypes()`.
- `lib/bureaus/__tests__/demarche-map.test.ts`
- `lib/bureaus/office-ranking.ts` — `RankedOffice` (OfficeItem + `number` + `isCompetent`), `rankOffices()`, `getRecommendedOffice()`.
- `lib/bureaus/__tests__/office-ranking.test.ts`

**Créés (présentation, `app/outils/bureaux/_components/`) :**
- `address-search.tsx` (CP + bouton « Utiliser ma position »)
- `demarche-selector.tsx` (5 démarches)
- `active-filters.tsx` (badges supprimables + « Effacer les filtres »)
- `recommended-office-card.tsx` (héros #1)
- `office-result-row.tsx` (ligne compacte numérotée)
- `office-results-list.tsx` (liste + « Voir plus de résultats »)
- `office-map.tsx` (**boundary d'isolation** + interface `OfficeMapProps`) + `office-map-types.ts` (interface pure)
- `office-map-popup.tsx` (infobulle au clic marqueur)
- `trust-bar.tsx` (barre horizontale)
- `mobile-view-switcher.tsx` (Liste/Carte)
- `finder-states.tsx` (`EmptyState`, `ErrorState`, `SkeletonResults`)

**Modifiés :**
- `lib/bureaus/finder-model.ts` — ajoute `isCompetent` à la construction (tous les items `attitre` = compétents) ; garde `buildOffices`/`filterOffices`/`estimateTravel`.
- `app/outils/bureaux/_components/custom-belgium-map.tsx` — marqueurs **numérotés**, recommandé plus grand, highlight sélection, `onHover`/`onSelect`, popup au clic ; fond plus discret ; zoom conservé. (Reste derrière `OfficeMap`.)
- `app/outils/bureaux/_components/office-detail.tsx` — retire le favori ; sert de **fiche** ouverte par « Voir le bureau ».
- `app/outils/bureaux/bureaux-finder.tsx` — **réécriture** orchestrateur (recherche/démarche/filtres/ranking/liste↔carte/états/mobile switcher).
- `messages/fr.json` — nouvelles clés `public.outils`.

**Supprimés (après vérif non-référencés) :**
- `use-favorites.ts`, `type-filter-chips.tsx`, `mobile-sheet.tsx`, `office-card.tsx`, `office-list.tsx`, `finder-map.tsx` (remplacés). `info-bands.tsx` → remplacé par `trust-bar.tsx` (vérifier).

---

## Décisions verrouillées (validées avec Oraliks)

1. **Carte** = SVG existant enrichi + isolé derrière `OfficeMap`/interface propre. Pas de Mapbox/dépendance. Vrai fond de carte = 2ᵉ étape séparée ultérieure.
2. **Démarches** = 5 câblées. Pension/Mutuelle masquées.
3. **Recommandé** = fonction de ranking déterministe (compétence → démarche → ouverture → distance), pas « le plus proche ».
4. **Favoris/étoile** = supprimés (uniquement utilisés ici). **Appeler** retiré de la liste (→ fiche).
5. **Photo** bureau = aucune donnée → carte recommandée sans image.
6. **Mobile** = switcher Liste/Carte (défaut Liste), pas de bottom-sheet glissante.

---

## Phase 0 — Logique pure (TDD)

### Task 1: `demarche-map.ts` — démarche → types d'organismes

**Files:**
- Create: `lib/bureaus/demarche-map.ts`
- Test: `lib/bureaus/__tests__/demarche-map.test.ts`

**Interfaces:**
- Consumes: `OfficeType` from `./finder-model`.
- Produces:
  - `type Demarche = 'chomage' | 'aide_sociale' | 'documents_communaux' | 'emploi' | 'inconnu'`
  - `const DEMARCHE_ORDER: Demarche[]`
  - `const DEMARCHE_META: Record<Demarche, { labelKey: string; icon: string; officeTypes: OfficeType[] | 'all' }>`
  - `function demarcheToOfficeTypes(d: Demarche): OfficeType[] | 'all'`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// lib/bureaus/__tests__/demarche-map.test.ts
import { describe, it, expect } from 'vitest'
import { DEMARCHE_ORDER, DEMARCHE_META, demarcheToOfficeTypes, type Demarche } from '../demarche-map'
import { TYPE_ORDER, type OfficeType } from '../finder-model'

describe('DEMARCHE_META', () => {
  it('couvre exactement DEMARCHE_ORDER, avec labelKey/icon/officeTypes', () => {
    expect(new Set(Object.keys(DEMARCHE_META))).toEqual(new Set(DEMARCHE_ORDER))
    for (const d of DEMARCHE_ORDER) {
      expect(DEMARCHE_META[d].labelKey).toBeTruthy()
      expect(DEMARCHE_META[d].icon).toBeTruthy()
    }
  })
  it('n’expose PAS pension ni mutuelle comme démarche', () => {
    expect(DEMARCHE_ORDER).not.toContain('pension' as Demarche)
    expect(DEMARCHE_ORDER).not.toContain('mutuelle' as Demarche)
  })
  it('ne référence que des OfficeType connus (ou "all")', () => {
    const known = new Set<OfficeType>(TYPE_ORDER)
    for (const d of DEMARCHE_ORDER) {
      const t = DEMARCHE_META[d].officeTypes
      if (t !== 'all') for (const ot of t) expect(known.has(ot)).toBe(true)
    }
  })
})

describe('demarcheToOfficeTypes', () => {
  it('chomage → ONEM + PAIEMENT', () => {
    expect(demarcheToOfficeTypes('chomage')).toEqual(expect.arrayContaining(['ONEM', 'PAIEMENT']))
  })
  it('aide_sociale → CPAS ; documents_communaux → COMMUNE ; emploi → SRE', () => {
    expect(demarcheToOfficeTypes('aide_sociale')).toEqual(['CPAS'])
    expect(demarcheToOfficeTypes('documents_communaux')).toEqual(['COMMUNE'])
    expect(demarcheToOfficeTypes('emploi')).toEqual(['SRE'])
  })
  it('inconnu → "all"', () => {
    expect(demarcheToOfficeTypes('inconnu')).toBe('all')
  })
})
```

- [ ] **Step 2: Lancer → échec** — Run: `pnpm test -- demarche-map` — Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

```ts
// lib/bureaus/demarche-map.ts
import type { OfficeType } from './finder-model'

/** Démarches câblées (Pension/Mutuelle exclues faute de données — cf. plan). */
export type Demarche = 'chomage' | 'aide_sociale' | 'documents_communaux' | 'emploi' | 'inconnu'

export const DEMARCHE_ORDER: Demarche[] = [
  'chomage', 'aide_sociale', 'documents_communaux', 'emploi', 'inconnu',
]

/** Correspondance démarche → familles d'organismes + présentation.
 * `officeTypes: 'all'` = ne filtre pas (choix « Je ne sais pas »). */
export const DEMARCHE_META: Record<Demarche, { labelKey: string; icon: string; officeTypes: OfficeType[] | 'all' }> = {
  chomage:            { labelKey: 'demarcheChomage',   icon: 'Landmark',      officeTypes: ['ONEM', 'PAIEMENT'] },
  aide_sociale:       { labelKey: 'demarcheAideSociale', icon: 'HeartHandshake', officeTypes: ['CPAS'] },
  documents_communaux:{ labelKey: 'demarcheDocuments', icon: 'Building2',     officeTypes: ['COMMUNE'] },
  emploi:             { labelKey: 'demarcheEmploi',    icon: 'Briefcase',     officeTypes: ['SRE'] },
  inconnu:            { labelKey: 'demarcheInconnu',   icon: 'HelpCircle',    officeTypes: 'all' },
}

export function demarcheToOfficeTypes(d: Demarche): OfficeType[] | 'all' {
  return DEMARCHE_META[d].officeTypes
}
```

- [ ] **Step 4: Lancer → succès** — Run: `pnpm test -- demarche-map` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add lib/bureaus/demarche-map.ts lib/bureaus/__tests__/demarche-map.test.ts` ; `git commit -m "feat(bureaux): mapping démarche→organismes (pur, testé, 5 démarches câblées)"`

### Task 2: `office-ranking.ts` — recommandé déterministe + numérotation

**Files:**
- Create: `lib/bureaus/office-ranking.ts`
- Test: `lib/bureaus/__tests__/office-ranking.test.ts`
- Modify: `lib/bureaus/finder-model.ts` (ajouter `isCompetent: boolean` sur `OfficeItem`, `true` pour tous les items issus de `attitre`)

**Interfaces:**
- Consumes: `OfficeItem` (+ nouveau `isCompetent`), `OfficeType`, `computeOpenStatus` (`./types`), `demarcheToOfficeTypes`, `Demarche`.
- Produces:
  - `interface RankedOffice extends OfficeItem { number: number; isCompetent: boolean; isRecommended: boolean }`
  - `function rankOffices(items: OfficeItem[], opts: { demarche: Demarche; at?: Date }): RankedOffice[]` — filtre par démarche (sauf `inconnu`), trie par (1) compétence, (2) statut ouvert, (3) distance croissante (nulls après), (4) `TYPE_ORDER` ; assigne `number = index+1`, `isRecommended = index===0`.
  - `function getRecommendedOffice(ranked: RankedOffice[]): RankedOffice | null`

- [ ] **Step 1: Ajouter `isCompetent` à `OfficeItem`** dans `finder-model.ts` : `interface OfficeItem { …; isCompetent: boolean }` et dans `buildOffices` mettre `isCompetent: true` (tous les items proviennent de `attitre`). Vérifier que les tests existants de `finder-model` compilent (ils construisent des OfficeItem via buildOffices → OK ; s'ils construisent des littéraux, ajouter `isCompetent`).

- [ ] **Step 2: Écrire les tests**

```ts
// lib/bureaus/__tests__/office-ranking.test.ts
import { describe, it, expect } from 'vitest'
import { rankOffices, getRecommendedOffice } from '../office-ranking'
import type { OfficeItem, OfficeType } from '../finder-model'
import type { BureauResult } from '@/app/outils/bureaux/_components/types'

function mkItem(id: string, type: OfficeType, over: Partial<BureauResult> = {}, distanceKm: number | null = null): OfficeItem {
  const bureau: BureauResult = {
    id, type, name: id, street: 'R', streetNum: '1', postalCode: '1000', city: 'Bxl',
    phone: null, email: null, website: null, appointmentUrl: null, hours: [], hoursNotes: null,
    lat: null, lng: null, organismeCode: null, organismeName: null, organismeColor: null, ...over,
  }
  return { id, type, bureau, distanceKm, isCompetent: true }
}

describe('rankOffices', () => {
  it('filtre par démarche (chomage → ONEM/PAIEMENT), exclut les autres', () => {
    const items = [mkItem('onem', 'ONEM'), mkItem('cpas', 'CPAS'), mkItem('capac', 'PAIEMENT')]
    const r = rankOffices(items, { demarche: 'chomage' })
    expect(r.map((x) => x.id).sort()).toEqual(['capac', 'onem'])
  })
  it('inconnu → garde tout', () => {
    const items = [mkItem('onem', 'ONEM'), mkItem('cpas', 'CPAS')]
    expect(rankOffices(items, { demarche: 'inconnu' })).toHaveLength(2)
  })
  it('numérote 1..N et marque isRecommended sur le premier', () => {
    const items = [mkItem('a', 'CPAS', {}, 5), mkItem('b', 'CPAS', {}, 1)]
    const r = rankOffices(items, { demarche: 'aide_sociale' })
    expect(r[0].number).toBe(1)
    expect(r[0].isRecommended).toBe(true)
    expect(r[0].id).toBe('b') // plus proche d'abord (à compétence/ouverture égales)
    expect(r[1].number).toBe(2)
    expect(r[1].isRecommended).toBe(false)
  })
  it('recommandé = premier', () => {
    const r = rankOffices([mkItem('a', 'CPAS', {}, 3)], { demarche: 'inconnu' })
    expect(getRecommendedOffice(r)?.id).toBe('a')
  })
  it('liste vide → recommandé null', () => {
    expect(getRecommendedOffice([])).toBeNull()
  })
})
```

- [ ] **Step 3: Implémenter `office-ranking.ts`**

```ts
// lib/bureaus/office-ranking.ts
import { computeOpenStatus } from './types'
import { TYPE_ORDER, type OfficeItem } from './finder-model'
import { demarcheToOfficeTypes, type Demarche } from './demarche-map'

export interface RankedOffice extends OfficeItem {
  number: number
  isRecommended: boolean
}

/** Classe les bureaux pour une démarche. Priorité (déterministe) :
 *  1. compétence territoriale (isCompetent)
 *  2. statut d'ouverture (ouvert avant fermé)
 *  3. distance croissante (coords absentes après)
 *  4. ordre de type stable (TYPE_ORDER)
 * Puis numérote 1..N ; le rang 1 est le bureau recommandé. */
export function rankOffices(items: OfficeItem[], opts: { demarche: Demarche; at?: Date }): RankedOffice[] {
  const allowed = demarcheToOfficeTypes(opts.demarche)
  const filtered = allowed === 'all' ? items : items.filter((i) => (allowed as string[]).includes(i.type))
  const isOpen = (i: OfficeItem) => computeOpenStatus(i.bureau.hours, opts.at).state === 'open'
  const typeIdx = (i: OfficeItem) => TYPE_ORDER.indexOf(i.type)

  const sorted = [...filtered].sort((a, b) => {
    if (a.isCompetent !== b.isCompetent) return a.isCompetent ? -1 : 1
    const ao = isOpen(a), bo = isOpen(b)
    if (ao !== bo) return ao ? -1 : 1
    if (a.distanceKm != null && b.distanceKm != null && a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm
    if (a.distanceKm != null && b.distanceKm == null) return -1
    if (a.distanceKm == null && b.distanceKm != null) return 1
    return typeIdx(a) - typeIdx(b)
  })

  return sorted.map((item, idx) => ({ ...item, number: idx + 1, isRecommended: idx === 0 }))
}

export function getRecommendedOffice(ranked: RankedOffice[]): RankedOffice | null {
  return ranked[0] ?? null
}
```

- [ ] **Step 4: Lancer tests** — Run: `pnpm test -- office-ranking finder-model` — Expected: PASS (dont les tests finder-model existants avec `isCompetent`).
- [ ] **Step 5: Commit** — chemins explicites (`office-ranking.ts`, son test, `finder-model.ts`) ; `git commit -m "feat(bureaux): rankOffices/getRecommendedOffice déterministe + numérotation + isCompetent"`

---

## Phase 1 — Recherche, démarche, filtres

### Task 3: `address-search.tsx`
**Files:** Create `app/outils/bureaux/_components/address-search.tsx`.
**Produces:** `AddressSearch({ value, onChange, onUseLocation, locating })` — label « Adresse », champ « Code postal, commune ou adresse » (`inputMode` texte ; la résolution CP reste 4 chiffres côté orchestrateur), bouton secondaire **pleine largeur** « Utiliser ma position » (un seul bouton, pas de croix séparée). Réutilise la logique géoloc de `geoloc-banner.tsx` (`getCurrentPosition` + `reverseGeocodeBE`) — extraire l'appel dans l'orchestrateur, ce composant est présentational + callback. Glass surfaces, label associé (`htmlFor`), focus visible.
- Étapes : écrire le composant → `tsc`/`eslint` clean → commit `feat(bureaux): AddressSearch (adresse + Utiliser ma position)`.

### Task 4: `demarche-selector.tsx`
**Files:** Create `app/outils/bureaux/_components/demarche-selector.tsx`.
**Produces:** `DemarcheSelector({ value, onChange })` où `value: Demarche | null`. Titre « Que souhaitez-vous faire ? ». 5 boutons/cartes compactes (`DEMARCHE_ORDER` + `DEMARCHE_META`, icône via `TypeIcon`-like dispatcher — étendre `type-icon.tsx` ou nouveau `demarche-icon.tsx` avec `HelpCircle`). État sélectionné très visible (fond `var(--primary)`, texte blanc, icône) ; non-sélectionnés = glass + bordure légère. Vrais `<button>`, `aria-pressed`. `t` cast pour `labelKey` dynamique. Responsive grid (desktop à droite du champ / mobile dessous).
- Étapes : composant → `tsc`/`eslint` → commit `feat(bureaux): DemarcheSelector (5 démarches, état sélectionné violet)`.

### Task 5: `active-filters.tsx`
**Files:** Create `app/outils/bureaux/_components/active-filters.tsx`.
**Produces:** `ActiveFilters({ filters, onRemove, onClear })` où `filters: {key:string;label:string}[]`. Ligne « Filtres actifs » + badges supprimables (croix, `aria-label` « Retirer … ») + « Effacer les filtres ». **Ne rien rendre si `filters` vide** (`return null`). Filtres possibles : commune/CP, démarche, « Ouvert maintenant ».
- Étapes : composant → `tsc`/`eslint` → commit `feat(bureaux): ActiveFilters (badges supprimables)`.

---

## Phase 2 — Résultats

### Task 6: `recommended-office-card.tsx`
**Files:** Create `app/outils/bureaux/_components/recommended-office-card.tsx`.
**Consumes:** `RankedOffice`, `TYPE_META`, `estimateTravel`, `computeOpenStatus`, `TypeIcon`.
**Produces:** `RecommendedOfficeCard({ office, onView, onItinerary })`. Grande carte (glass), badge n°**1**, badge « Compétent pour votre adresse » (si `office.isCompetent`) sinon « Bureau correspondant à votre recherche », eyebrow type (`t(TYPE_META[type].labelKey)`), nom complet (non tronqué), adresse complète, ligne « {distance} · {temps} à pied · {statut} » (chaque segment **omis si absent** — jamais NaN/undefined), info secondaire RDV si `appointmentUrl`. **Pas d'image** (données sans photo). Actions : primaire « Voir le bureau » (`onView`), secondaire « Itinéraire » (`onItinerary`, Google Maps). **Pas** d'Appeler, **pas** d'étoile. Statut ouvert = vert + texte (pas couleur seule → inclure « Ouvert »/« Fermé »).
- Étapes : composant → `tsc`/`eslint` → commit `feat(bureaux): RecommendedOfficeCard (héros n°1, sans photo, compétence data-backed)`.

### Task 7: `office-result-row.tsx` + `office-results-list.tsx`
**Files:** Create both.
**Produces:**
- `OfficeResultRow({ office, selected, onView, onHover })` — ligne compacte : numéro, badge type, nom complet (non tronqué desktop ; `truncate` mobile via `sm:`), adresse, « {distance} · {temps} », statut si dispo, bouton « Voir le bureau ». `onMouseEnter/Leave` → `onHover(id|null)` (sync carte) ; highlight si `selected`. Vrais boutons.
- `OfficeResultsList({ offices, selectedId, onView, onHover, initialCount=4 })` — titre « Autres bureaux pouvant vous aider », rend les rows (hors recommandé), limite à `initialCount`, bouton « Voir plus de résultats » (état local `expanded`) qui révèle le reste. `key={office.id}` stable.
- Étapes : composants → `tsc`/`eslint` → commit `feat(bureaux): OfficeResultRow + OfficeResultsList (numérotés, voir plus, sync hover)`.

---

## Phase 3 — Carte enrichie + isolée

### Task 8: `custom-belgium-map.tsx` — marqueurs numérotés + sync + popup
**Files:** Modify `app/outils/bureaux/_components/custom-belgium-map.tsx`.
**Changes (chirurgical, rétro-compat via props optionnelles) :**
- Le composant reçoit désormais (depuis `OfficeMap`) des marqueurs enrichis : `{ id; lat; lng; color; number; recommended; }`. Rendre un **pin numéroté** (numéro affiché dans le pin), recommandé (`number===1`) plus grand + style distinct. **Highlight** du pin `selectedId` (l'indicateur universel dark-halo+anneau-blanc déjà en place). `onPinHover?(id|null)` + `onPinClick?(id)`. Popup gérée par le parent (`OfficeMap`), la map remonte l'événement.
- **Fond plus discret** : polygone commune en remplissage très léger (ne concurrence pas les pins). Garder zoom +/−, recentrage.
- Mémoïser la projection des marqueurs (ne pas reprojeter tous à chaque frappe — `useMemo` sur `[bureaus, size, level]`).
- Ne pas casser le label commune (garde anti-NaN déjà posée).
- Étapes : modifier → `tsc`/`eslint` (les 2 lint pré-existants tolérés) → commit `feat(bureaux): carte — marqueurs numérotés, recommandé n°1, hover/click, fond discret`.

### Task 9: `office-map.tsx` (boundary) + `office-map-types.ts` + `office-map-popup.tsx`
**Files:** Create the three.
**Produces (interface d'isolation — CLÉ) :**
```ts
// office-map-types.ts
export interface OfficeMapMarker {
  id: string; number: number; recommended: boolean
  lat: number | null; lng: number | null
  color: string; label: string; typeLabel: string
  address: string; statusLabel: string | null; distanceLabel: string | null
}
export interface OfficeMapProps {
  markers: OfficeMapMarker[]
  center: { lat: number; lng: number } | null
  selectedInsCode: string | null
  selectedId: string | null
  zoneLabel: string; resultCount: number
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  onView: (id: string) => void  // depuis la popup
}
```
- `OfficeMap(props: OfficeMapProps)` = **seul point de couplage carto**. En-tête intégré (zone + « {n} résultats » + légende « 1 = bureau recommandé »). Rend `CustomBelgiumMap` (filtrant les markers sans lat/lng, en notant « n bureaux sans localisation précise » si applicable — pas de faux placement). Rend `OfficeMapPopup` pour `selectedId` (nom, type, adresse, statut, distance, « Voir le bureau » → `onView`). Toute future impl (Mapbox) réimplémente `OfficeMap` sans toucher l'orchestrateur.
- `OfficeMapPopup({ marker, onView, onClose })`.
- Étapes : composants → `tsc`/`eslint` → commit `feat(bureaux): OfficeMap (boundary + interface propre) + popup + en-tête/légende`.

---

## Phase 4 — Chrome, états, mobile, orchestrateur

### Task 10: `trust-bar.tsx` + `finder-states.tsx`
**Files:** Create both.
**Produces:**
- `TrustBar()` — barre **horizontale** : 4 items (Données officielles / Compétence territoriale vérifiée / Mises à jour régulières / Signaler une erreur) séparés par fines bordures verticales (desktop) ; 2 colonnes (mobile). Icône + titre + sous-texte. « Signaler une erreur » ouvre le `ReportForm` existant (ou lien). Remplace `InfoBands`.
- `finder-states.tsx` : `EmptyState({ title, body, actions })`, `ErrorState({ message, onRetry })`, `SkeletonResults()` (réutiliser `search-loader.tsx` si adapté). États : initial / chargement / aucun résultat / erreur / géoloc refusée / CP inconnu / aucun organisme pour la démarche / distances indispo. Jamais de carte vide sans explication.
- Étapes : composants → `tsc`/`eslint`/`i18n` → commit `feat(bureaux): TrustBar horizontale + états (vide/erreur/skeleton)`.

### Task 11: `mobile-view-switcher.tsx`
**Files:** Create.
**Produces:** `MobileViewSwitcher({ view, onChange, resultCount })` — deux segments « Liste {n} » / « Carte », défaut Liste, `aria`/rôle tablist, cible tactile ≥44px. `view: 'liste' | 'carte'`. (L'orchestrateur monte liste OU carte selon `view` en `<lg`.)
- Étapes : composant → `tsc`/`eslint` → commit `feat(bureaux): MobileViewSwitcher (Liste/Carte, défaut Liste)`.

### Task 12: Réécriture orchestrateur `bureaux-finder.tsx`
**Files:** Modify (réécriture) `app/outils/bureaux/bureaux-finder.tsx` ; Modify `office-detail.tsx` (retirer favori, servir de fiche).
**Consumes:** tout ce qui précède + résolution conservée (cache/abort/debounce/`?cp=`/géoloc).
**État :** `cp`, `demarche: Demarche` (défaut `'inconnu'` = « Je ne sais pas »), `openNow: boolean` (filtre « Ouvert maintenant » optionnel), `userGeoloc`, `data`, `hoveredId`, `selectedId` (fiche), `mobileView`. Dérivés : `allItems = buildOffices(data, ref)` → `ranked = rankOffices(filtered, {demarche})` (filtre openNow appliqué avant/après selon UX) → `recommended = ranked[0]`, `others = ranked.slice(1)`. `markers` mémoïsés depuis `ranked` (numéros partagés). `activeFilters` = commune + démarche + openNow.
**Layout desktop :** 2 colonnes `~48% / ~52%` (`lg:grid-cols-[minmax(0,7fr)_8fr]` ou flex). Gauche : `AddressSearch` + `DemarcheSelector` + `ActiveFilters` + `RecommendedOfficeCard` + `OfficeResultsList`. Droite : `OfficeMap` (sticky/hauteur). Bas : `TrustBar`.
**Sync :** hover row → `hoveredId` → marker highlight ; hover/click marker → `onHover`/`onSelect` → row highlight / ouvre fiche. Clic « Voir le bureau » (row/recommandé/popup) → `selectedId` → `OfficeDetail` (fiche). Numéros liste == marqueurs.
**Mobile (`<lg`) :** `MobileViewSwitcher` ; vue Liste = recherche+démarche+filtres+recommandé+résultats ; vue Carte = `OfficeMap` grande hauteur + mini-récap du bureau sélectionné en bas. Pas de setState synchrone dans un effect (garder le pattern dérivé).
- Étapes : réécrire → `tsc`/`eslint`/`build` → commit `feat(bureaux): orchestrateur V2 (démarche→recommandé→action, sync liste/carte, mobile switcher)`.

---

## Phase 5 — i18n, nettoyage, QA

### Task 13: Clés i18n `fr.json`
**Files:** Modify `messages/fr.json` UNIQUEMENT (insertion chirurgicale dans `public.outils`, CRLF/dupes → ne pas réécrire). Clés (exemples) : `bureauxSubtitle` (nouveau sous-titre), `demarcheTitle` « Que souhaitez-vous faire ? », `demarcheChomage/AideSociale/Documents/Emploi/Inconnu`, `bureauxAddressLabel`, `bureauxAddressPlaceholder`, `bureauxUseLocation`, `activeFiltersLabel`, `clearFilters`, `openNowFilter`, `recommendedCompetent` « Compétent pour votre adresse », `recommendedNeutral` « Bureau correspondant à votre recherche », `viewOffice` « Voir le bureau », `otherOfficesTitle` « Autres bureaux pouvant vous aider », `seeMoreResults`, `mapRecommendedLegend` « 1 = bureau recommandé », `mapResultCount` (ICU plural), `trustOfficial*`/`trustTerritorial*`/`trustUpdates*`/`trustReport*`, `viewList`/`viewMap`, `emptyTitle`/`emptyBody`, `errorRetry`, etc. `close`/`bureauxClose` déjà présents.
- Run `pnpm i18n:check` → SUCCÈS. Commit `messages/fr.json` seul : `i18n(bureaux): clés fr du finder V2 (démarches, recommandé, trust bar, états)`.

### Task 14: Nettoyage + validation finale
**Files:** Supprimer (après `grep` repo-wide) `use-favorites.ts`, `type-filter-chips.tsx`, `mobile-sheet.tsx`, `office-card.tsx`, `office-list.tsx`, `finder-map.tsx`, `info-bands.tsx` (si remplacé). Retirer imports morts. 
- Vérifs : `pnpm test` (tous verts + nouveaux), `pnpm build` (exit 0), `pnpm lint` (pas de NOUVELLE erreur), `pnpm i18n:check`.
- Commit `chore(bureaux): retire composants V1 remplacés + validation finale`.
- Revue whole-branch (opus) + finishing-a-development-branch.

---

## Self-Review (couverture spec ↔ plan)

- Objectif produit (démarche→compétent→recommandé→next) → Tasks 1,2,4,6. ✅
- Recommandé identifiable + ranking déterministe testable → Task 2, 6. ✅
- Recherche CP conservée + adresse/commune préparé + géoloc simplifiée → Task 3, 12. ✅
- Démarches = vrais filtres, 5 câblées, mapping propre → Task 1, 4, 12. ✅
- Filtres actifs supprimables → Task 5. ✅
- Autres bureaux compacts numérotés + voir plus, noms non tronqués → Task 7. ✅
- Carte existante enrichie + isolée + numéros partagés + sync + popup + fond discret → Task 8, 9. ✅
- États (vide/chargement/erreur/géoloc/CP inconnu/démarche vide/distance absente) → Task 10, 12. ✅
- Trust bar horizontale → Task 10. ✅
- Mobile Liste/Carte défaut Liste → Task 11, 12. ✅
- A11y (labels/clavier/focus/boutons/contraste/statut-pas-que-couleur/aria icônes/reduced-motion/tactile) → transverse, vérif Task 12/14. ✅
- Réutilisation (résolveur/géoloc/horaires/tél/signalement/verre) — pas de données fictives → global. ✅
- Nettoyage + tsc/lint/tests/build → Task 14. ✅

**Data gaps assumés (notés)** : Pension/Mutuelle masquées ; pas de photo bureau ; marqueurs des bureaux sans lat/lng non placés (mention honnête). Vrai fond de carte = étape 2 séparée.

---

## Execution Handoff

Subagent-Driven (comme la refonte V1) : un implémenteur frais par tâche + revue par tâche + revue whole-branch finale.
