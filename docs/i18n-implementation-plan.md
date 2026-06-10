# Plan d'implémentation i18n — Beldoc

> **Statut :** plan validé (cadrage). Pas encore d'implémentation.
> **Date :** 2026-06-03
> **Objectif :** site multilingue 8 langues, configurable via admin, qualité **native**
> (pas Google Trad — terminologie administrative belge comprise).

---

## 1. Objectif & langues

- **Source :** FR.
- **Cibles :** NL, DE, EN, AR, TR, RO, BG (8 au total).
- **Arabe → RTL** (right-to-left).
- i18n **partout** : public **et** admin.
- **Configurable via admin** : gestion des langues + édition des traductions depuis le back-office.

---

## 2. Décisions verrouillées

| # | Décision | Détail |
|---|---|---|
| 1 | **Outillage** | Hybride : **Tolgee** auto-hébergé (UI/micro-copy) + **admin maison** (contenu DB, généralise le pattern lookup) + pipeline **Claude** (déjà câblé) avec glossaire injecté |
| 2 | **Admin** | Traduit aussi (pas seulement le public) |
| 3 | **Langues** | Les 8 visées (cible totale, livraison par vagues) |
| 4 | **Contenu DB** | Tout le contenu public |
| 5 | **Lookup ONEM** | **Exception : FR/NL/DE uniquement** (pas EN/AR/TR/RO/BG → fallback). NL ~98% fait, DE ~1,5% → trou ~225k mots à combler (import CSV ONEM gratuit d'abord, puis IA) |
| 6 | **KB IA** | Choix initial = traduire + ré-embeddings par langue. **Reco = embeddings multilingues/cross-lingues** (~0€). À reconfirmer + vérifier si l'assistant est public ou interne |

---

## 3. Audit : volume & budget

Mesuré via `scripts/i18n-volume-audit.ts` et `scripts/i18n-lookup-coverage.ts` (read-only).

- **86 pages, 219 routes API, 78 modèles Prisma, 531 composants.**
- Volume traduisible "core" = **353 186 mots**, mais **93% = codes ONEM** (`LookupEntry`).
- Vrai contenu éditorial (hors ONEM/KB) ≈ **24 600 mots**. Page-builder quasi vide (2 pages).
- KB IA = 375k mots (optionnel). `BaremeAmount` = 0 mot (chiffres).
- Lookup : 155 432 lignes → **98 761 libellés uniques** ; NL 98,1%, DE 1,5% → trou DE = 97 554 libellés ≈ 225 183 mots.

### Budget consolidé (chemin malin)

| Poste | Volume | Coût |
|---|--:|--:|
| Lookup DE (l'exception) | ~225k mots (1 langue) | 3 000 – 11 000 € |
| Lookup NL (finition) | ~1,5k mots | négligeable |
| Éditorial + catalogue (×7) | ~78k mots cibles | 1 500 – 8 000 € |
| UI hardcodée (×7) | ~56k mots cibles | 1 100 – 6 000 € |
| KB IA (embeddings multilingues) | — | ~quelques € |
| **TOTAL réaliste** | | **~6 000 – 25 000 €** (visé ~6-12k€) |

> Pour mémoire : "tout traduire" littéralement (codes ONEM × 8 + KB traduite) = **50 000 – 247 000 €**. Les décisions 5 et 6 font tout l'écart.

---

## 4. Architecture

### 4.1 — Routing : tout sous `app/[locale]/`

On déplace tout `app/` (sauf `api/` + fichiers spéciaux) sous `app/[locale]/`.

**Le catch-all CMS `[slug]` n'est pas un blocage :** Next.js résout du plus spécifique au moins spécifique → **un segment statique bat un segment dynamique** au même niveau. `app/[locale]/outils/` gagne sur `app/[locale]/[slug]/`. Règle d'or : **aucune route hors `[locale]`**.

| Élément | Après |
|---|---|
| Pages publiques + admin | `app/[locale]/outils/…`, `app/[locale]/admin/…` |
| CMS catch-all | `app/[locale]/[slug]` |
| `<html lang/dir>` | déplacé dans `app/[locale]/layout.tsx` (dynamique) |
| Root `app/layout.tsx` | passthrough minimal (Next exige un root layout) |
| `api/` (219 routes) | **inchangé**, hors `[locale]` |
| `sitemap.xml`, `not-found`, `favicon` | racine, exclus du middleware |

- Chaque page : `params` gagne `locale` (Next 16 → `await params`). `generateStaticParams` = `locale × params`. ~86 fichiers.
- **Middleware** racine = next-intl seul (locale + redirect ; matcher exclut `/api`, `/_next`, statiques). **Auth inchangée** (reste dans les layouts).
- Locales possibles **figées en code** ; `AppSetting` ne stocke que `default` + `enabled` → pas d'appel DB dans le middleware.

### 4.2 — Stockage DB : un résolveur, quatre mécanismes

Résolveur unique `lib/i18n/resolve.ts` (généralise `lib/lookup/locale.ts`), fallback systématique (`locale → fr`, jamais d'écran vide).

| Contenu | Mécanisme | Migration |
|---|---|---|
| **Lookup ONEM** (FR/NL/DE) | colonnes `labelFr/Nl/De` **existantes** — finir le DE | aucune |
| **Labels courts** (Tool, Category, Organisme, ToolSection, CommissionParitaire, CalculatorAsset, presets) | table générique **`ContentTranslation`** `(model, recordId, field, locale, value, status)` + index unique | 1 table additive |
| **Contenu riche** (News, Changelog, Page) | tables dédiées **`NewsTranslation` / `ChangelogTranslation` / `PageTranslation`** (colonnes typées + `content` JSON) | 3 tables additives |
| **Schémas JSON** (DocumentTemplate.schema, PdfForm.fields) | labels `{fr,nl,…}` **dans** le JSON (étend le pattern PdfFieldPreset existant) | aucune (data) |
| **UI / micro-copy** | Tolgee → next-intl | aucune |

**Sous-ensembles de langues par contenu** : le résolveur lit la config (lookup → {fr,nl,de} ; reste → 8).

### 4.3 — Configurable via admin

- **Config langues** : clé `AppSetting` `I18N_CONFIG = { default, enabled[], subsets{} }` (réutilise `SettingInputCard` + `/api/admin/settings/[key]`).
- **Module `/admin/traductions`** (ajouté à `components/app-sidebar.tsx`) : *Langues* (toggles) · *Contenu DB* (éditeur) · *UI* (Tolgee).
- **Éditeur** : généralise `EditableCell` + switcher du lookup (`app/admin/chomage/lookup/[id]`) en `<LocalizedField>` / onglets par locale, avec statut **brouillon / IA / révisé / publié** (seul *publié* s'affiche public).
- **Rôle `translator`** ajouté à l'enum `UserRole` (additif) ; `/admin/traductions` ouvert à `admin + translator`.

---

## 5. Contraintes non-négociables

1. **🚨 Neon PARTAGÉE + projet en PR → JAMAIS `db push`.** Migrations **additives + idempotentes** (`CREATE TABLE/ADD COLUMN/ADD VALUE IF NOT EXISTS`) via `prisma db execute` (pattern migration 28). pgvector + tables PDF intacts.
2. **Lint déjà rouge (75 erreurs préexistantes)** → ne pas aggraver.
3. **"Informatif jamais bloquant"** → fallback systématique, jamais de page vide.
4. **Design system 2 langages** (glass public / shadcn admin) → audit RTL sur les composants partagés.

---

## 6. Pipeline de traduction (Claude + glossaire + Tolgee)

```
Source FR ─┬─► UI strings ──► Tolgee (pré-trad IA + glossaire + relecture) ──► messages next-intl
           └─► Contenu DB ──► lib/i18n/translate.ts (Claude) + glossaire + contexte
                              ──► *Translation (status="ia") ──► relecture ──► status="published"
```

- **`lib/i18n/translate.ts`** réutilise `lib/chomage-ia/anthropic.ts`. Batch + cache. Glossaire injecté en system prompt.
- **Glossaire** = source de vérité terminologique (CPAS, U1, précompte…). Voir `docs/i18n-glossaire.md` (à constituer).
- **Tolgee** auto-hébergé : in-context, mémoire de traduction, rôles traducteurs.

---

## 7. RTL · formatage · SEO

- **RTL (arabe)** : `dir` sur `<html>`. Sweep des composants : `ml-/mr-/pl-/pr-/left-/right-/text-left` → logiques `ms-/me-/ps-/pe-/start-/end-/text-start` (Tailwind 4). **À valider en Phase 1** (locale `ar` stub).
- **Formatage** : remplacer les `"fr-BE"` hardcodés (94 fichiers) par `useFormatter`/`getFormatter` next-intl.
- **SEO** : `generateMetadata` par locale, `hreflang` alternates, `sitemap.xml/route.ts` réécrit pour toutes les locales actives.

---

## 8. Phases

| Phase | Contenu | Ship | Parallélisable |
|---|---|---|---|
| **0 — Lock** | Glossaire (80-150 termes) + Tolgee + config locales | — | glossaire ∥ infra |
| **1 — Infra** | next-intl, middleware, déplacement `[locale]`, split layout, `<html lang/dir>`, AppSetting, RTL skeleton (`ar` stub) | Site FR en `/fr/`, RTL validé | — |
| **2 — UI** | Extraction strings (public + admin) → Tolgee, pré-trad IA + relecture, sweep formatage, audit RTL | UI multilingue | par namespace |
| **3 — DB schema** | Migrations additives idempotentes + résolveur + module `/admin/traductions` + rôle translator | Admin de traduction | — |
| **4 — Pipeline IA** | `lib/i18n/translate.ts` + glossaire + workflow statut | Premiers jets IA | — |
| **5 — Contenu (vagues)** | a) Lookup DE (import CSV ONEM → IA → relecture) · b) éditorial/catalogue · c) page-builder · d) KB IA | Contenu traduit par priorité | a/b/c indépendants |
| **6 — Finition** | SEO (hreflang, sitemap), QA par locale, "signaler une traduction" | Lancement multilingue | — |

**Décisions ouvertes** (avant 5d, non bloquantes avant) : assistant IA public/interne ? · embeddings multilingues vs traduction+ré-embeddings.

---

## 9. Risques & vigilance

1. Déplacement `[locale]` = gros diff mécanique (86 pages) → branche dédiée, sans autre changement.
2. RTL sous-estimé → valider en Phase 1.
3. Migrations Neon → discipline absolue (SQL additif via `db execute`, jamais `db push`).
4. Cache des traductions DB-backed → invalidation au save (`revalidateTag`).
5. Slugs : préfixe locale + **slug FR partagé** au début (localiser les slugs double le SEO).

---

## 10. Annexe — scripts d'audit (réutilisables)

- `scripts/i18n-volume-audit.ts` — volume traduisible par modèle/tier + projection budget. `dotenv -e .env.local -- tsx scripts/i18n-volume-audit.ts`
- `scripts/i18n-lookup-coverage.ts` — couverture FR/NL/DE/EN des codes ONEM + trou DE dédoublonné.
