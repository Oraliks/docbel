# Système i18n Docbel — documentation complète

> Référence du système d'internationalisation : architecture, fichiers, flux de
> traduction, administration, outils et garde-fous. Dernière mise à jour : 2026-06-27.

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Les langues](#2-les-langues)
3. [Fichiers cœur](#3-fichiers-cœur)
4. [Le sélecteur de langue](#4-le-sélecteur-de-langue)
5. [Contenu DB (ContentTranslation)](#5-contenu-db-contenttranslation)
6. [Traduction par IA (Claude)](#6-traduction-par-ia-claude)
7. [Le glossaire (GlossaryTerm)](#7-le-glossaire-glossaryterm)
8. [Administration `/admin/i18n`](#8-administration-adminI18n)
9. [Script de traduction de masse](#9-script-de-traduction-de-masse)
10. [Validation & formatage](#10-validation--formatage)
11. [Schéma DB & migrations](#11-schéma-db--migrations)
12. [État de couverture](#12-état-de-couverture)
13. [Pièges & garde-fous](#13-pièges--garde-fous)
14. [Recettes (ajouter une langue, etc.)](#14-recettes)

---

## 1. Vue d'ensemble

Tout repose sur **`next-intl` en mode cookie** : la langue vit dans le cookie
`BELDOC_LOCALE`, **sans routing URL** (`/fr/`, `/nl/`). Deux surfaces distinctes
sont traduites :

| Surface | Quoi | Mécanisme | Stockage |
|---|---|---|---|
| **UI (interface)** | textes des composants (boutons, labels, menus…) | clés `t("public.xxx")` | `messages/{locale}.json` |
| **Contenu DB** | actus, bureaux, outils, dossiers, organismes, CP… | `localizeRecords()` | table `ContentTranslation` |

**Principe universel : « informatif jamais bloquant ».** Le **français est la
source** ET le **fallback universel** : toute clé/champ non traduit retombe
automatiquement sur le FR. Rien n'est jamais vide ou cassé.

---

## 2. Les langues

Source de vérité : `i18n/config.ts`.

```
locales = fr · nl · de · en · it · es · pt · ru · sq · mk · ar · tr · ro · bg
```

- **`publicLocales`** (proposées au public, UI traduite à 100 %) :
  `fr, nl, en, de, it, es, pt, ru, tr, ar` (+ `sq`, `mk` en cours d'ajout).
- **Cachées** : `ro`, `bg` — existent en code mais non traduites → fallback FR,
  absentes du sélecteur.
- **RTL** : `ar` → `rtlLocales` → le root layout applique `dir="rtl"` automatiquement.
- **`localeNames`** : noms natifs, jamais traduits (« Français », « Русский »,
  « Shqip », « Македонски », « العربية »…).
- **`defaultLocale`** = `fr`.

---

## 3. Fichiers cœur

| Fichier | Rôle |
|---|---|
| `i18n/config.ts` | `locales`, `defaultLocale`, `publicLocales`, `rtlLocales`, `localeNames`, `LOCALE_COOKIE`, `isLocale()`, `isRtl()` |
| `i18n/request.ts` | charge les messages : **imports statiques** des 14 catalogues + `deepMerge(FR base, langue active)` |
| `i18n/locale.ts` | lit/écrit le cookie `BELDOC_LOCALE` (`getUserLocale`, `getLocale`) |
| `i18n/actions.ts` | server action `setLocale(locale)` |
| `messages/{locale}.json` | catalogues — racine `{ admin: {…}, public: {…} }` |
| `lib/i18n/content.ts` | resolver du contenu DB (`localizeRecords`, `localizeRecord`) |
| `lib/i18n/content-source.ts` | résout la source FR d'un champ DB (pour l'éditeur admin) ; `normalizeModel()` |
| `lib/i18n/format.ts` | formatage locale-aware (date/nombre/monnaie) + tags BCP-47 belges |
| `lib/i18n/translate.ts` | moteur de traduction IA du contenu DB |
| `lib/i18n/auto-translate.ts` | auto-traduction à la sauvegarde (Phase 2) |

> ⚠️ **`messages/fr.json` ≈ 8 508 clés** : `admin.*` (~3 200, **volontairement
> non traduit** — l'admin reste en FR) + **`public.*` (~5 296 non vides)** = la
> cible réelle de traduction.

### `i18n/request.ts` — pourquoi des imports statiques

```ts
import fr from "../messages/fr.json";
import nl from "../messages/nl.json";
// … 14 imports statiques …
const CATALOGS = { fr, nl, de, en, it, es, pt, ru, sq, mk, ar, tr, ro, bg };
```

On évite **volontairement** `import(`../messages/${locale}.json`)` : un import
dynamique à chemin variable génère un *context module* Turbopack qui embarque
**tout `messages/**/*.json`** (y compris le staging `_patch/`) → si un de ces
fichiers est invalide (écriture concurrente), **le build casse**. Les imports
statiques ne bundlent que les 14 fichiers listés.

---

## 4. Le sélecteur de langue

- **`components/locale-switcher.tsx`** : un **modal** (Dialog).
  - Déclencheur = **drapeau seul** (SVG `flag-icons`, compatibles Windows/mobile —
    les emoji drapeaux ne s'affichent pas sous Windows).
  - Modal = drapeau + nom natif + coche sur la langue active.
  - Au choix → `setLocale()` + **`window.location.reload()`** (le root layout est
    mis en cache par l'App Router ; un simple `router.refresh()` ne propage pas le
    nouveau cookie au `NextIntlClientProvider`).
- **`components/welcome-locale-modal.tsx`** : modal de **première visite**
  (mémorisé en `localStorage` + cookie, FR pré-sélectionné, ignoré sur `/admin`).

---

## 5. Contenu DB (ContentTranslation)

Le contenu éditorial (pas l'UI) est traduit en base.

- **Lecture** (server components) :
  ```ts
  const articles = await localizeRecords("News", rows, ["title","excerpt"], locale);
  ```
  superpose les valeurs traduites sur les records FR, fallback FR par champ.
- **7 modèles traduisibles** : `News`, `Tool`, `Organisme`, `CalculatorAsset`,
  `CommissionParitaire`, `DocumentBundle`, `Bureau`. Le `model` est stocké en
  **PascalCase** dans `ContentTranslation`.
- **Champs scalaires uniquement** (les champs JSON — News.faqs, DocumentBundle.warnings… — restent FR).
- Câblé sur : actus (liste/article/API), outils (catalogue + pages + API),
  dossiers, organismes, commissions, calc-assets, bureaux.

---

## 6. Traduction par IA (Claude)

**`lib/i18n/translate.ts`** : `translateTexts(textes, locale)` → réutilise le
wrapper maison `callClaude` (`lib/chomage-ia/anthropic.ts`, modèle Sonnet),
**injecte le glossaire belge** dans le system prompt (mis en cache), préserve
ICU/markdown. C'est ce qui donne la qualité « native » (vs Google Trad).

Deux déclencheurs, pour le **contenu DB** :

| Phase | Déclencheur | Implémentation |
|---|---|---|
| **1 — à la demande** | boutons **« ✨ Traduire »** (par ligne / « Traduire les vides » en masse) dans l'admin | `POST /api/admin/content-translations/translate` |
| **2 — automatique** | **à chaque save FR** d'un contenu → traduit NL+EN en arrière-plan (`after()`), statut `ia` | `lib/i18n/auto-translate.ts` → `scheduleAutoTranslate(model, recordId)` branché sur **13 points de sauvegarde** des 7 modèles |

Règle commune : statut **`ia`** (à relire), **protège** ce qui est déjà validé
(`reviewed`/`published`), origine `ia`, historique tracé, FR = filet.

> Note : `scheduleAutoTranslate()` est *fire-and-forget* via `after()` ; hors
> contexte requête (seed, script) = no-op → jamais d'appel IA en masse sur un seed.

---

## 7. Le glossaire (GlossaryTerm)

- Table DB **éditable via l'admin** (remplace l'ancien `docs/i18n-glossaire.md`
  lu via `fs` → robuste en prod serverless).
- ~90 termes, chacun : **terme**, **stratégie** (`translate` 🟢 / `translate_gloss`
  🟡 / `keep` 🔴), **glose figée FR**, **note** (équivalents officiels : `NL: RVA`…),
  **catégorie**, **ordre**.
- **Injecté dans tous les prompts de traduction IA** → cohérence garantie :
  ONEM→RVA, CPAS→OCMW, INSZ, TVA→IVA/MwSt/ДДВ…
- Seedé une fois depuis le `.md` : `npx tsx scripts/glossary-seed.ts` (`--force`
  pour réinitialiser).

---

## 8. Administration `/admin/i18n`

Section à **3 onglets** (`app/admin/i18n/layout.tsx` + `components/admin/i18n/i18n-tabs.tsx`).
L'auth admin est appliquée par `app/admin/layout.tsx`.

| Onglet | Route | Contenu |
|---|---|---|
| **Traductions** | `/admin/i18n/[locale]` | éditeur **par langue** (tabs drapeaux NL/EN/DE/…). Layout 2 colonnes **Source FR \| Traduction**. Par ligne : badge **statut** (`ia` → `reviewed` → `published`), badge **origine** (ia/humain/import), bouton **✨ Traduire**, **Historique** (diff rouge/vert), **Enregistrer**. Filtres modèle/statut/recherche + toggle « sources vides masquées ». **Export CSV** (relecture IA externe puis ré-import). |
| **Glossaire** | `/admin/i18n/glossaire` | CRUD des termes (recherche, regroupé par catégorie, ajout/édition inline/suppression) |
| **Corrections** | `/admin/i18n/suggestions` | modération des corrections soumises par la communauté |

APIs : `/api/admin/content-translations` (GET liste + `[id]` PATCH + `export` CSV +
`history/[id]` + `translate`), `/api/admin/glossary` (+`[id]`),
`/api/admin/translation-suggestions`.

Chaque sauvegarde manuelle écrit une entrée dans **`ContentTranslationHistory`**
(ancien→nouveau, statut avant/après, auteur, date, origine).

---

## 9. Script de traduction de masse

**`scripts/i18n-translate-ui.ts`** — traduit l'UI (`public.*`) de `fr.json` vers
une langue cible. C'est l'outil utilisé pour ajouter de/it/es/tr/ar/ru/pt/sq/mk.

Caractéristiques (robustesse durement acquise) :

- **Sonnet 4.6 + sortie structurée** (`output_config.format`, schéma indexé fixe)
  → **JSON toujours valide** (l'ancien format objet-clés cassait ~30 % sur
  l'échappement).
- **Glossaire DB** injecté (en system caché → mis en cache API).
- **Validation ICU via AST `@formatjs`** (pas regex) → préserve variables
  `{count}`, pluriels, balises `<em>`/`<strong>` ; sinon garde le FR.
- **Reprenable** : ne refait que le manquant, écrit après chaque vague.
- **Configurable par env** :
  - `I18N_CC` = concurrence (défaut 4)
  - `I18N_BATCH` = taille de lot (défaut 20 ; mettre 8 pour les valeurs longues, anti-troncature)
  - `I18N_RELAX=1` = validation souple (sources à apostrophe collée à une balise)
- Lit la clé API depuis **`.env.local`** (contourne le `ANTHROPIC_API_KEY=""`
  injecté par Claude Code).

**Lancer** :
```bash
npx tsx scripts/i18n-translate-ui.ts de it es        # plusieurs langues
# parallélisable par langue (fichiers séparés = zéro conflit) :
npx tsx scripts/i18n-translate-ui.ts ru              # 1 process / langue
```

---

## 10. Validation & formatage

| Outil | Commande | Rôle |
|---|---|---|
| **Validateur i18n** | `pnpm i18n:check` | JSON valide + **syntaxe ICU** (@formatjs) + couverture par langue. Liste figée des locales dans `scripts/i18n-validate.ts` |
| **Lint anti-hardcodé** | `pnpm lint:i18n` | détecte les littéraux non externalisés (opt-in, warn) |
| **Typage des clés** | `tsc` | les clés `t()` du repo sont validées au compile |
| **Formatage** | `lib/i18n/format.ts` | `formatDate/Number/Currency`, `localeTag` (fr→fr-BE, nl→nl-BE, en→en-GB, ru→ru-RU…) |

---

## 11. Schéma DB & migrations

Migrations **additives** (SQL via `prisma db execute`, **jamais `db push`** — la
base Neon est partagée et `db push` détruirait pgvector + tables PDF).

| Modèle | Rôle |
|---|---|
| `ContentTranslation` | contenu DB traduit (`model`, `recordId`, `field`, `locale` → `value` ; `status` ia/reviewed/published ; `origin` ia/human/imported ; `updatedBy`) |
| `ContentTranslationHistory` | historique des éditions (diff, statuts, auteur, date, origine) |
| `GlossaryTerm` | glossaire éditable (term, strategy, glossFr, note, category, order) |
| `TranslationSuggestion` | corrections communautaires (cible contenu DB ou clé UI) |

---

## 12. État de couverture

| Catégorie | Langues | État |
|---|---|---|
| **Source** | `fr` | 100 % (référence + fallback) |
| **UI complète** | `nl, en, de, it, es, pt, ru, tr, ar` | **100 %** des ~5 296 clés `public.*` |
| **UI en cours d'ajout** | `sq, mk` | traduction en cours |
| **Cachées** | `ro, bg` | 0 % (fallback FR) |
| **Admin** | toutes | reste FR (volontaire — `admin.*` ~3 200 clés) |
| **Contenu DB** | `nl, en` | traduit + auto-traduit à chaque save FR |

---

## 13. Pièges & garde-fous

1. **Import dynamique = build cassé** : `import(`../messages/${x}.json`)` globe
   **tout `messages/**`** (dont le staging `_patch/`) → un fichier à moitié écrit
   casse le build. → **imports statiques** dans `request.ts`. Ne jamais revenir au
   dynamique.
2. **Validation ICU par regex** rejette faussement **tous les pluriels/select**
   (le texte des branches change par langue) → passer par l'**AST `@formatjs`**.
3. **Apostrophe ASCII collée à une balise** (`Un'<strong>`) = délimiteur de
   citation ICU → `UNMATCHED_CLOSING_TAG` → utiliser l'apostrophe typographique `’`.
4. **`Record<Locale>` exhaustifs** : ajouter une langue oblige à éditer **6 maps**
   (cf. recette ci-dessous) sinon `tsc` casse — et le **cache tsc incrémental
   masque** ces erreurs : vider `tsconfig.tsbuildinfo` pour un check fiable.
5. **Casse du `model`** : `ContentTranslation.model` est stocké en **PascalCase** ;
   `content-source.ts` normalise (`normalizeModel`) pour le résoudre côté admin.
6. **Drapeaux** : utiliser les SVG `flag-icons`, pas les emoji (invisibles sous Windows).
7. **Workdir partagé multi-agents** : `git add` **explicite** (jamais `-A`) ; un
   script de traduction relancé peut laisser **plusieurs instances concurrentes**
   qui se clobberent un même fichier → surveiller et tuer les doublons.
8. **Clé API** : Claude Code injecte `ANTHROPIC_API_KEY=""` → les scripts lisent
   `.env.local` directement ; les endpoints IA peuvent renvoyer 503 selon l'env.

---

## 14. Recettes

### Ajouter une langue (ex. `xx`)

Éditer **tous** les `Record<Locale>` exhaustifs (sinon `tsc` casse) :

1. `i18n/config.ts` → `locales` + `localeNames` (nom natif).
2. `components/locale-switcher.tsx` → `localeCountryCodes` (code drapeau ISO 3166).
3. `lib/i18n/format.ts` → `LOCALE_TAGS` (tag BCP-47).
4. `scripts/i18n-validate.ts` → `LOCALES`.
5. `i18n/request.ts` → `import xx from "../messages/xx.json"` + `CATALOGS`.
6. `scripts/i18n-translate-ui.ts` → `LANG_LABEL` (libellé FR de la langue).
7. Créer `messages/xx.json` = `{}`.

Puis traduire et exposer :

```bash
npx tsx scripts/i18n-translate-ui.ts xx                                 # passe principale
$env:I18N_RELAX='1'; $env:I18N_BATCH='8'; npx tsx scripts/i18n-translate-ui.ts xx  # finition
pnpm i18n:check                                                          # valider JSON + ICU
# → ajouter "xx" à publicLocales dans config.ts une fois à ~100 %
```

### Re-seed le glossaire depuis le `.md`

```bash
npx tsx scripts/glossary-seed.ts --force
```

### Exporter une langue pour relecture IA externe

`/admin/i18n/{locale}` → bouton **Exporter CSV** (colonnes : source FR + traduction
+ statut + origine), corriger, ré-importer.
