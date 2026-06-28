# CLAUDE.md — Démarrage de session DocBel

Portail belge d'aide administrative (chômage / CPAS / emploi) : pages publiques,
back-office admin, API REST, onboarding/boussole, dossiers dynamiques, outils,
calculateurs, page-builder, i18n. Next.js 16 / React 19 / Prisma 5 / better-auth.

> **Règle d'or : une session = un objectif précis.** Ne pas ré-auditer le projet
> ni partir en refonte globale. Lire le strict nécessaire, agir par petits lots.

## Lire par défaut (chaque session)
- `README.md` — install + commandes
- `AGENTS.md` — règles critiques + index des règles spécialisées
- `docs/context/PROJECT_INDEX.md` — carte du projet + où trouver quoi
- `docs/tasks/NEXT_ACTIONS.md` — les prochaines actions priorisées

## Lire seulement si la tâche le demande
- Design / UI front ou admin → `docs/context/DESIGN_RULES.md`
- Routes API / auth / sécurité → `docs/context/API_SECURITY_RULES.md`
- Textes user-facing / traductions → `docs/context/I18N_RULES.md`
- Shell, dashboards, routes lourdes → `docs/context/PERFORMANCE_RULES.md`
- Périmètre / quoi shipper en V1 → `docs/tasks/MVP_SCOPE.md`
- Sécurité technique → `docs/tasks/SECURITY_QUEUE.md`
- Conformité → `docs/tasks/RGPD_QUEUE.md`
- Dette / nettoyage → `docs/tasks/CLEANUP_QUEUE.md`, `docs/tasks/TECH_DEBT_QUEUE.md`

## Lire seulement si explicitement demandé
- `docs/audits/AUDIT_TECH_2026-05-29.md` — **partiellement périmé** (cf. CONTRADICTIONS)
- `docs/audits/AUDIT_RGPD_2026-06-06.md` — source RGPD de référence (volumineux)
- `docs/archive/**` — livraisons historiques, **ne pas lire par défaut**

## Stack (vérifier le code, pas la mémoire du modèle)
Next 16.2.6 · React 19.2 · TS 5 strict · Prisma 5.22 + PostgreSQL/Neon ·
better-auth 1.6 · Tailwind 4 + shadcn (base-ui) · next-intl 4 · Zod 4 · Tiptap 2 · pnpm 10.

## Commandes de validation
```bash
pnpm lint          # ESLint (⚠️ ~74 erreurs PRÉ-EXISTANTES, ne pas en ajouter)
pnpm test          # vitest (271 tests)
pnpm build         # build + typecheck (PAS de "pnpm typecheck")
pnpm i18n:check    # ICU + couverture des langues
```

## Interdictions absolues
- ❌ `prisma db push` sur la base Neon (partagée) → détruit pgvector + tables PDF.
  Schéma : SQL **additif** via `prisma db execute`.
- ❌ Committer `.env` / `.env.local` / `*.db`.
- ❌ `git add -A` / large : le workdir est **partagé multi-agents** → `git add` de
  chemins **explicites** uniquement. Jamais `--force` sur `main`.
- ❌ `setState` synchrone dans un `useEffect` (ESLint refuse).
- ❌ `bg-white` / `#FFFFFF` en dur sur le front (glass mauve).
- ❌ Refonte globale, migration majeure de dépendance, ou nouvelle dépendance
  sans justification explicite.

## Façon de travailler
- **Quick wins sûrs** uniquement en code spontané ; sinon, ajouter à `NEXT_ACTIONS.md`.
- Max **3 à 5 fichiers** par lot de code.
- Toute modif : dire **quoi / pourquoi / risque / commande de validation / écran à vérifier**.
- Ne pas marquer « fait » ce qui est seulement planifié.

## Priorités actuelles (résumé — détail dans NEXT_ACTIONS.md)
1. **RGPD publiable** (bloquant V1) : pages légales + bannière consentement + Analytics gated.
2. **Sécurité quick wins** : secret NRN sans fallback, headers HTTP, rate-limit endpoints publics.
3. **MVP clair** : recentrer sur accueil / onboarding / dossiers / reprise / contenus / admin minimal.
4. **Dette** : ESLint, Zod généralisé, tests des calculateurs (montants légaux), monolithes.
