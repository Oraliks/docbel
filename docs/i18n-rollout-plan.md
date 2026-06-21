# i18n — Audit complet & plan de déploiement (tout le site + features futures)

> **Date :** 2026-06-22 · **Statut :** plan (audit 5 agents réalisé).
> Complète `docs/i18n-implementation-plan.md` (archi) et `docs/i18n-glossaire.md` (terminologie).

---

## 1. Audit — état réel (juin 2026)

### Couverture actuelle
- **Fondation OK** : next-intl 4.13 mode **cookie** (`BELDOC_LOCALE`), deep-merge → fallback FR. Provider monté **uniquement** dans `app/admin/layout.tsx`.
- **`messages/`** : `fr.json` ≈ **570 clés / 14 namespaces** (baremes = 284 à lui seul) ; `nl.json` **commencé** (~82 clés baremes) ; **de/en/ar/tr/ro/bg = vides** (fallback FR actif).
- **Usage** : 22 fichiers `t()` — **100% admin, 0% public**.

### Surface restante (chiffrée)
| Zone | Strings UI à externaliser | Couverture |
|---|--:|---|
| **Admin** (gros composants ~2 400 + sections 0% ~1 683) | **~4 100** | ~8 % |
| **Public** (landing, outils, espaces pros, auth, formations…) | **~4 100** | 0 % |
| **Transverse** (Zod ~300-400, erreurs API ~80-100, emails 2-3, better-auth ~10, toasts ~210 partiels) | **~750-1 000** | ~partiel |
| **TOTAL UI** | **~9 000 strings** | |

- **Admin** : ~60 000 lignes, 235 fichiers sans i18n. Points chauds : `components/admin/chomage-ia/**` (~1 000 strings), **Formations** (NEW, 0%, ~307), shells partenaires/employeurs (~335), `bureaux/**` (~360), documents (~490), page-builder (~209), messagerie (~242).
- **Public** : 68 % des composants `components/docbel/**` sont client. Points chauds : espaces pros (~1 200), landing/home (~800), `bundle-runner`, `u1-public-page`, `landing/header`.

### Contenu DB — nouveau depuis l'audit initial
- **Formations** (migration 48, 19 tables) : `Training.title/shortDescription/description/objectives[]/targetAudience`, `TrainingCategory`, `TrainingTag`, `TrainingBadge`, `OrientationBranch/Question/AnswerOption` (Boussole). ~80-150 champs human-readable. ⚠️ **Bloqueur** : `slug` `@unique` FR + `Training.language="fr"` figé → besoin clé composite `(slug, locale)` ou table de traduction.
- **Decision Builder** (migration 54) : `DecisionTree.title/description`, `changeNotes`, + **labels de nœuds dans le JSON** `draftContent/publishedContent` (schema Zod).

### Formatage / SEO — dette
- **30 fichiers** avec locale codée en dur + **64** `toLocaleDateString/String`. 🐞 **Bug** : `app/actualites/*` utilise `fr-FR` au lieu de `fr-BE`. Exemplaire à généraliser : `lib/booking/i18n.ts` (dicts multilingues fr/nl/de/en).
- **SEO** : **0** balise `hreflang`, **0** `canonical`. `app/sitemap.xml` **n'inclut pas** formations/boussole et n'a pas d'alternates locale.

### Garde-fous — INEXISTANTS (le vrai problème pour l'avenir)
- ❌ Pas d'augmentation TypeScript next-intl → clés **non typées** (typo = fallback silencieux).
- ❌ Pas de règle ESLint contre les strings en dur.
- ❌ Pas de validation ICU / couverture des clés en CI.
- ⚠️ 3 libellés sidebar en dur : **« Decision Builder », « Assistant Employeur », « Médias »**.

---

## 2. Stratégie : **garde-fous d'abord, backfill ensuite**

Le site grossit pendant qu'on traduit (Formations, Decision Builder ajoutés ces dernières semaines, tous à 0 %). Si on n'arrête pas l'hémorragie, on traduira éternellement. Donc **Phase A = rendre l'i18n automatique pour tout nouveau code**, *avant* de backfiller l'existant.

---

## 3. Phase A — Future-proofing (features pas encore créées) ⭐

Objectif : qu'un dev (ou une session Claude) **ne puisse pas** livrer une nouvelle feature avec du texte en dur sans que ça soit signalé.

### A.1 — Clés typées (compile-time)
`global.d.ts` à la racine :
```ts
import type fr from "./messages/fr.json";
declare module "next-intl" {
  interface AppConfig { Messages: typeof fr; }
}
```
→ `t("admin.users.titre")` mal orthographié = **erreur TypeScript**. Toute nouvelle feature qui référence une clé absente casse `tsc`. (Vérifier la syntaxe exacte v4 avant merge.)

### A.2 — ESLint anti-hardcoded
Ajouter `eslint-plugin-i18next` (`no-literal-string`) dans `eslint.config.mjs`, **scopé** `app/**` + `components/**`, avec allowlist (attributs techniques, `className`, urls…). Vu que le lint est **déjà rouge (75 erreurs)**, l'introduire en **`warn`** + via lint-staged sur le **diff** (nouveau code seulement) → on ne noie pas, mais tout nouveau string en dur est flaggé.

