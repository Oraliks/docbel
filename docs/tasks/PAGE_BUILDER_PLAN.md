# PAGE_BUILDER_PLAN — Plan d'amélioration du page-builder

## Journal d'exécution — 2026-07-12 (session autonome)

Décisions prises seul (Oraliks endormi, « go recommandations ») :
D1 hardening-first ✅ · D2 mesure via build standard · D3 quarantaine visible ·
D4 rétention 30+1/jour · D5 presets DB via AppSetting.

| Lot | État | Détail |
|-----|------|--------|
| **A** (tests) | ✅ **LIVRÉ** | +142 tests page-builder (4→146). interpolate, validation, block-styles, page-health, schema-org, preview-token, file-usage, store Zustand headless, invariant registry (defaults des 133 blocs ⊨ schéma). Commit `…` |
| **E1** (safeEval) | ✅ **LIVRÉ** | `lib/page-builder/expression.ts` (parseur récursif fermé) remplace `new Function`. 20 tests (dont refus injections). Clôt audit 05-29 §6. |
| **C1** (audit contenu) | ✅ **LIVRÉ** | `pnpm pages:audit`. Baseline : 6 pages / 83 blocs / **0 problème**. |
| **C2** (quarantaine) | ✅ **LIVRÉ** | Bloc inconnu → carte ambre visible en editorMode (null en public). |
| **C3** (rétention) | ✅ **LIVRÉ** | `planRetention` pur (6 tests) + `pnpm pages:prune-revisions` (dry-run défaut). Statut page = déjà enum. **Purge réelle NON exécutée** (DB partagée → attend `--apply` validé). Dry-run : `pourquoi-docbel` 79 rév → 48 purgeables. |
| **B** (code-splitting) | ⏸️ **DIFFÉRÉ** | Next 16 `next build` **n'émet plus** les tailles First Load JS (Turbopack) → mesure avant/après impossible sans `@next/bundle-analyzer` (D2 à rouvrir). De plus screenshot preview timeout dans l'env → hydratation non vérifiable. Refus de shipper un refactor visiteur risqué à l'aveugle. **Rouvrir D2** (autoriser l'analyzer) avant de coder. |
| **D** (monolithes) | ⏸️ **DIFFÉRÉ** | D1 (slices store) faisable sous le filet du lot A, mais D2/D3 (block-wrapper, liste admin) = risque UI pur non vérifiable dans cet env. À faire en session interactive avec QA visuelle. |
| **E2** (presets DB) | ⏸️ **DIFFÉRÉ** | P3, touche localStorage→AppSetting + route API + UI ; non vérifiable ici. |

Validation : `pnpm test` = **1596 tests verts** · `pnpm build` OK.
Commits locaux `ae01969` → `HEAD` (non poussés — workdir partagé, PDF non poussés en attente).

---

