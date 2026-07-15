# Refonte du finder de bureaux (« Trouver un bureau ») — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent la syntaxe checkbox (`- [ ]`).

**Goal:** Refondre l'écran public `/outils/bureaux` selon le design Claude Design approuvé (liste + carte + fiche détail, filtres par type, mobile « carte d'abord » avec bottom-sheet glissante), sans régresser la richesse fonctionnelle actuelle (horaires, téléphone masqué, signalement, distances, géoloc).

**Architecture:** On **ne touche pas** au résolveur serveur (`/api/bureaux/resolve` + `lib/bureaus/resolve.ts`) : il reste la source de vérité. On ajoute un **adaptateur pur** qui aplatit sa réponse en une liste typée `OfficeItem[]` (ONEM, CPAS, Commune, SRE, Paiement, Mutuelle). Toute la refonte est **front-only** : nouvel orchestrateur + composants de présentation (carte réutilisée `CustomBelgiumMap`, liste, puces de filtre, fiche détail, sheet mobile). Les fonctionnalités riches existantes (`HoursTimeline`, `PhoneReveal`, `report-form`, géoloc) sont **réutilisées** dans la fiche détail.

**Tech Stack:** Next 16 (App Router, `force-dynamic`) · React 19 (`'use client'`) · Tailwind 4 + shadcn sous `.glass-root` · next-intl 4 (`public.outils`) · vitest · d3-geo/topojson (carte existante, aucune nouvelle dépendance).

## Global Constraints

- **Aucune nouvelle dépendance** (carte = `CustomBelgiumMap` existante ; sheet glissante = pointer events maison, code fourni ci-dessous). Interdiction projet.
- **Jamais `bg-white` / `#FFFFFF` en dur sur le front** (règle absolue CLAUDE.md). Le mockup est blanc parce qu'il est autonome ; ici tout rend **sous `.glass-root`** → surfaces via `.glass-surface` / helpers `lib/glass-classes.ts`, accent via `var(--primary)`. On reproduit la **mise en page et les interactions** du mockup, **pas** ses `#fff`.
- **Accent** : `var(--primary)` (≈ `#5B46E5`), pas le `#6d5ce7` du mockup en dur.
- **Couleurs par type** (pins/puces) : un unique registre contrôlé `TYPE_META` (catégorielles, esprit `--chart-*`), centralisé — **pas** de couleurs éparpillées en dur dans les composants.
- **Max 3–5 fichiers par lot** ; commits fréquents ; ne pas marquer « fait » ce qui est planifié.
- **Périmètre organismes V1** : ONEM, CPAS, Commune, SRE (emploi régional), Org. de paiement (1 item par OP : CAPAC/FGTB/CSC/SYNOVA), **Mutuelle/santé**. **PAS** de Pensions ni Aide juridique (registre laissé extensible).
- **Ne pas régresser** : `force-dynamic` sur la page, cache 60 s de l'API, `AbortController` anti-race, debounce, sync `?cp=` dans l'URL, géoloc + reverse-geocode Nominatim, signalement `/api/reports` type `bureau`, révélation téléphone anti-scraping, statut ouvert/fermé (fériés belges), distances marche/voiture, `appointmentUrl`.
- **Validation** à chaque lot : `pnpm test` · `pnpm build` (typecheck inclus, PAS de `pnpm typecheck`) · `pnpm lint` (ne pas AJOUTER d'erreurs aux ~74 pré-existantes) · `pnpm i18n:check`. **Écran** : `/outils/bureaux` (route publique, pas d'auth → preview OK ; `preview_screenshot` timeout dans cet env → valider via `preview_snapshot`/`preview_inspect`).

---

## File Structure

**Créés :**
- `lib/bureaus/finder-model.ts` — cœur pur : type `OfficeItem`, `OfficeType`, registre `TYPE_META` (label i18n-key/couleur/icône), `flattenResolveToOffices`, `buildOffices` (distance + tri proximité), `filterOffices`, `estimateTravel`.
- `lib/bureaus/__tests__/finder-model.test.ts` — tests unitaires du modèle.
- `app/outils/bureaux/_components/office-card.tsx` — carte compacte de liste (icône type, badge statut, nom, adresse, distance, 2 actions). Remplace `bureau-card.tsx` dans la liste.
- `app/outils/bureaux/_components/office-list.tsx` — liste scrollable + en-tête count/tri (partagée PC sidebar + sheet mobile).
- `app/outils/bureaux/_components/type-filter-chips.tsx` — rangée de puces de filtre par type.
- `app/outils/bureaux/_components/office-detail.tsx` — fiche détail riche (statut+horaires `HoursTimeline`, adresse, téléphone `PhoneReveal`, site, `appointmentUrl`, itinéraire, favori, signalement). Rendue **inline** (PC, par-dessus la sidebar) et en **sheet** (mobile).
- `app/outils/bureaux/_components/finder-map.tsx` — wrapper autour de `CustomBelgiumMap` : remplit le panneau, reçoit `OfficeItem[]`, synchronise `selectedId`/hover.
- `app/outils/bureaux/_components/mobile-sheet.tsx` — bottom-sheet glissante à 3 crans (peek/half/full), pointer events maison.
- `app/outils/bureaux/_components/use-favorites.ts` — hook favoris localStorage (cuttable).

**Modifiés :**
- `app/outils/bureaux/bureaux-finder.tsx` — orchestrateur réécrit (résolution inchangée + adaptateur + état filtres/sélection/favoris/sheet ; layouts PC & mobile).
- `app/outils/bureaux/_components/types.ts` — ajoute `mutuelle` à `ResolveResponse.attitre` (déjà résolu serveur, aujourd'hui strippé).
- `app/outils/bureaux/_components/commune-panel.tsx` — importe `TYPE_META` depuis `finder-model` (dédup du `TYPE_COLOR` local) ; accepte `selectedId`/`onSelect`.
- `app/outils/bureaux/_components/custom-belgium-map.tsx` — expose `selectedId`/`onPinClick` (halo/scale sur pin sélectionné). Modif chirurgicale, non destructive.
- `messages/fr.json`, `messages/nl.json`, `messages/de.json`, `messages/en.json`, `messages/pt.json` — nouvelles clés `public.outils` (labels types, statut, count, tri, favoris, sheet, retour). FR = référence, autres = fallback FR si non traduit.

**Retirés de l'écran (mais fichiers conservés) :**
- `_components/bureau-card.tsx`, `_components/op-tabs-card.tsx` : plus montés par l'orchestrateur (chaque OP devient un `OfficeItem` de type PAIEMENT). Ne pas supprimer les fichiers dans ce plan (risque d'imports ailleurs → vérifier en Phase 6).

**Design source archivé :** `docs/superpowers/plans/2026-07-14-bureaux-finder-redesign-design/*.dc.html` (mockups PC v4 + mobile v2, `OfficeCard`, `OfficeDetail`, `MiniMap`) — référence visuelle.

---

## Décisions verrouillées (validées avec Oraliks)

1. **Organismes V1** = actuels **+ Mutuelle/santé** ; pas de Pensions ni Aide juridique. Le registre `TYPE_META` reste extensible pour les ajouter plus tard.
2. **Carte** = réutilisation de `CustomBelgiumMap` (SVG d3-geo/TopoJSON, déjà en prod). Pas de tuiles externes, pas de fond décoratif factice.
3. **Mobile** = « carte d'abord » (option 1b du mockup) : carte plein cadre + barre de recherche flottante + sheet glissante. Décidé par le user.
4. **Style** = layout/interactions du mockup **portés sur le verre mauve DocBel** (contrainte projet, non négociable). Le rendu final sera « le mockup en version DocBel ».

## Décisions ouvertes (à trancher en cours de route, ne bloquent pas le démarrage)

