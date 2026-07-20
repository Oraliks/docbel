# AGENTS.md

Guide pour Codex / Claude Code sur ce dépôt. Démarrage de session : voir
[`CLAUDE.md`](CLAUDE.md). Installation/commandes : [`README.md`](README.md).

> **Une session = un objectif précis.** Pas de ré-audit global, pas de refonte.
> Lire le nécessaire, agir par lots de **3–5 fichiers max**.

## Vue d'ensemble
**DocBel** = portail Next.js pour les citoyens belges (chômage, CPAS, emploi) : pages
publiques, back-office admin, API REST, onboarding/boussole, dossiers dynamiques, outils,
calculateurs, page-builder, i18n. Carte du code : [`docs/context/PROJECT_INDEX.md`](docs/context/PROJECT_INDEX.md).

## Stack — ne pas se fier au training data
Next 16.2.6 · React 19.2 · TS 5 strict · Prisma 5.22 + PostgreSQL/Neon · better-auth 1.6
(**pas NextAuth**, config unique [`lib/auth.ts`](lib/auth.ts)) · Tailwind 4 + shadcn (base-ui) ·
next-intl 4 · Zod 4 · Tiptap 2 · pnpm 10. Détail + commandes :
[`docs/context/STACK_AND_COMMANDS.md`](docs/context/STACK_AND_COMMANDS.md).

## Règles spécialisées (lire selon la tâche)
- 🎨 UI front/admin → [`docs/context/DESIGN_RULES.md`](docs/context/DESIGN_RULES.md)
- 🔐 Routes API / auth / sécurité → [`docs/context/API_SECURITY_RULES.md`](docs/context/API_SECURITY_RULES.md)
- 🌍 Texte user-facing → [`docs/context/I18N_RULES.md`](docs/context/I18N_RULES.md)
- ⚡ Shell / dashboards / routes lourdes → [`docs/context/PERFORMANCE_RULES.md`](docs/context/PERFORMANCE_RULES.md)
- ✅ Quoi faire ensuite → [`docs/tasks/NEXT_ACTIONS.md`](docs/tasks/NEXT_ACTIONS.md)

## Règles critiques (à respecter sans relire les docs spécialisées)
**Données / DB**
- ❌ **Jamais `prisma db push`** sur la Neon partagée (détruit pgvector + tables). SQL
  **additif** via `prisma db execute`. Index : additifs (`CREATE INDEX CONCURRENTLY`).
- `findMany` **toujours borné** par un `take` ; pagination/filtres côté DB.

**API / auth**
- `requireAdminAuth` ([`lib/auth-check.ts`](lib/auth-check.ts)) en tête de toute route qui
  modifie ou expose du privé — elle revérifie le statut/rôle en DB. Un seul helper.
- `params` est un `Promise` (Next 16). Réponses JSON en `charset=utf-8`.
- Ne pas hardcoder de secret de fallback ; endpoints publics → rate-limit.

**React**
- ❌ Pas de `setState` synchrone dans un `useEffect` (ESLint refuse).

**Design (résumé — détail dans DESIGN_RULES)**
- Front public = **glass mauve** (`.glass-root`) ; admin/pro/auth = **shadcn palette**
  (jamais de verre). ❌ `bg-white`/`#FFFFFF` en dur sur le front.
- Front : pas de `max-w-*`/`container`/`mx-auto` sur la **racine** d'une page (le shell
  centre déjà). Admin : **pleine largeur**, pas de `max-w-*` étroit sur le conteneur de page.

**i18n**
- Tout texte user-facing passe par next-intl (clés typées → une clé absente casse `tsc`).
  Jamais de locale codée en dur. Valider `pnpm i18n:check`.
- **Dates/heures : format FIXE partout, indépendant de la langue UI** — `JJ/MM/AAAA`
  (ex. `10/07/2026`) et heures en **24h** (ex. `14:30`, jamais AM/PM). Utiliser
  `formatDate`/`formatDateTime` (`lib/i18n/format.ts`) sans `options` → convention
  appliquée par défaut. Ne pas écrire de `toLocaleDateString`/réimplémentation locale.