> Proposition 2026-07-10 — **rien codé**, en attente de validation Oraliks.
> Positionnement : **hardening + perf**, pas de nouvelles features éditeur
> (MVP_SCOPE : « page-builder avancé au-delà des pages légales » = hors V1).
> Le builder sert le P0 RGPD (item #3 NEXT_ACTIONS : pages légales via template `legal`),
> d'où l'intérêt de fiabiliser maintenant le rendu public et la persistance.

## 1. État des lieux (audit 2026-07-10)

**Périmètre** : 3 surfaces — `lib/page-builder/` (23 fichiers, ~4 273 l),
`components/page-builder/` + `inspector/` (37 fichiers, ~9 184 l),
`components/page-blocks/` (18 catégories, **133 types de blocs**).

**Forces à préserver** :
- Zod-first strict : schémas = source de vérité (`schemas.ts` par catégorie →
  `schema-registry.ts` server-safe → `StrictBlockSchema` généré). 0 `any`,
  0 `@ts-ignore`, 0 TODO dans tout le builder.
- Riche et déjà factorisé : DnD @dnd-kit, undo/redo (80 pas), autosave débouncé,
  versioning `PageRevision`, planification, preview token HMAC, 6 routes IA
  (wrapper `ai-route.ts`), thèmes/page, variables `{{}}`, snippets DB, blocs
  globaux, santé de page a11y/SEO, palette ⌘K, Unsplash, SSR partagé
  (`render-page.tsx`), ISR 60 s + revalidatePath, JSON-LD auto.
- XSS : DOMPurify appliqué partout (audit 05-29 remédié, cf. CONTRADICTIONS.md).

**Faiblesses chiffrées** :

| # | Constat | Preuve |
|---|---------|--------|
| F1 | **Tests quasi absents** : 4 tests (url-utils) pour ~13 500 lignes | `lib/page-builder/__tests__/` (1 fichier) |
| F2 | **Bundle public : les 133 blocs partent sur chaque page publiée**. `block-renderer.tsx` est `'use client'` et importe `getBlockDef` du REGISTRY complet (qui importe tous les `Render`, dont `ec32-page-block` 1 557 l, charts, etc.) | `components/page-builder/block-renderer.tsx:19`, `lib/page-builder/registry.ts:8-25` |
| F3 | **Monolithes** : `block-wrapper.tsx` 1 119 l · `store.ts` 932 l · `admin/pages/page.tsx` 886 l · `page-editor-client.tsx` 708 l · `design-tab.tsx` 624 l | comptage 2026-07-10 |
| F4 | **Intégrité des données** : `Page.content Json` non contraint ; `PermissiveBlockSchema` accepte tout `type` inconnu (fallback legacy silencieux) ; `status` = string libre ; révisions = snapshots complets **sans rétention** | `validation.ts`, `prisma/schema.prisma` (Page l.183-204) |
| F5 | **Sécurité résiduelle** : `safeEval` via `new Function` (filtré ARITHMETIC_ONLY + whitelist Math, mais surface signalée par l'audit 05-29 §6) | `components/page-blocks/engagement/calculator.tsx:36` |
| F6 | **Presets de style en localStorage** (perdus au changement de navigateur) alors que les snippets sont en DB | `style-presets.ts:53` vs `snippets.ts` |

## 2. Cadre d'exécution

- Lots de **3-5 fichiers max**, un lot = une session, commit + push par lot
  (workdir partagé multi-agents → `git add` explicite uniquement).
- **SQL additif** uniquement (`prisma db execute`), jamais `db push` (Neon partagée).
- Pas de nouvelle dépendance runtime. Une seule dépendance **dev** proposée
  (bundle analyzer, décision D2).
- Ne jamais réintroduire de types par bloc écrits à la main (TECH_DEBT_QUEUE l.20).
- Validation systématique : `pnpm test` + `pnpm build` + `pnpm lint` (delta 0)
  + écrans : éditeur `/admin/pages/[id]` et page publiée `/[slug]`.

## 3. Lots

### Lot A — Filet de tests sur la logique pure (P1, prérequis des refactors)

| Sous-lot | Contenu | Fichiers | Effort |
|---|---|---|---|
| A1 | **Invariant registry** : test générique « pour chacun des 133 blocs, `defaults` valide son schéma strict » ; `validateAiBlocks` rejette type inconnu ; limite 500 blocs ; `generateSlug`. + `interpolate.ts` (`{{site.name}}`, `{{vars.*}}`, `{{item}}` repeater, valeurs manquantes) | 2 fichiers de test | 0,5 j |
| A2 | **`store.ts` headless** : add/remove/move/duplicate/multi-sélection, undo/redo (limite 80), clipboard cut/copy/paste, wrap in section, overrides responsive, find & replace | 1-2 fichiers de test | 0,5-1 j |
| A3 | `page-health.ts` (hiérarchie titres, alt, liens vides) · `schema-org.ts` (FAQ/Article/HowTo/Breadcrumb) · `block-styles.ts` (`mergeForDevice`, états d'interaction, `blockScopedCss`) · `preview-token.ts` (sign/verify/expiry/fail-soft) · `file-usage.ts` | 3-5 fichiers de test | 0,5-1 j |

Cible : **+80 à 120 tests**. Risque : faible (aucun code de prod modifié).

### Lot B — Perf rendu public : code-splitting des blocs (P1, plus gros gain visiteur)

| Sous-lot | Contenu | Risque |
|---|---|---|
| B0 | **Mesurer d'abord** : poids First Load JS de 2-3 pages publiées réelles (`next build` + analyzer, cf. décision D2). Chiffre avant/après obligatoire. | — |
| B1 | Scinder le registry : garder `schema-registry.ts` (schémas+meta, server-safe, existe déjà) et créer `render-registry.ts` où chaque `Render` public est chargé en **`next/dynamic` par type** (ou par catégorie). L'éditeur admin garde l'import complet (il est déjà derrière `dynamic(..., ssr:false)`). | Moyen : hydratation/flicker → `ssr: true`, loading nul, rollout par catégorie |
| B2 | Vérification : SSR intact (HTML complet dans la réponse), pas de layout shift, ISR ok ; re-mesure et rapport avant/après. | — |

### Lot C — Intégrité des données (P2)

| Sous-lot | Contenu | Risque |
|---|---|---|
| C1 | Script **read-only** `scripts/audit-page-content.ts` : passe `StrictBlockSchema` sur tous les `Page.content` (+ échantillon `PageRevision`), rapport par type d'erreur et par page. **Aucune écriture.** | Nul |
| C2 | **Quarantaine des blocs inconnus** : dans l'éditeur, rendu explicite « Bloc inconnu (type X) » avec actions réparer/supprimer au lieu du fallback silencieux ; log compteur côté `PermissiveBlockSchema`. | Faible |
| C3 | `status` en `z.enum(['draft','published','scheduled'])` côté appli (pas d'enum DB) + **politique de rétention des révisions** (ex. garder les 30 dernières + 1/jour au-delà) — purge en script, pas en migration. | Faible |

### Lot D — Découpage des monolithes (P2, uniquement après lot A)

| Sous-lot | Contenu |
|---|---|
| D1 | `store.ts` (932 l) → slices Zustand (`blocks`, `selection`, `history`, `clipboard`, `presets`) — **API publique inchangée**, les tests A2 servent de harnais |
| D2 | `block-wrapper.tsx` (1 119 l) → extraire menu contextuel, toolbar d'insertion, chrome de drag (3-4 composants) |
| D3 | `app/admin/pages/page.tsx` (886 l) → table de liste, dialog bulk-delete, picker de template |

`ec32-page-block.tsx` (1 557 l) = bloc **métier**, hors périmètre builder → item séparé si souhaité.

### Lot E — Sécurité résiduelle + petits gains (P2/P3)

| Sous-lot | Contenu |
|---|---|
| E1 | `calculator.tsx` : remplacer `new Function` par un **mini-évaluateur d'expressions** maison (parser récursif ~100 l, zéro dépendance, `lib/page-builder/expression.ts`) + tests (formules réelles, tentatives d'injection) — clôt l'item audit 05-29 §6 |
| E2 | Presets de style : localStorage → **DB** (pattern `Snippet` ; nouvelle table en SQL additif ou réutilisation `AppSetting`) — décision D5 |
| E3 | (P3, optionnel) Étendre `page-health` : liens internes vers slugs supprimés/dépubliés |

## 4. Ordre recommandé et estimation

```
A1 → A2 → B0 → B1 → A3 → B2 → C1 → E1 → C2 → C3 → D1 → D2 → D3 → E2 → E3
```

≈ **6 à 8 demi-journées**. A et B sont indépendants (parallélisables sur 2 sessions),
D dépend de A, C2/C3 dépendent du rapport C1.

## 5. Non-objectifs (explicitement hors plan)

- Pas de nouveaux types de blocs ni de refonte UI de l'éditeur.
- Pas de migration du stockage `content Json` vers des tables relationnelles.
- Pas d'i18n des pages construites (projet i18n séparé).
- Pas de collaboration temps réel / multi-curseur.
- Pas de refonte du versioning en diffs (snapshots conservés, seule la rétention change).

## 6. Décisions à trancher (Oraliks)

| # | Décision | Options |
|---|----------|---------|
| D1 | Valider le positionnement **hardening-first** (vs features éditeur) | oui / pivoter |
| D2 | Mesure bundle : ajouter `@next/bundle-analyzer` en **devDependency** ? | oui / mesure via stats `next build` standard |
| D3 | Blocs legacy invalides après rapport C1 | quarantaine visible (recommandé) / nettoyage en base |
| D4 | Rétention des révisions | 30 + 1/jour (proposé) / autre / illimité |
| D5 | Presets de style | table DB dédiée / `AppSetting` / rester localStorage |

## 7. Risques globaux

- **Lot B** = le seul à risque visuel réel → mesure avant/après, rollout par
  catégorie, rollback trivial (revenir à l'import direct).
- **Lot D** = régressions éditeur possibles → jamais sans le filet du lot A.
- DB Neon partagée : C1 strictement read-only ; E2 en SQL additif uniquement.