### A.3 — Validation en CI (`scripts/i18n-validate.ts`, nouveau)
Un script qui : (a) **parse tous les `messages/*.json` en ICU** (catch les pluriels/select malformés — risque réel après les passes agents) ; (b) vérifie que **chaque clé utilisée existe dans `fr.json`** ; (c) **rapporte la couverture par locale** (combien de clés manquent en NL/DE/…). Branché en CI + `package.json` (`i18n:check`).

### A.4 — Formatage centralisé (`lib/i18n/format.ts`, nouveau)
Wrappers locale-aware (`formatDate/formatDateTime/formatNumber/formatCurrency`) basés sur `useFormatter`/`getFormatter` next-intl. **Remplace** les 30 `fr-BE` + 64 `toLocaleX` codés en dur. Règle : tout nouveau formatage passe par là.

### A.5 — Conventions dans `CLAUDE.md` (levier n°1 vu le multi-session)
Bloc i18n dans `CLAUDE.md` : namespaces (`admin.<section>` / `<feature>` public), client→`useTranslations` / serveur→`getTranslations`, jamais de string en dur, format via `lib/i18n/format.ts`, nouveau modèle DB traduisible → `ContentTranslation`. → **chaque future session Claude applique l'i18n par défaut.**

### A.6 — Definition of Done / PR template
Checklist : ☐ zéro string user-facing en dur ☐ clés ajoutées à `fr.json` ☐ formatage locale-aware ☐ champs DB traduisibles branchés sur le mécanisme de traduction.

### A.7 — Scaffolding (optionnel)
Mini-générateur (`plop` ou script) : nouvelle section admin → crée le namespace + le squelette `t()`. Réduit la friction pour faire "bien" par défaut.

> **Livrable Phase A** : à partir de là, toute feature future naît i18n-ready. C'est la réponse directe à « même sur les futurs features ».

---

## 4. Phases B–G — Backfill de l'existant

| Phase | Contenu | Méthode |
|---|---|---|
| **B — Finir l'admin** | Gros composants (chomage-ia, shells, bureaux, documents, page-builder, messagerie) + sections 0% + **nouveaux modules (Formations, Decision Builder, Assistant Employeur)** + fixer les 3 libellés sidebar en dur | Fan-out d'agents par section (méthode déjà éprouvée : fichiers disjoints, chaque agent renvoie ses clés, merge central) |
| **C — Infra publique** | Déplacement **`app/[locale]/`** (public, ~public pages), middleware next-intl, split root layout (`<html lang/dir>`), `hreflang` + `canonical`, **sitemap multilingue** (+ formations/boussole), sweep formatage | Branche dédiée, gros diff mécanique isolé |
| **D — Strings publics** | landing, outils, espaces pros, auth, formations, contact, mon-dossier… | Fan-out d'agents par groupe de routes |
| **E — Transverse** | Emails Resend (extraire de `lib/auth.ts`), messages **Zod** (centraliser en clés + résoudre à la locale), erreurs API (enum + i18n), better-auth, nettoyage toasts | Refactor ciblé ; Zod = le morceau dur |
| **F — Contenu DB** | Migrations additives idempotentes (`ContentTranslation`, `*Translation`, `PageTranslation`, stratégie Formations/Decision) ; UI admin de traduction ; **pipeline Claude + glossaire** FR→7 langues ; relecture native ; trou **DE lookup** (~225k mots, via import CSV ONEM + IA) | ⚠️ Neon partagée : `db execute` additif, **jamais `db push`** |
| **G — Qualité** | Audit **RTL** (arabe : `ml/mr/pl/pr/left/right` → logiques `ms/me/ps/pe/start/end`), QA par locale, bouton « signaler une traduction » | Codemod + revue |

---

## 5. Effort & budget (rafraîchi)

- **Externalisation UI** : ~9 000 strings (≈ 6 800 admin + le reste). Surtout **mécanique** → fan-out d'agents. Le coût est en **temps d'ingénierie**, pas en €.
- **Traduction** (FR→7 langues, après externalisation) : UI ~9k strings ≈ 20-25k mots × 7 ≈ ~150-175k mots cibles → **~3-9k€** (IA + relecture, glossaire injecté). + **DE lookup** ~3-11k€. + **éditorial DB** ~1-4k€. KB IA ≈ 0 (embeddings multilingues).
- **Total traduction réaliste : ~10-25k€**, étalé par vagues. L'**effort d'ingénierie** (externalisation + migration `[locale]`) est le vrai gros poste.

---

## 6. Quick wins immédiats (faibles, à faire dès Phase A)
1. Fixer les **3 libellés sidebar** en dur (`nav.decisionBuilder/assistantEmployeur/medias` + `t()`).
2. Corriger le bug **`fr-FR` → `fr-BE`** dans `app/actualites/*`.
3. Ajouter `global.d.ts` (clés typées) — petit fichier, gros effet.

---

## 7. Ordre recommandé
**A (garde-fous) → B (finir admin) → C (infra publique) → D (strings publics) → E (transverse) → F (DB + traductions) → G (qualité/RTL).**
Garde-fous d'abord = on arrête de créer de la dette pendant qu'on rembourse l'existant.
