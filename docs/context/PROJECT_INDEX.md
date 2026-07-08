# PROJECT_INDEX — Carte de DocBel

Lecture par défaut. But : trouver **où vit quoi** sans grep aveugle ni audit global.
Le code en contient plus que les noms de fichiers ne le laissent croire — **grep avant
de proposer un nouveau modèle/fichier**.

## Zones fonctionnelles → langage de design
| Zone | Routes | Design |
|------|--------|--------|
| Front public | `/`, `/actualites`, `/outils*`, calculateurs, `/contact`, `/profil`, `/mon-dossier`, `/onboarding`, `/reprendre`, `/p/*` | **Glass mauve** (`.glass-root`) |
| Pro connecté | `/partenaire*`, `/employeur*` | **shadcn palette** (`ProShell`) |
| Back-office | `/admin/**` | **shadcn palette** (`AppSidebar`) |
| Auth | `/login`, `/inscription*`, `/mot-de-passe-*` | shadcn split full-page |

Source de vérité du routage de chrome : `resolveProSegment` + early-returns dans
`components/docbel/app-layout-client.tsx`.

## Briques métier (lib/)
- **Auth** : `lib/auth.ts` (config unique), `lib/auth-check.ts` (`requireAdminAuth`).
- **Utilisateurs / accès** : `lib/users.ts`, `lib/entitlements.ts` (`canUseTool`).
- **Dossiers dynamiques** : `lib/documents/bundle-conditions.ts` (moteur AND/OR V2),
  `lib/bundles/` (resume-code, eligibility, vocabulary, types/LIFE_EVENT_CATEGORIES).
- **Calculateurs** (montants légaux) : `lib/calculators/` (IPP, préavis, allocs-fam, km,
  pécule, indemnité, tarif social ; `_methodology.ts` ~2828 l.). ⚠️ **0 test** aujourd'hui.
- **Booking / RDV** : `lib/booking/` (crypto-nrn, dedupe, status, partner-guard, notify).
- **NRN belge** : `lib/booking/crypto-nrn.ts`, `lib/booking/dedupe.ts` (HMAC+AES).
- **IA chômage / RAG** : `lib/chomage-ia/` (web-search, embeddings, RAG).
- **Page-builder** : schémas Zod = source de vérité (`registry.ts`, `schemas.ts`),
  store Zustand `lib/page-builder/store.ts`.
- **PDF Forms** : `lib/pdf-forms/`, `lib/pdf-canvas/`.
  - **Bindings serveur** (`lib/pdf-forms/bindings/`) : moteur pur qui évalue des
    règles déclaratives (`when` + `stampFn`) et produit une Map `widget → valeur`,
    appliquée par `fillForm` APRÈS le mapping schéma standard. Ajouter une règle =
    éditer `bindings/per-form/<slug>.ts` puis référencer dans `bindings/registry.ts`.
  - **Vocabulaire canonique** (`lib/pdf-forms/canonical/`) : clés sémantiques
    partagées entre formulaires (`identity.nom`, `banque.iban`…). `canonicalKey` sur
    `PdfFormField` → pré-remplissage automatique cross-document dans un même run.
  - **Rapport de mapping** (`lib/pdf-forms/mapping-report.ts`) : vue « widget par
    widget » avec claims + statuts (bound / orphan / conflict) — consommé par
    l'onglet admin « Mapping AcroForm » sur `/admin/pdf/[id]`.
  - **URL publique** : PdfForm porte `publicPath` (ex. `"onem/c1"`). Le catch-all
    `app/document/[...path]/page.tsx` résout 1-segment par slug (redirect 308 vers
    publicPath si présent) et 2+ segments par publicPath.
- **i18n** : `i18n/locales.ts` (registre), `lib/i18n/format.ts`, `messages/*.json`.
- **Sanitization** : `lib/sanitize-html.ts` (isomorphe).
- **Glass helpers** : `lib/glass-classes.ts`.

## API (app/api/**)
- ~211 routes, fonctions HTTP exportées par `route.ts`. `params` est un `Promise`.
- Auth sensible : `requireAdminAuth` en tête de route.
- Endpoints publics notables : `contact-messages`, `newsletter`, `geocode(+/suggest)`,
  `intent-detect`, `bundles/resume`, `baremes/export`.
- Crons : protégés par `CRON_SECRET` (`vercel.json`).

## Données (Prisma)
- 69 modèles. Migrations nombreuses (jusqu'à ~54 : Decision Builder). Désynchros
  historiques 17-20 (pgvector). **Ne jamais `db push`** sur Neon partagée.
- Modèles sensibles : `UserProfile` (NISS/IBAN/organismePaiement/mutuelleCode),
  `Booking`, `BundleRun` (payloads), `Account` (tokens OAuth en clair).

## Documentation existante (ne pas recréer)
- i18n : `docs/i18n-conventions.md`, `docs/i18n-rollout-plan.md`, `docs/i18n-glossaire.md`,
  `docs/i18n-systeme.md`, `docs/i18n-implementation-plan.md`, `docs/i18n-remaining-plan.md`.
- Perf : `docs/performance.md`. Booking : `docs/booking.md`.
- Formations : `docs/formations-decisions.md`, `docs/formations-api-setup.md`.
- KBO : `docs/TODO-kbo-activation.md`.

## Pièges connus
- `app/[slug]` est un **catch-all** (attention aux nouvelles routes / i18n).
- `Select` = base-ui : garder le wrapper du repo (sinon affiche la valeur brute `__none__`).
- Zod 4 : `.prefault({})` (pas `.default({})`) pour deep-fill ; base-ui Button/Badge = prop `render`.
- lucide-react v1 (icônes renommées, alias conservés).