- **A. Mutuelle sur CP nu.** Le résolveur peuple `attitre.mutuelle` via `BureauAssignment{serviceType:"mutuelle_<code>"}` (nécessite un code) ; par ailleurs les offices santé résolvent par CP (commit `65d9f11`). **Tâche 2.5** vérifie ce que `resolve.ts` renvoie pour un CP **sans** `?mutuelle=` et expose ce qui existe (probablement les offices santé/CAAMI de proximité). Si un **sélecteur de mutuelle** s'avère nécessaire pour un vrai match, le documenter en follow-up (hors V1).
- **B. Recherche « ville/organisme ».** Le placeholder dit « Code postal, ville ou organisme ». En V1 : **le CP (4 chiffres) déclenche la résolution** (comme aujourd'hui) **et** le texte libre **filtre** la liste chargée (nom/adresse/type), exactement comme le JS du mockup. La résolution **par nom de commune** (autocomplete → CP) est un follow-up noté en Phase 6, pas V1.

---

## Phase 0 — Modèle & adaptateur (pur, TDD)

### Task 1: `finder-model.ts` — types, registre, adaptateur, filtre, distances

**Files:**
- Create: `lib/bureaus/finder-model.ts`
- Test: `lib/bureaus/__tests__/finder-model.test.ts`

**Interfaces:**
- Consumes : `BureauResult`, `ResolveResponse`, `CommuneSummary` depuis `app/outils/bureaux/_components/types.ts` ; `haversineKm` depuis `./geoloc-banner` — **mais** pour rester pur/testable sans React, on **duplique** une `haversineKm` locale minimale (formule stable, 8 lignes) plutôt que d'importer un module client. (Le composant client continue d'utiliser celle de `geoloc-banner`.)
- Produces (utilisés par toutes les tâches suivantes) :
  - `type OfficeType = 'ONEM' | 'CPAS' | 'COMMUNE' | 'PAIEMENT' | 'SRE' | 'MUTUELLE'`
  - `interface OfficeItem { id: string; type: OfficeType; bureau: BureauResult; distanceKm: number | null }`
  - `const TYPE_META: Record<OfficeType, { labelKey: string; color: string; icon: string }>` (`labelKey` = clé i18n `public.outils`, `color` = hex catégoriel, `icon` = nom lucide)
  - `const TYPE_ORDER: OfficeType[]`
  - `function flattenResolveToOffices(data: ResolveResponse): { bureau: BureauResult; type: OfficeType }[]`
  - `function buildOffices(data: ResolveResponse, ref: { lat: number; lng: number } | null): OfficeItem[]` (mappe + distance + tri proximité, nulls en dernier, sinon ordre `TYPE_ORDER`)
  - `function filterOffices(items: OfficeItem[], activeTypes: Set<OfficeType>, query: string): OfficeItem[]`
  - `function estimateTravel(km: number): { walkMin: number; driveMin: number }` (marche 12 min/km, voiture 2 min/km, arrondi)

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// lib/bureaus/__tests__/finder-model.test.ts
import { describe, it, expect } from 'vitest'
import {
  flattenResolveToOffices,
  buildOffices,
  filterOffices,
  estimateTravel,
  TYPE_META,
  TYPE_ORDER,
  type OfficeType,
} from '../finder-model'
import type { ResolveResponse, BureauResult } from '@/app/outils/bureaux/_components/types'

function mkBureau(over: Partial<BureauResult> = {}): BureauResult {
  return {
    id: over.id ?? 'b1', type: over.type ?? 'ONEM', name: over.name ?? 'Bureau',
    street: 'Rue X', streetNum: '1', postalCode: '1000', city: 'Bruxelles',
    phone: null, email: null, website: null, appointmentUrl: null,
    hours: [], hoursNotes: null,
    lat: over.lat ?? null, lng: over.lng ?? null,
    organismeCode: null, organismeName: null, organismeColor: null,
    ...over,
  }
}

function mkResolve(over: Partial<ResolveResponse['attitre']> = {}): ResolveResponse {
  return {
    commune: { id: 'c1', insCode: '21004', nameFr: 'Bruxelles', nameNl: 'Brussel', region: 'brussels', province: null, lat: 50.85, lng: 4.35 },
    attitre: {
      cpas: null, commune: null, onem: null, organismePaiement: null,
      organismesPaiement: [], mutuelle: null, emploiRegional: null, ...over,
    },
    warnings: [],
  }
}

describe('flattenResolveToOffices', () => {
  it('aplatit chaque slot rempli en un item typé, un item par OP', () => {
    const data = mkResolve({
      onem: mkBureau({ id: 'onem' }),
      cpas: mkBureau({ id: 'cpas' }),
      commune: mkBureau({ id: 'com' }),
      emploiRegional: mkBureau({ id: 'sre' }),
      mutuelle: mkBureau({ id: 'mut' }),
      organismesPaiement: [mkBureau({ id: 'capac' }), mkBureau({ id: 'fgtb' })],
    })
    const flat = flattenResolveToOffices(data)
    expect(flat.map((f) => f.type)).toEqual(['ONEM', 'CPAS', 'COMMUNE', 'SRE', 'PAIEMENT', 'PAIEMENT', 'MUTUELLE'])
    expect(flat.map((f) => f.bureau.id)).toEqual(['onem', 'cpas', 'com', 'sre', 'capac', 'fgtb', 'mut'])
  })

  it('ignore les slots vides', () => {
    expect(flattenResolveToOffices(mkResolve())).toEqual([])
  })
})

describe('buildOffices', () => {
  it('trie par distance croissante, bureaux sans coords en dernier', () => {
    const near = mkBureau({ id: 'near', lat: 50.851, lng: 4.351 })
    const far = mkBureau({ id: 'far', lat: 51.2, lng: 4.4 })
    const noco = mkBureau({ id: 'noco', lat: null, lng: null })
    const data = mkResolve({ onem: far, cpas: near, commune: noco })
    const items = buildOffices(data, { lat: 50.85, lng: 4.35 })
    expect(items.map((i) => i.bureau.id)).toEqual(['near', 'far', 'noco'])
    expect(items[2].distanceKm).toBeNull()
  })

  it('sans ref de distance, garde l’ordre TYPE_ORDER et distanceKm null', () => {
    const data = mkResolve({ commune: mkBureau({ id: 'com' }), onem: mkBureau({ id: 'onem' }) })
    const items = buildOffices(data, null)
    expect(items.map((i) => i.type)).toEqual(['ONEM', 'COMMUNE'])
    expect(items.every((i) => i.distanceKm === null)).toBe(true)
  })
})

describe('filterOffices', () => {
  const items = buildOffices(
    mkResolve({ onem: mkBureau({ id: 'onem', name: 'ONEM Bruxelles' }), cpas: mkBureau({ id: 'cpas', name: 'CPAS Ixelles' }) }),
    null,
  )
  it('filtre par types actifs', () => {
    const out = filterOffices(items, new Set<OfficeType>(['CPAS']), '')
    expect(out.map((i) => i.bureau.id)).toEqual(['cpas'])
  })
  it('filtre par texte libre (nom, insensible casse)', () => {
    const out = filterOffices(items, new Set<OfficeType>(['ONEM', 'CPAS']), 'ixel')
    expect(out.map((i) => i.bureau.id)).toEqual(['cpas'])
  })
})

describe('estimateTravel', () => {
  it('estime marche et voiture', () => {
    expect(estimateTravel(1)).toEqual({ walkMin: 12, driveMin: 2 })
    expect(estimateTravel(0.1)).toEqual({ walkMin: 1, driveMin: 1 })
  })
})