**PDF Forms bindings** (Phase 1-7 du plan pdf-bindings-canonical-ux, mergé)
- 3 couches à ne pas confondre :
  1. **Schéma enrichi** (`lib/pdf-forms/seed/*.ts`) : `PdfFormField.pdfFieldName` mappe
     un champ à UN widget AcroForm — mécanisme historique. Support `canonicalKey`
     (identity.nom, banque.iban…) pour prefill croisé auto entre docs d'un même run.
  2. **Bindings serveur** (`lib/pdf-forms/bindings/`) : règles DÉCLARATIVES par slug qui
     stampent des widgets APRÈS le mapping schéma. Ajouter une règle = éditer
     `bindings/per-form/<slug>.ts` + référencer dans `bindings/registry.ts`.
  3. **Transforms client historiques** (`lib/pdf-forms/c1-*.ts`) : encore actifs en
     coexistence — retrait gaté sur validation prod (Phase 7 stricte). Les règles
     serveur SONT IDEMPOTENTES par-dessus (mêmes valeurs mêmes widgets) — ajouter
     une règle qui écrase une transform est safe.
- Debug : onglet « Mapping AcroForm » sur `/admin/pdf/[id]` — compteurs bound/orphan/
  conflict + tableau des claims (source: field/pipe/array/rule).
- URL SEO : `PdfForm.publicPath` (ex. "onem/c1"). Attribuer une nouvelle URL = éditer
  l'input « URL publique (SEO) » dans l'onglet Paramètres. Le catch-all
  `app/document/[...path]/page.tsx` redirige 308 slug → publicPath quand présent.

**Vérification réglementaire (chômage)**
- Tout lot touchant `lib/calculators/**`, un arbre de décision / runtime d'orientation,
  `lib/pdf-forms/seed/**`, `docs/knowledge/chomage/**`, ou un contenu affirmant des
  conditions / montants / durées : lancer **`/verif-reglementation`** (ou dispatcher le
  sous-agent `verif-reglementation`) **avant commit**. Rapport informatif, **jamais bloquant**.
  Charte : [`docs/agents/chomage/AGENT_CHOMAGE.md`](docs/agents/chomage/AGENT_CHOMAGE.md).

## Modèle utilisateur (résumé)
Rôles `UserRole` : `user`, `partner`, `employer`, `moderator`, `admin` (+ `segment`,
`partnerType` ; accès outils via `canUseTool` [`lib/entitlements.ts`](lib/entitlements.ts)).
Statuts : `active`/`pending`/`disabled`/`locked`. 5 échecs login ⇒ lock 15 min. bcrypt cost 10.
⚠️ `moderator` n'ouvre aucune route de plus qu'un `user` ; `requirePartnerOrAdminAuth`
défini mais inutilisé (dette — cf. TECH_DEBT_QUEUE).

## Ne pas faire
- ❌ Committer `.env` / `.env.local` / `*.db`.
- ❌ `git add -A` / large : **workdir partagé multi-agents** → `git add` de chemins
  **explicites** ; jamais `--force` sur `main`.
- ❌ Hardcoder `createdBy:"admin"` / `logActivity("Admin",…)` → `authCheck.user.id/.name`.
- ❌ Répéter `(session.user as { role?: string })` (dette connue) → `declare module`.
- ❌ Nouvelle dépendance ou major upgrade sans justification (cf. TECH_DEBT_QUEUE).

## Validation
```bash
pnpm lint     # ⚠️ ~74 erreurs PRÉ-EXISTANTES — ne pas en ajouter (pas de zéro forcé)
pnpm test     # vitest (271 tests)
pnpm build    # build + typecheck (PAS de "pnpm typecheck")
pnpm i18n:check
```

## Priorités projet
RGPD publiable (bloquant V1) > quick wins sécurité > recentrage MVP > dette.
Détail : [`docs/tasks/`](docs/tasks/) (NEXT_ACTIONS, MVP_SCOPE, SECURITY_QUEUE, RGPD_QUEUE,
CLEANUP_QUEUE, TECH_DEBT_QUEUE, CONTRADICTIONS).