describe('TYPE_META', () => {
  it('couvre exactement TYPE_ORDER, labelKey + color + icon définis', () => {
    expect(new Set(Object.keys(TYPE_META))).toEqual(new Set(TYPE_ORDER))
    for (const t of TYPE_ORDER) {
      expect(TYPE_META[t].labelKey).toBeTruthy()
      expect(TYPE_META[t].color).toMatch(/^#/)
      expect(TYPE_META[t].icon).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Lancer les tests → échec attendu**

Run: `pnpm test -- finder-model`
Expected: FAIL (`Cannot find module '../finder-model'`).

- [ ] **Step 3: Implémenter `finder-model.ts`**

```ts
// lib/bureaus/finder-model.ts
import type { BureauResult, ResolveResponse } from '@/app/outils/bureaux/_components/types'

export type OfficeType = 'ONEM' | 'CPAS' | 'COMMUNE' | 'PAIEMENT' | 'SRE' | 'MUTUELLE'

export interface OfficeItem {
  id: string
  type: OfficeType
  bureau: BureauResult
  distanceKm: number | null
}

/** Ordre d'affichage par défaut (quand pas de tri par distance). */
export const TYPE_ORDER: OfficeType[] = ['ONEM', 'CPAS', 'COMMUNE', 'SRE', 'PAIEMENT', 'MUTUELLE']

/**
 * Registre unique type → présentation. `labelKey` = clé i18n `public.outils`.
 * `color` = couleur catégorielle des pins/puces (esprit --chart-*, contrôlée ici,
 * jamais éparpillée dans les composants). `icon` = nom d'icône lucide-react.
 */
export const TYPE_META: Record<OfficeType, { labelKey: string; color: string; icon: string }> = {
  ONEM: { labelKey: 'bureauxTypeOnem', color: '#33406b', icon: 'Landmark' },
  CPAS: { labelKey: 'bureauxTypeCpas', color: '#7c5cff', icon: 'HeartHandshake' },
  COMMUNE: { labelKey: 'bureauxTypeCommune', color: '#22a06b', icon: 'Building2' },
  SRE: { labelKey: 'bureauxTypeSre', color: '#2563eb', icon: 'Briefcase' },
  PAIEMENT: { labelKey: 'bureauxTypePaiement', color: '#f97316', icon: 'Wallet' },
  MUTUELLE: { labelKey: 'bureauxTypeMutuelle', color: '#ec4899', icon: 'Users' },
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

export function flattenResolveToOffices(
  data: ResolveResponse,
): { bureau: BureauResult; type: OfficeType }[] {
  const a = data.attitre
  const out: { bureau: BureauResult; type: OfficeType }[] = []
  if (a.onem) out.push({ bureau: a.onem, type: 'ONEM' })
  if (a.cpas) out.push({ bureau: a.cpas, type: 'CPAS' })
  if (a.commune) out.push({ bureau: a.commune, type: 'COMMUNE' })
  if (a.emploiRegional) out.push({ bureau: a.emploiRegional, type: 'SRE' })
  for (const op of a.organismesPaiement) out.push({ bureau: op, type: 'PAIEMENT' })
  if (a.mutuelle) out.push({ bureau: a.mutuelle, type: 'MUTUELLE' })
  return out
}

export function buildOffices(
  data: ResolveResponse,
  ref: { lat: number; lng: number } | null,
): OfficeItem[] {
  const flat = flattenResolveToOffices(data)
  const items: OfficeItem[] = flat.map(({ bureau, type }) => ({
    id: bureau.id,
    type,
    bureau,
    distanceKm:
      ref && bureau.lat != null && bureau.lng != null
        ? haversineKm(ref, { lat: bureau.lat, lng: bureau.lng })
        : null,
  }))
  const orderIndex = (t: OfficeType) => TYPE_ORDER.indexOf(t)
  items.sort((x, y) => {
    if (x.distanceKm != null && y.distanceKm != null) return x.distanceKm - y.distanceKm
    if (x.distanceKm != null) return -1
    if (y.distanceKm != null) return 1
    return orderIndex(x.type) - orderIndex(y.type)
  })
  return items
}

export function filterOffices(
  items: OfficeItem[],
  activeTypes: Set<OfficeType>,
  query: string,
): OfficeItem[] {
  const q = query.trim().toLowerCase()
  return items.filter((it) => {
    if (!activeTypes.has(it.type)) return false
    if (!q) return true
    const hay = `${it.bureau.name} ${it.bureau.street} ${it.bureau.city} ${it.bureau.postalCode}`.toLowerCase()
    return hay.includes(q)
  })
}

export function estimateTravel(km: number): { walkMin: number; driveMin: number } {
  return { walkMin: Math.max(1, Math.round(km * 12)), driveMin: Math.max(1, Math.round(km * 2)) }
}
```

- [ ] **Step 4: Lancer les tests → succès attendu**

Run: `pnpm test -- finder-model`
Expected: PASS (tous les `describe`).

- [ ] **Step 5: Commit**

```bash
git add lib/bureaus/finder-model.ts lib/bureaus/__tests__/finder-model.test.ts
git commit -m "feat(bureaux): modèle plat OfficeItem + adaptateur/filtre/distances (pur, testé)"
```

### Task 2: Exposer `mutuelle` dans le type front `ResolveResponse`

**Files:**
- Modify: `app/outils/bureaux/_components/types.ts:48-60`

**Interfaces:**
- Produces : `ResolveResponse.attitre.mutuelle: BureauResult | null` (consommé par `flattenResolveToOffices`).

- [ ] **Step 1: Vérifier que le serveur renvoie déjà `mutuelle`**

Run: `pnpm exec grep -n "mutuelle" lib/bureaus/resolve.ts`
Expected: le champ `mutuelle` existe dans `ResolveResult.attitre` (server). Le front le strippait seulement au niveau TypeScript.

- [ ] **Step 2: Ajouter le champ au type front**

Dans `app/outils/bureaux/_components/types.ts`, ajouter la ligne `mutuelle` (elle existe peut-être déjà — sinon l'ajouter) :

```ts
export interface ResolveResponse {
  commune: CommuneSummary | null
  attitre: {
    cpas: BureauResult | null
    commune: BureauResult | null
    onem: BureauResult | null
    organismePaiement: BureauResult | null
    organismesPaiement: BureauResult[]
    mutuelle: BureauResult | null
    emploiRegional: BureauResult | null
  }
  warnings: string[]
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm build` (ou, plus rapide en boucle, `pnpm exec tsc --noEmit` si dispo)
Expected: pas d'erreur de type nouvelle.

- [ ] **Step 4: Commit**

```bash
git add app/outils/bureaux/_components/types.ts
git commit -m "feat(bureaux): expose attitre.mutuelle dans le type front (déjà résolu serveur)"
```

### Task 2.5: Vérifier la résolution santé/mutuelle sur CP nu (décision A)

**Files:** aucune modif — tâche d'investigation, produit une note.

- [ ] **Step 1: Lire le pipeline mutuelle/santé**

Lire `lib/bureaus/resolve.ts` autour des blocs `serviceType:"mutuelle_"` et santé (offices santé par CP, commit `65d9f11`). Déterminer : **pour un CP sans `?mutuelle=`, `attitre.mutuelle` est-il peuplé ?**

- [ ] **Step 2: Test manuel de l'API**

Run (dev server up) : `curl "http://localhost:3000/api/bureaux/resolve?cp=1000" | python -m json.tool`
Observer si `attitre.mutuelle` est non-null.

- [ ] **Step 3: Décider et documenter**

- Si `mutuelle` **non-null** sur CP nu → rien à faire, l'item MUTUELLE s'affichera.
- Si **null** (nécessite un code mutuelle) → V1 : la puce MUTUELLE existera mais sera vide tant qu'aucun office santé n'est renvoyé. Noter en tête de `bureaux-finder.tsx` un `// TODO(mutuelle):` + créer un follow-up dans `docs/tasks/NEXT_ACTIONS.md` (sélecteur de mutuelle). **Ne pas** bloquer le reste du plan.

Pas de commit (sauf ajout d'une ligne dans NEXT_ACTIONS.md si applicable).

---

## Phase 1 — Composants de présentation (liste, carte, puces)

### Task 3: `office-card.tsx` — carte compacte de liste

**Files:**
- Create: `app/outils/bureaux/_components/office-card.tsx`

**Interfaces:**
- Consumes : `OfficeItem`, `TYPE_META` (`finder-model`), `estimateTravel` ; icônes lucide via un petit dispatcher local.
- Produces : `function OfficeCard(props: { item: OfficeItem; selected?: boolean; isFavorite?: boolean; onSelect: (id: string) => void; onToggleFavorite?: (id: string) => void; fromUserLocation?: boolean }): JSX.Element`

**Notes de portage (mockup `office-card.dc.html`) :** structure identique (icône 44px arrondie couleur type, eyebrow type + badge statut, nom, adresse, distance + « X à pied », 2 boutons Itinéraire/Action, étoile favori). **Surfaces en verre** : conteneur `GLASS_CARD` (`lib/glass-classes.ts`) au lieu de `background:#fff` ; accent `var(--primary)`. Statut ouvert/fermé calculé via `computeOpenStatus(item.bureau.hours)` (`lib/bureaus/types`).

- [ ] **Step 1: Écrire le composant**

```tsx
// app/outils/bureaux/_components/office-card.tsx
'use client'

import { useTranslations } from 'next-intl'
import { MapPin, Star, Phone, Globe } from 'lucide-react'
import { GLASS_CARD } from '@/lib/glass-classes'
import { computeOpenStatus } from '@/lib/bureaus/types'
import { estimateTravel, TYPE_META, type OfficeItem } from '@/lib/bureaus/finder-model'
import { TypeIcon } from './type-icon' // créé en Task 3.1 ci-dessous

export function OfficeCard({
  item,
  selected,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: {
  item: OfficeItem
  selected?: boolean
  isFavorite?: boolean
  onSelect: (id: string) => void
  onToggleFavorite?: (id: string) => void
}) {
  const t = useTranslations('public.outils')
  const meta = TYPE_META[item.type]
  const b = item.bureau
  const status = computeOpenStatus(b.hours)
  const open = status.state === 'open'
  const address = [b.street, b.streetNum].filter(Boolean).join(' ') + `, ${b.postalCode} ${b.city}`
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address + ', Belgique')}`
  const dist = item.distanceKm != null ? `${item.distanceKm.toFixed(1).replace('.', ',')} km` : null
  const walk = item.distanceKm != null ? `${estimateTravel(item.distanceKm).walkMin} min` : null

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`${GLASS_CARD} w-full text-left p-3.5 rounded-2xl transition ${
        selected ? 'ring-2 ring-[var(--primary)]' : ''
      }`}
    >
      <div className="flex gap-3 items-start">
        <span
          className="flex-none w-11 h-11 rounded-xl flex items-center justify-center text-white"
          style={{ background: meta.color }}
        >
          <TypeIcon name={meta.icon} className="w-5.5 h-5.5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-wide truncate"
              style={{ color: meta.color }}
            >
              {t(meta.labelKey)}
            </span>
            <span
              className={`flex-none text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                open ? 'text-emerald-700 bg-emerald-100' : 'text-amber-700 bg-amber-100'
              }`}
            >
              {open ? t('bureauxStatusOpen') : t('bureauxStatusClosed')}
            </span>
          </div>
          <div className="text-[15px] font-bold text-foreground leading-tight mt-0.5 truncate">
            {b.name}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{address}</div>
          {dist && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5">
              <span className="font-bold text-foreground/80">{dist}</span>
              <span>·</span>
              <span>{walk} {t('bureauxWalk')}</span>
            </div>
          )}
        </div>
        {onToggleFavorite && (
          <span
            role="button"
            tabIndex={0}
            aria-label={t('bureauxFavorite')}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite(item.id)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                onToggleFavorite(item.id)
              }
            }}
            className="flex-none p-0.5 cursor-pointer"
          >
            <Star
              className="w-5 h-5"
              fill={isFavorite ? '#f6b93b' : 'none'}
              stroke={isFavorite ? '#f6b93b' : 'currentColor'}
            />
          </span>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl border border-border text-[13px] font-semibold text-foreground/80"
        >
          <MapPin className="w-3.5 h-3.5" />
          {t('bcItinerary')}
        </a>
        <a
          href={b.phone ? `tel:${b.phone}` : b.website ?? '#'}
          target={b.phone ? undefined : '_blank'}
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-[13px] font-bold"
          style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)' }}
        >
          {b.phone ? <Phone className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
          {b.phone ? t('bureauxCall') : t('bureauxWebsite')}
        </a>
      </div>
    </button>
  )
}
```

- [ ] **Step 1.1: Créer le dispatcher d'icônes `type-icon.tsx`**

```tsx
// app/outils/bureaux/_components/type-icon.tsx
'use client'
import { Landmark, HeartHandshake, Building2, Briefcase, Wallet, Users } from 'lucide-react'

const MAP = { Landmark, HeartHandshake, Building2, Briefcase, Wallet, Users } as const

export function TypeIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = MAP[name as keyof typeof MAP] ?? Building2
  return <Cmp className={className} aria-hidden />
}
```

- [ ] **Step 2: Vérifier build + lint (pas de nouvelle erreur)**

Run: `pnpm build` puis `pnpm lint app/outils/bureaux/_components/office-card.tsx app/outils/bureaux/_components/type-icon.tsx`
Expected: build OK ; lint sans NOUVELLE erreur. Vérifier que `GLASS_CARD` existe dans `lib/glass-classes.ts` (sinon utiliser `GLASS_INPUT`/`.glass-surface` — lire le fichier).

- [ ] **Step 3: Commit**

```bash
git add app/outils/bureaux/_components/office-card.tsx app/outils/bureaux/_components/type-icon.tsx
git commit -m "feat(bureaux): OfficeCard compacte (verre) + dispatcher d'icônes par type"
```

### Task 4: `type-filter-chips.tsx` — puces de filtre par type

**Files:**
- Create: `app/outils/bureaux/_components/type-filter-chips.tsx`

**Interfaces:**
- Consumes : `TYPE_ORDER`, `TYPE_META` (`finder-model`).
- Produces : `function TypeFilterChips(props: { active: Set<OfficeType>; onToggle: (t: OfficeType) => void; counts?: Record<OfficeType, number> }): JSX.Element`

**Notes de portage :** rangée horizontale scrollable (`overflow-x-auto`, scrollbar masquée). Puce active = fond `meta.color` + texte blanc ; inactive = `.glass-surface` + texte `muted`. Multi-select (toutes actives par défaut). N'afficher une puce que si le type a ≥1 résultat (via `counts`), sinon la griser.

- [ ] **Step 1: Écrire le composant**

```tsx
// app/outils/bureaux/_components/type-filter-chips.tsx
'use client'
import { useTranslations } from 'next-intl'
import { TYPE_ORDER, TYPE_META, type OfficeType } from '@/lib/bureaus/finder-model'

export function TypeFilterChips({
  active,
  onToggle,
  counts,
}: {
  active: Set<OfficeType>
  onToggle: (t: OfficeType) => void
  counts?: Record<OfficeType, number>
}) {
  const t = useTranslations('public.outils')
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
      {TYPE_ORDER.map((type) => {
        const meta = TYPE_META[type]
        const isActive = active.has(type)
        const count = counts?.[type] ?? 0
        const disabled = counts != null && count === 0
        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(type)}
            className="flex-none inline-flex items-center h-8 px-3 rounded-full text-xs font-semibold transition disabled:opacity-40"
            style={
              isActive
                ? { background: meta.color, color: '#fff', border: `1px solid ${meta.color}` }
                : { background: 'var(--glass-surface, transparent)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }
            }
          >
            {t(meta.labelKey)}
            {counts != null && count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 1.1: Ajouter l'utilitaire `.no-scrollbar` si absent**

Run: `pnpm exec grep -rn "no-scrollbar" app/globals.css`
Si absent, ajouter dans `app/globals.css` :

```css
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { scrollbar-width: none; }
```

- [ ] **Step 2: Build + lint**

Run: `pnpm build` ; `pnpm lint app/outils/bureaux/_components/type-filter-chips.tsx`
Expected: OK, pas de nouvelle erreur lint.

- [ ] **Step 3: Commit**

```bash
git add app/outils/bureaux/_components/type-filter-chips.tsx app/globals.css
git commit -m "feat(bureaux): puces de filtre par type (multi-select, masque les types vides)"
```

### Task 5: `office-list.tsx` — liste + en-tête count/tri

**Files:**
- Create: `app/outils/bureaux/_components/office-list.tsx`

**Interfaces:**
- Consumes : `OfficeItem`, `OfficeCard`.
- Produces : `function OfficeList(props: { items: OfficeItem[]; selectedId: string | null; favorites: Set<string>; onSelect: (id: string) => void; onToggleFavorite: (id: string) => void; countLabel: string }): JSX.Element`

- [ ] **Step 1: Écrire le composant**

```tsx
// app/outils/bureaux/_components/office-list.tsx
'use client'
import { useTranslations } from 'next-intl'
import { OfficeCard } from './office-card'
import type { OfficeItem } from '@/lib/bureaus/finder-model'

export function OfficeList({
  items,
  selectedId,
  favorites,
  onSelect,
  onToggleFavorite,
  countLabel,
}: {
  items: OfficeItem[]
  selectedId: string | null
  favorites: Set<string>
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
  countLabel: string
}) {
  const t = useTranslations('public.outils')
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-[13px] font-bold text-foreground">{countLabel}</span>
        <span className="text-xs text-muted-foreground">{t('bureauxSortedByProximity')}</span>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-3 pb-4">
        {items.map((item) => (
          <OfficeCard
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            isFavorite={favorites.has(item.id)}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
        {items.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">{t('bureauxNoResult')}</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build + lint** → OK. **Step 3: Commit**

```bash
git add app/outils/bureaux/_components/office-list.tsx
git commit -m "feat(bureaux): OfficeList (en-tête count/tri + cartes + empty-state)"
```

### Task 6: `finder-map.tsx` — wrapper de carte + sélection ; `custom-belgium-map` expose la sélection

**Files:**
- Create: `app/outils/bureaux/_components/finder-map.tsx`
- Modify: `app/outils/bureaux/_components/custom-belgium-map.tsx` (props `selectedId`, `onPinClick`)
- Modify: `app/outils/bureaux/_components/commune-panel.tsx` (importe `TYPE_META`, passe `selectedId`/`onSelect`)

**Interfaces:**
- Consumes : `CustomBelgiumMap` (existant), `OfficeItem`, `CommuneSummary`, `TYPE_META`.
- Produces : `function FinderMap(props: { commune: CommuneSummary | null; items: OfficeItem[]; selectedId: string | null; onSelect: (id: string) => void }): JSX.Element` (remplit `h-full w-full`).

- [ ] **Step 1: Lire l'API actuelle de la carte**

Lire `custom-belgium-map.tsx:11-70` (interfaces `MapBureau`, `Props`, signature `CustomBelgiumMap`) et `commune-panel.tsx` en entier. Relever le nom exact des props pins et la façon dont `TYPE_COLOR` est calculé (à remplacer par `TYPE_META[type].color`).

- [ ] **Step 2: Étendre `CustomBelgiumMap` (chirurgical)**

Ajouter à `Props` : `selectedId?: string | null` et `onPinClick?: (id: string) => void`. Au rendu des pins : si `pin.id === selectedId`, appliquer un `scale(1.25)` + halo (`filter: drop-shadow(...)`) ; `onClick` du pin appelle `onPinClick?.(pin.id)`. **Ne pas** changer la projection ni le chargement TopoJSON. Garder la rétro-compat (props optionnelles).

- [ ] **Step 3: Écrire `finder-map.tsx`**

```tsx
// app/outils/bureaux/_components/finder-map.tsx
'use client'
import { CommunePanel } from './commune-panel'
import type { OfficeItem } from '@/lib/bureaus/finder-model'
import type { CommuneSummary } from './types'

/**
 * Wrapper plein-cadre autour de la carte commune existante.
 * Convertit OfficeItem[] → bureaux attendus par CommunePanel/CustomBelgiumMap,
 * et propage la sélection (pin ↔ carte ↔ liste).
 */
export function FinderMap({
  commune,
  items,
  selectedId,
  onSelect,
}: {
  commune: CommuneSummary | null
  items: OfficeItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const bureaux = items.map((it) => it.bureau)
  return (
    <div className="h-full w-full">
      <CommunePanel
        commune={commune}
        bureaux={bureaux}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  )
}
```

- [ ] **Step 4: Adapter `commune-panel.tsx`**

Threader `selectedId`/`onSelect` jusqu'à `CustomBelgiumMap` (`onPinClick={onSelect}`). Remplacer le `TYPE_COLOR` local par `TYPE_META[typeFromBureau].color` (mapper `bureau.type`/`organismeCode` vers `OfficeType` — helper local `officeTypeOfBureau`). Conserver le lazy `dynamic(ssr:false)`.

- [ ] **Step 5: Build + QA visuelle**

Run: `pnpm build`
Puis preview (route publique) : `preview_start` → naviguer `/outils/bureaux?cp=1000` → `preview_snapshot` (vérifier pins présents) → cliquer un pin → `preview_inspect` sur le pin sélectionné (vérifier `transform: scale`). `preview_screenshot` inutile (timeout connu).

- [ ] **Step 6: Commit**

```bash
git add app/outils/bureaux/_components/finder-map.tsx app/outils/bureaux/_components/custom-belgium-map.tsx app/outils/bureaux/_components/commune-panel.tsx
git commit -m "feat(bureaux): FinderMap + sélection pin↔carte, dédup TYPE_META"
```

---

## Phase 2 — Fiche détail riche

### Task 7: `office-detail.tsx` — fiche détail (réutilise horaires, téléphone, signalement)

**Files:**
- Create: `app/outils/bureaux/_components/office-detail.tsx`

**Interfaces:**
- Consumes : `OfficeItem`, `TYPE_META`, `estimateTravel`, `HoursTimeline` (`./hours-timeline`), `PhoneReveal` (`./phone-reveal`), `ReportForm` (`./report-form`), `computeOpenStatus`.
- Produces : `function OfficeDetail(props: { item: OfficeItem; isFavorite: boolean; onToggleFavorite: (id: string) => void; onClose: () => void; variant: 'inline' | 'sheet' }): JSX.Element`

**Notes de portage (`office-detail.dc.html`) :** en-tête (icône 54px, eyebrow type, nom, badge statut+horaires courts), bloc adresse (`.glass-surface`) + distance + lien site, rangée d'actions Itinéraire (primaire) / Appeler-ou-Site / favori. **Enrichissements par rapport au mockup** (ne pas régresser l'existant) : sous l'adresse, monter `<HoursTimeline hours={b.hours} notes={b.hoursNotes} />` ; téléphone via `<PhoneReveal phone={b.phone} />` ; si `b.appointmentUrl`, bouton « Prendre rendez-vous » ; en pied, toggle « Signaler une erreur » → `<ReportForm ... />`. `variant='inline'` = header « ‹ Retour aux résultats » (PC) ; `variant='sheet'` = poignée + croix (mobile).

- [ ] **Step 1: Lire les composants réutilisés**

Lire `phone-reveal.tsx`, `hours-timeline.tsx`, `report-form.tsx` pour relever leurs props exactes (ex : `ReportForm` attend probablement `bureauId`/`targetId`). Adapter les appels en conséquence.

- [ ] **Step 2: Écrire `office-detail.tsx`**

```tsx
// app/outils/bureaux/_components/office-detail.tsx
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, X, MapPin, Globe, Star, CalendarCheck, Flag } from 'lucide-react'
import { GLASS_CARD } from '@/lib/glass-classes'
import { computeOpenStatus } from '@/lib/bureaus/types'
import { estimateTravel, TYPE_META, type OfficeItem } from '@/lib/bureaus/finder-model'
import { TypeIcon } from './type-icon'
import { HoursTimeline } from './hours-timeline'
import { PhoneReveal } from './phone-reveal'
import { ReportForm } from './report-form'

export function OfficeDetail({
  item,
  isFavorite,
  onToggleFavorite,
  onClose,
  variant,
}: {
  item: OfficeItem
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  onClose: () => void
  variant: 'inline' | 'sheet'
}) {
  const t = useTranslations('public.outils')
  const [reporting, setReporting] = useState(false)
  const meta = TYPE_META[item.type]
  const b = item.bureau
  const status = computeOpenStatus(b.hours)
  const open = status.state === 'open'
  const address = [b.street, b.streetNum].filter(Boolean).join(' ') + `, ${b.postalCode} ${b.city}`
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address + ', Belgique')}`
  const dist = item.distanceKm != null ? `${item.distanceKm.toFixed(1).replace('.', ',')} km` : null
  const walk = item.distanceKm != null ? `${estimateTravel(item.distanceKm).walkMin} min` : null

  return (
    <div className="flex flex-col h-full">
      {/* Header selon variant */}
      {variant === 'inline' ? (
        <div className="flex-none flex items-center gap-2.5 p-4 border-b border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-none w-9 h-9 rounded-xl border border-border flex items-center justify-center"
            aria-label={t('bureauxBackToResults')}
          >
            <ChevronLeft className="w-4.5 h-4.5" />
          </button>
          <span className="text-sm font-bold text-foreground/80">{t('bureauxBackToResults')}</span>
        </div>
      ) : (
        <div className="flex-none relative pt-3 pb-1">
          <span className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-border" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-muted flex items-center justify-center"
            aria-label={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-6 pt-4">
        <div className="flex gap-3.5 items-start">
          <span
            className="flex-none w-14 h-14 rounded-2xl flex items-center justify-center text-white"
            style={{ background: meta.color }}
          >
            <TypeIcon name={meta.icon} className="w-6 h-6" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
              {t(meta.labelKey)}
            </div>
            <div className="text-xl font-extrabold text-foreground leading-tight mt-0.5">{b.name}</div>
            <span
              className={`inline-flex items-center mt-2 text-xs font-semibold px-2.5 py-1 rounded-full ${
                open ? 'text-emerald-700 bg-emerald-100' : 'text-amber-700 bg-amber-100'
              }`}
            >
              {open ? t('bureauxStatusOpen') : t('bureauxStatusClosed')}
            </span>
          </div>
        </div>

        {/* Adresse + distance + site */}
        <div className={`${GLASS_CARD} mt-4 rounded-2xl p-4`}>
          <div className="text-[13.5px] font-semibold text-foreground/80">{address}</div>
          {dist && (
            <div className="text-xs text-muted-foreground mt-1">
              {dist} · {walk} {t('bureauxWalk')}
            </div>
          )}
          {b.website && (
            <a
              href={b.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold mt-2"
              style={{ color: 'var(--primary)' }}
            >
              <Globe className="w-3.5 h-3.5" />
              {b.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>

        {/* Horaires complets (réutilisé) */}
        <div className="mt-4">
          <HoursTimeline hours={b.hours} notes={b.hoursNotes} />
        </div>

        {/* Téléphone anti-scraping (réutilisé) */}
        {b.phone && (
          <div className="mt-3">
            <PhoneReveal phone={b.phone} />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 mt-4">
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-12 rounded-2xl text-white text-sm font-bold"
            style={{ background: 'var(--primary)' }}
          >
            <MapPin className="w-4 h-4" />
            {t('bcItinerary')}
          </a>
          {b.appointmentUrl && (
            <a
              href={b.appointmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-12 rounded-2xl border border-border text-sm font-bold text-foreground/80"
            >
              <CalendarCheck className="w-4 h-4" />
              {t('bureauxAppointment')}
            </a>
          )}
          <button
            type="button"
            onClick={() => onToggleFavorite(item.id)}
            aria-label={t('bureauxFavorite')}
            className="flex-none w-12 h-12 rounded-2xl border border-border flex items-center justify-center"
          >
            <Star className="w-5 h-5" fill={isFavorite ? '#f6b93b' : 'none'} stroke={isFavorite ? '#f6b93b' : 'currentColor'} />
          </button>
        </div>

        {/* Signalement (réutilisé) */}
        <div className="mt-4">
          {reporting ? (
            <ReportForm bureauId={b.id} onDone={() => setReporting(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Flag className="w-3.5 h-3.5" />
              {t('bureauxReportError')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

> ⚠️ Ajuster les props de `ReportForm`/`PhoneReveal`/`HoursTimeline` aux signatures réelles relevées au Step 1.

- [ ] **Step 3: Build + lint** → OK. **Step 4: Commit**

```bash
git add app/outils/bureaux/_components/office-detail.tsx
git commit -m "feat(bureaux): OfficeDetail riche (horaires, tél masqué, RDV, signalement, favori)"
```

---

## Phase 3 — Sheet mobile glissante

### Task 8: `mobile-sheet.tsx` — bottom-sheet 3 crans (pointer events maison)

**Files:**
- Create: `app/outils/bureaux/_components/mobile-sheet.tsx`

**Interfaces:**
- Produces : `function MobileSheet(props: { children: React.ReactNode; header: React.ReactNode }): JSX.Element` (gère les crans peek/half/full en interne ; `header` = zone de drag, ex. poignée + count).

**Notes de portage (`trouver-un-bureau.dc.html`, logique `onSheetDown/Move/Up`) :** crans `peek` / `half` / `full` en **pourcentage de la hauteur du parent** (le mockup utilise des px fixes 150/430/720 ; ici on prend des ratios pour être responsive). Snap au plus proche au relâchement. `touch-action: none` sur la poignée. Respect `prefers-reduced-motion` (transition désactivée).

- [ ] **Step 1: Écrire le composant**

```tsx
// app/outils/bureaux/_components/mobile-sheet.tsx
'use client'
import { useRef, useState, useCallback, type ReactNode } from 'react'

const SNAPS = [0.22, 0.55, 0.9] as const // peek / half / full (ratio de la hauteur parent)

export function MobileSheet({ children, header }: { children: ReactNode; header: ReactNode }) {
  const [ratio, setRatio] = useState<number>(SNAPS[1])
  const sheetRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; startRatio: number } | null>(null)

  const parentH = () => sheetRef.current?.parentElement?.clientHeight ?? 800

  const onMove = useCallback((e: PointerEvent) => {
    if (!drag.current) return
    const dy = e.clientY - drag.current.startY
    const next = drag.current.startRatio - dy / parentH()
    setRatio(Math.max(0.12, Math.min(0.95, next)))
  }, [])

  const onUp = useCallback(() => {
    drag.current = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    setRatio((r) => SNAPS.reduce((best, s) => (Math.abs(s - r) < Math.abs(best - r) ? s : best), SNAPS[1]))
  }, [onMove])

  const onDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      drag.current = { startY: e.clientY, startRatio: ratio }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [ratio, onMove, onUp],
  )

  return (
    <div
      ref={sheetRef}
      className="absolute left-0 right-0 bottom-0 z-20 bg-background rounded-t-3xl shadow-[0_-8px_30px_rgba(20,16,40,.16)] flex flex-col overflow-hidden motion-safe:transition-[height] motion-safe:duration-200"
      style={{ height: `${Math.round(ratio * 100)}%` }}
    >
      <div
        onPointerDown={onDown}
        className="flex-none pt-2.5 pb-2 cursor-grab touch-none flex flex-col items-center gap-2"
      >
        <span className="w-10 h-1.5 rounded-full bg-border" />
        {header}
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4.5 pb-5">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Build + lint** → OK. **Step 3: Commit**

```bash
git add app/outils/bureaux/_components/mobile-sheet.tsx
git commit -m "feat(bureaux): bottom-sheet mobile glissante (3 crans, pointer events, reduced-motion)"
```

---

## Phase 4 — Orchestrateur : layouts PC & mobile

### Task 9: Favoris localStorage `use-favorites.ts`

**Files:**
- Create: `app/outils/bureaux/_components/use-favorites.ts`

**Interfaces:**
- Produces : `function useFavorites(): { favorites: Set<string>; toggle: (id: string) => void }` (persiste dans `localStorage['docbel:bureaux:favorites']`, SSR-safe).

- [ ] **Step 1: Écrire le hook**

```tsx
// app/outils/bureaux/_components/use-favorites.ts
'use client'
import { useState, useEffect, useCallback } from 'react'

const KEY = 'docbel:bureaux:favorites'

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setFavorites(new Set(JSON.parse(raw) as string[]))
    } catch {
      /* localStorage indispo → favoris en mémoire seulement */
    }
  }, [])

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(KEY, JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { favorites, toggle }
}
```

- [ ] **Step 2: Build** → OK. **Step 3: Commit**

```bash
git add app/outils/bureaux/_components/use-favorites.ts
git commit -m "feat(bureaux): hook favoris localStorage (SSR-safe)"
```

### Task 10: Réécriture de `bureaux-finder.tsx` (résolution + état + layouts)

**Files:**
- Modify (réécriture): `app/outils/bureaux/bureaux-finder.tsx`

**Interfaces:**
- Consumes : `buildOffices`, `filterOffices`, `TYPE_ORDER`, `type OfficeType` (`finder-model`) ; `OfficeList`, `TypeFilterChips`, `OfficeDetail`, `FinderMap`, `MobileSheet`, `useFavorites` ; `GeolocBanner`, `haversineKm`, `reverseGeocodeBE` (inchangés).
- Conserve **tel quel** : logique `resolve` (cache `Map`, `AbortController`, debounce 150 ms), sync `?cp=`, `handleLocated`/`clearGeoloc`, `distanceRef` (geoloc → commune centroïde).

**Layout cible :**
- **Desktop (`lg:`)** : `flex` deux colonnes pleine hauteur (≈ `h-[calc(100vh-…)]` ou hauteur fixe cohérente avec le shell). Colonne gauche `w-[420px]` : titre + recherche + `TypeFilterChips` + `OfficeList` ; quand `selectedId`, `OfficeDetail variant="inline"` en `absolute inset-0` par-dessus la colonne. Colonne droite : `FinderMap` plein cadre.
- **Mobile (`<lg`)** : `FinderMap` en `absolute inset-0` + barre de recherche flottante en haut + `MobileSheet` (header = count, corps = chips + `OfficeList`) ; quand `selectedId`, `OfficeDetail variant="sheet"` dans un overlay `fixed inset-0 z-40` (fond assombri + panneau bas), monté via un `Sheet`/overlay maison (réutiliser le pattern de `OfficeDetail variant='sheet'`).

- [ ] **Step 1: Écrire le nouvel orchestrateur**

```tsx
// app/outils/bureaux/bureaux-finder.tsx
'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { MapPin, AlertCircle, Search } from 'lucide-react'

import { OfficeList } from './_components/office-list'
import { TypeFilterChips } from './_components/type-filter-chips'
import { OfficeDetail } from './_components/office-detail'
import { FinderMap } from './_components/finder-map'
import { MobileSheet } from './_components/mobile-sheet'
import { useFavorites } from './_components/use-favorites'
import { SearchLoader } from './_components/search-loader'
import { GeolocBanner, haversineKm, reverseGeocodeBE, type UserGeoloc } from './_components/geoloc-banner'
import { InfoBands } from './_components/info-bands'
import { type ResolveResponse } from './_components/types'
import { buildOffices, filterOffices, TYPE_ORDER, type OfficeType } from '@/lib/bureaus/finder-model'

export function BureauxFinder() {
  const t = useTranslations('public.outils')
  const router = useRouter()
  const params = useSearchParams()

  const [cp, setCp] = useState(params?.get('cp') ?? '')
  const [query, setQuery] = useState('')
  const [userGeoloc, setUserGeoloc] = useState<UserGeoloc | null>(null)
  const [data, setData] = useState<ResolveResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTypes, setActiveTypes] = useState<Set<OfficeType>>(new Set(TYPE_ORDER))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { favorites, toggle: toggleFavorite } = useFavorites()

  // --- Résolution : logique conservée à l'identique (cache/abort/debounce) ---
  const handleLocated = useCallback(async (geo: UserGeoloc) => {
    setUserGeoloc(geo)
    const resolved = await reverseGeocodeBE(geo.lat, geo.lng)
    if (resolved) {
      setUserGeoloc({ ...geo, postcode: resolved.postcode, city: resolved.city })
      setCp(resolved.postcode)
    }
  }, [])
  const clearGeoloc = useCallback(() => setUserGeoloc(null), [])

  const cacheRef = useRef<Map<string, ResolveResponse>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  const resolve = useCallback(
    async (postalCode: string) => {
      if (!/^\d{4}$/.test(postalCode)) {
        setData(null)
        setLoading(false)
        return
      }
      const cached = cacheRef.current.get(postalCode)
      if (cached) {
        setData(cached)
        setError(null)
        setLoading(false)
        return
      }
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/bureaux/resolve?cp=${postalCode}`, { signal: ac.signal })
        if (!res.ok) throw new Error(t('bureauxSearchError'))
        const json = (await res.json()) as ResolveResponse
        cacheRef.current.set(postalCode, json)
        if (!ac.signal.aborted) setData(json)
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        setError(e instanceof Error ? e.message : t('bureauxGenericError'))
        setData(null)
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    const id = setTimeout(() => {
      void resolve(cp.trim())
      const usp = new URLSearchParams(params?.toString() ?? '')
      if (cp.trim()) usp.set('cp', cp.trim())
      else usp.delete('cp')
      const qs = usp.toString()
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    }, 150)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp, resolve])

  // Reset sélection quand le jeu de données change
  useEffect(() => setSelectedId(null), [data])

  const distanceRef = useMemo(() => {
    if (userGeoloc) return { lat: userGeoloc.lat, lng: userGeoloc.lng }
    if (data?.commune?.lat != null && data?.commune?.lng != null)
      return { lat: data.commune.lat, lng: data.commune.lng }
    return null
  }, [userGeoloc, data?.commune])

  const allItems = useMemo(() => (data ? buildOffices(data, distanceRef) : []), [data, distanceRef])
  const items = useMemo(() => filterOffices(allItems, activeTypes, query), [allItems, activeTypes, query])

  const counts = useMemo(() => {
    const c = Object.fromEntries(TYPE_ORDER.map((ty) => [ty, 0])) as Record<OfficeType, number>
    for (const it of allItems) c[it.type]++
    return c
  }, [allItems])

  const countLabel = useMemo(() => {
    const n = items.length
    return query
      ? t('bureauxResultCount', { count: n, query })
      : t('bureauxNearCount', { count: n })
  }, [items.length, query, t])

  const toggleType = useCallback((ty: OfficeType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(ty)) next.delete(ty)
      else next.add(ty)
      return next
    })
  }, [])

  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? allItems.find((i) => i.id === selectedId) ?? null, [items, allItems, selectedId])
  const showResults = !!data && !loading

  // Barre de recherche partagée (CP déclenche la résolution ; texte filtre la liste)
  const searchBar = (
    <label className="flex items-center gap-2.5 h-12 px-3.5 rounded-2xl glass-surface border border-border">
      <Search className="w-4.5 h-4.5" style={{ color: 'var(--primary)' }} />
      <Input
        inputMode="text"
        placeholder={t('bureauxSearchPlaceholder')}
        value={query || cp}
        onChange={(e) => {
          const v = e.target.value
          const digits = v.replace(/\D/g, '')
          if (/^\d{0,4}$/.test(v)) {
            setCp(digits)
            setQuery('')
          } else {
            setQuery(v)
          }
        }}
        className="border-0 px-0 h-auto bg-transparent shadow-none focus-visible:ring-0 text-sm font-medium"
      />
    </label>
  )

  return (
    <div className="w-full">
      {/* ===== Desktop ===== */}
      <div className="hidden lg:flex gap-4 h-[calc(100vh-13rem)] min-h-[640px]">
        <div className="relative w-[420px] flex-none glass-surface rounded-3xl border border-border flex flex-col overflow-hidden">
          <div className="p-5 pb-3 space-y-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>
                {t('bureauxEyebrow')}
              </div>
              <h1 className="text-2xl font-extrabold text-foreground mt-1">{t('bureauxTitle')}</h1>
            </div>
            {searchBar}
            <GeolocBanner onLocated={handleLocated} located={userGeoloc} onClear={clearGeoloc} />
          </div>
          <div className="px-5">
            <TypeFilterChips active={activeTypes} onToggle={toggleType} counts={counts} />
          </div>
          <div className="flex-1 min-h-0 px-5 pt-2">
            {loading && <SearchLoader cp={cp.trim() || undefined} />}
            {error && <ErrorBox error={error} />}
            {showResults && (
              <OfficeList
                items={items}
                selectedId={selectedId}
                favorites={favorites}
                onSelect={setSelectedId}
                onToggleFavorite={toggleFavorite}
                countLabel={countLabel}
              />
            )}
            {!loading && !data && <EmptyPrompt />}
          </div>
          {selected && (
            <div className="absolute inset-0 z-20 glass-surface">
              <OfficeDetail
                item={selected}
                isFavorite={favorites.has(selected.id)}
                onToggleFavorite={toggleFavorite}
                onClose={() => setSelectedId(null)}
                variant="inline"
              />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 rounded-3xl overflow-hidden border border-border">
          <FinderMap commune={data?.commune ?? null} items={items} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>

      {/* ===== Mobile ===== */}
      <div className="lg:hidden relative h-[calc(100vh-9rem)] min-h-[560px] rounded-3xl overflow-hidden border border-border">
        <div className="absolute inset-0">
          <FinderMap commune={data?.commune ?? null} items={items} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="absolute top-3 left-3 right-3 z-30 space-y-2">
          {searchBar}
          <GeolocBanner onLocated={handleLocated} located={userGeoloc} onClear={clearGeoloc} />
        </div>
        {showResults && (
          <MobileSheet header={<span className="text-sm font-extrabold text-foreground">{countLabel}</span>}>
            <TypeFilterChips active={activeTypes} onToggle={toggleType} counts={counts} />
            <div className="mt-2">
              <OfficeList
                items={items}
                selectedId={selectedId}
                favorites={favorites}
                onSelect={setSelectedId}
                onToggleFavorite={toggleFavorite}
                countLabel=""
              />
            </div>
          </MobileSheet>
        )}
        {loading && (
          <div className="absolute bottom-0 left-0 right-0 z-20 glass-surface rounded-t-3xl p-5">
            <SearchLoader cp={cp.trim() || undefined} />
          </div>
        )}
        {selected && (
          <div className="fixed inset-0 z-40 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedId(null)} />
            <div className="relative glass-surface rounded-t-3xl max-h-[85%]">
              <OfficeDetail
                item={selected}
                isFavorite={favorites.has(selected.id)}
                onToggleFavorite={toggleFavorite}
                onClose={() => setSelectedId(null)}
                variant="sheet"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bandeaux pédagogiques (conservés) */}
      {showResults && (
        <div className="mt-6">
          {data!.warnings.length > 0 && <WarningsBox warnings={data!.warnings} />}
          <InfoBands />
        </div>
      )}
    </div>
  )
}

function ErrorBox({ error }: { error: string }) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>
  )
}
function WarningsBox({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-md border border-orange-300 bg-orange-50/60 dark:bg-orange-950/10 p-3 text-xs text-orange-900 dark:text-orange-200 space-y-1 mb-4">
      {warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  )
}
function EmptyPrompt() {
  const t = useTranslations('public.outils')
  return (
    <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground h-full flex flex-col items-center justify-center">
      <MapPin className="w-10 h-10 text-muted-foreground/40 mb-3" />
      {t('bureauxEmptyPrompt')}
    </div>
  )
}
```

> Notes : `EmptyPrompt`/`ErrorBox`/`WarningsBox` en helpers locaux pour garder le JSX du composant principal lisible. La barre de recherche unifie CP (déclenche résolution) + texte (filtre) — décision B.

- [ ] **Step 2: Typecheck + build**

Run: `pnpm build`
Expected: build vert (corriger les éventuels décalages de props avec `GeolocBanner`/`SearchLoader` en lisant leurs signatures réelles).

- [ ] **Step 3: Lint** (pas de `setState` synchrone dans un `useEffect` ; ESLint refuse)

Run: `pnpm lint app/outils/bureaux/bureaux-finder.tsx`
Expected: pas de NOUVELLE erreur. `useEffect(() => setSelectedId(null), [data])` est un setState **dans un callback d'effet suite à un changement de deps** — acceptable, mais si ESLint râle, le remplacer par un reset dérivé (clé de liste) ou garder derrière une garde `if`.

- [ ] **Step 4: Commit**

```bash
git add app/outils/bureaux/bureaux-finder.tsx
git commit -m "feat(bureaux): orchestrateur refondu (liste+carte+fiche, PC & mobile map-first)"
```

---

## Phase 5 — i18n & QA

### Task 11: Clés i18n `public.outils` (FR référence + fallback)

**Files:**
- Modify: `messages/fr.json` **UNIQUEMENT** (source de vérité, valeurs réelles).

> ⚠️ **Ne PAS toucher aux autres locales.** `scripts/i18n-validate.ts` (= `pnpm i18n:check`) ne **bloque** que sur JSON invalide ou erreur ICU ; les clés manquantes dans les 14 autres locales sont des **warnings non-bloquants** couverts par le fallback FR (règle projet confirmée). De plus `messages/de.json` et `messages/nl.json` portent du **WIP d'un autre agent** dans ce workdir partagé → les éditer contaminerait un commit. On ajoute donc les clés à `fr.json` seul ; les autres langues tomberont en fallback FR (traductions = follow-up).

**Clés à ajouter dans `public.outils` :**

```jsonc
{
  "bureauxEyebrow": "Docbel · Espace citoyen",
  "bureauxSearchPlaceholder": "Code postal, ville ou organisme",
  "bureauxSortedByProximity": "Trié par proximité",
  "bureauxNearCount": "{count, plural, =0 {Aucun bureau près de vous} one {# bureau près de vous} other {# bureaux près de vous}}",
  "bureauxResultCount": "{count, plural, =0 {Aucun résultat} one {# résultat} other {# résultats}} · {query}",
  "bureauxNoResult": "Aucun bureau ne correspond à ces filtres.",
  "bureauxBackToResults": "Retour aux résultats",
  "bureauxStatusOpen": "Ouvert",
  "bureauxStatusClosed": "Fermé",
  "bureauxWalk": "à pied",
  "bureauxCall": "Appeler",
  "bureauxWebsite": "Site web",
  "bureauxAppointment": "Prendre rendez-vous",
  "bureauxReportError": "Signaler une erreur",
  "bureauxFavorite": "Ajouter aux favoris",
  "bureauxTypeOnem": "ONEM",
  "bureauxTypeCpas": "CPAS",
  "bureauxTypeCommune": "Commune",
  "bureauxTypeSre": "Service emploi",
  "bureauxTypePaiement": "Org. de paiement",
  "bureauxTypeMutuelle": "Mutuelle"
}
```

- [ ] **Step 1: Ajouter les clés dans `fr.json`** (⚠️ `fr.json` a des CRLF + doublons connus → insertion **chirurgicale** dans le bon objet `public.outils`, ne pas réécrire le fichier). Vérifier que `close` existe déjà (utilisé par `OfficeDetail` sheet) ; sinon l'ajouter. Vérifier aussi que les clés conservées (`bureauxTitle`, `bureauxEmptyPrompt`, `bureauxSearchError`, `bureauxGenericError`, `bcItinerary`) existent toujours.
- [ ] **Step 2: Vérifier ICU (non-bloquant sur couverture)**

Run: `pnpm i18n:check`
Expected: `Résultat : SUCCÈS`. Les 14 autres locales afficheront « N clé(s) manquante(s) [fallback FR] » — **c'est attendu et non bloquant**.

- [ ] **Step 3: Vérifier si une recompilation est nécessaire**

`messages/_compiled` existe. Vérifier si next-intl lit `messages/*.json` directement (dev) ou `_compiled` : `pnpm exec grep -rn "_compiled\|getMessages\|messages/" i18n/ next.config.* 2>/dev/null | head`. Si `_compiled` est servi au runtime, lancer `pnpm i18n:compile` puis `git add messages/_compiled` (chemins explicites). Sinon, ne rien recompiler.

- [ ] **Step 4: Commit (chemins EXPLICITES — workdir partagé)**

```bash
git add messages/fr.json   # + messages/_compiled UNIQUEMENT si recompilé au Step 3
git commit -m "i18n(bureaux): clés fr du finder refondu (types, statut, count, actions ; fallback FR)"
```

> ❌ **Ne jamais** `git add messages/de.json` / `nl.json` / autres locales / `messages/` en bloc : elles portent du WIP d'un autre agent.

### Task 12: QA navigateur + nettoyage des composants retirés

**Files:**
- Vérif/optionnel: retrait des imports morts (`bureau-card.tsx`, `op-tabs-card.tsx`, `mobile-map-sheet.tsx`) si plus référencés.

- [ ] **Step 1: Vérifier build + tests + lint complets**

Run: `pnpm test` puis `pnpm build` puis `pnpm lint`
Expected: 271+ tests verts (dont `finder-model`), build vert, lint sans NOUVELLE erreur.

- [ ] **Step 2: QA desktop (route publique, preview OK)**

`preview_start` → `/outils/bureaux?cp=1000` :
- `preview_snapshot` : sidebar (titre, recherche, puces, liste), carte à droite avec pins.
- Cliquer une carte → `preview_snapshot` : `OfficeDetail` inline recouvre la sidebar (horaires, tél masqué, actions).
- Cliquer une puce (ex. désactiver CPAS) → la liste ET les pins se réduisent.
- Cliquer un pin → la carte sélectionne + ouvre la fiche.
- `preview_inspect` sur une carte : vérifier surface verre (pas de blanc dur), accent `var(--primary)`.

- [ ] **Step 2.1: QA mobile**

`preview_resize` preset `mobile` → recharger :
- Carte plein cadre, barre de recherche flottante, sheet à mi-hauteur.
- Glisser la poignée (simuler via `preview_eval` pointer events si besoin) → crans peek/half/full.
- Taper une carte → `OfficeDetail` en sheet bas (fond assombri).
- `preview_resize` `colorScheme: dark` → vérifier le néon glassmorphism (pas de blanc dur).

- [ ] **Step 3: Vérifier l'accessibilité minimale**

`preview_snapshot` : les boutons favori/retour/close ont un `aria-label` ; les cartes sont des `<button>`.

- [ ] **Step 4: Retirer les imports morts (si confirmés)**

Run: `pnpm exec grep -rn "op-tabs-card\|bureau-card\|mobile-map-sheet" app/outils/bureaux`
Si plus aucun import (hors définition) → laisser les fichiers (conservés) mais s'assurer qu'ils ne sont plus montés. **Ne pas** supprimer sans double-check (risque d'imports transverses).

- [ ] **Step 5: Commit final**

```bash
git add -p   # chemins EXPLICITES uniquement (workdir partagé multi-agents)
git commit -m "chore(bureaux): QA desktop+mobile, nettoyage imports du finder refondu"
```

---

## Self-Review (couverture spec ↔ plan)

- **Layout PC (sidebar + carte + fiche inline)** → Tasks 6, 7, 10. ✅
- **Layout mobile « carte d'abord » + sheet glissante + fiche sheet** → Tasks 8, 10. ✅
- **Puces de filtre par type (multi-select)** → Tasks 4, 10. ✅
- **Liste typée + tri proximité** → Tasks 1, 5, 10. ✅
- **Carte réutilisée + sélection pin↔liste** → Task 6. ✅
- **Fiche détail riche (horaires/tél/RDV/signalement/favori)** → Tasks 7, 9. ✅
- **Mutuelle/santé exposée** → Tasks 2, 2.5. ✅ (décision A tranchée à l'exécution)
- **Recherche CP + filtre texte** → Task 10 (décision B). ✅
- **Verre mauve, pas de blanc dur** → contrainte globale + Tasks 3/7/10 (surfaces `.glass-*`) + QA Task 12. ✅
- **i18n toutes langues + fallback FR** → Task 11. ✅
- **Non-régression (cache/abort/debounce/`?cp=`/géoloc/`force-dynamic`)** → Task 10 (logique conservée). ✅
- **Type-consistency** : `OfficeItem`/`OfficeType`/`TYPE_META`/`buildOffices`/`filterOffices`/`estimateTravel` définis en Task 1 et réutilisés à l'identique partout. ✅

**Pas couvert volontairement (hors V1, notés) :** Pensions & Aide juridique (données absentes) ; sélecteur de mutuelle si CP nu ne suffit pas (décision A) ; résolution par nom de commune (décision B). À verser dans `docs/tasks/NEXT_ACTIONS.md`.

---

## Execution Handoff

Voir la synthèse de conversation pour le choix d'exécution (subagent-driven vs inline).
