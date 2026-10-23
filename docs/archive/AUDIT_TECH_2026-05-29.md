> ⚠️ **PARTIELLEMENT PÉRIMÉ (vérifié 2026-06-28).** Plusieurs items P0/P1 sont déjà
> résolus : `next@16.2.6`, build découplé de `migrate deploy`, `.env.example` complété,
> README/AGENTS en better-auth, `@prisma/client` en deps / `shadcn` en devDeps, `.bak`
> supprimé, `engines` présent. Recouper **toujours** avec
> [`docs/tasks/CONTRADICTIONS.md`](../tasks/CONTRADICTIONS.md) avant d'agir. Sécurité à
> jour : [`AUDIT_RGPD_2026-06-06.md`](AUDIT_RGPD_2026-06-06.md) (plus récent).

# Audit complet — DocBel

> Audit en lecture seule du portail Next.js 16 / React 19 / Prisma 5 / better-auth.
> Périmètre : **211 routes API**, **69 modèles Prisma**, ~496 composants.
> Méthode : 4 vérifications automatisées (tsc, build, vitest, eslint) + 3 analyses
> approfondies (sécurité, qualité de code, dépendances & config).
> Date : 2026-05-29.

## État de santé automatisé

| Vérification | Résultat |
|---|---|
| TypeScript (`tsc --noEmit`) | ✅ **0 erreur** (strict mode activé) |
| Build prod (`next build --webpack`) | ✅ Compile + typecheck OK (~51 s) — échoue seulement à la collecte de pages faute de `BETTER_AUTH_SECRET` en env (normal hors Vercel) |
| Tests (`vitest run`) | ✅ **271 tests / 25 fichiers** passent |
| ESLint (`pnpm lint`) | ❌ **99 problèmes (74 erreurs, 25 warnings)** → exit code 1 |
| Secrets committés | ✅ Aucun ; `.env*` ignorés ; aucun secret en `NEXT_PUBLIC_*` |

**Points forts structurels**
- `next.config.ts` ne masque **aucune** erreur (`ignoreBuildErrors` / `ignoreDuringBuilds` absents), `tsconfig` en `strict: true`.
- `requireAdminAuth` (`lib/auth-check.ts`) revérifie systématiquement en DB le statut `active` **et** le rôle `admin` — le JWT/cookie seul ne suffit pas. 165 appels, aucun helper `requireAdmin` local concurrent.
- Layout `app/admin/layout.tsx` protège toutes les pages `/admin/*` côté serveur.
- Upload de fichiers robuste (ext + MIME + signature magique + taille + quota + SVG forcé privé).
- Pas d'injection SQL (les `$queryRawUnsafe` sont paramétrés, fragments concaténés = constantes).
- Crons protégés par `CRON_SECRET`. Lockout brute-force login (5 échecs / 15 min). Emails entrants assainis (DOMPurify).

---

## 🔴 P0 — Prioritaire

### 1. Vulnérabilités dépendances — `next` 16.2.4
`pnpm audit` : **26 vulns (11 high, 12 moderate, 3 low, 0 critical)**. Les 7 high de `next`
(SSRF, bypass middleware/proxy, DoS Server Components) sont corrigées en **16.2.5/16.2.6**.
- **Action** : `pnpm up next@16.2.6` — ferme à elle seule 11+ vulns.
- `xlsx@0.18.5` : 2 high (prototype pollution + ReDoS) **sans patch sur le registre npm public** → envisager le CDN SheetJS officiel ou migrer vers `exceljs`.

### 2. Rate-limit absent sur endpoints publics
- `app/api/contact-messages/route.ts:33` — POST public → envoi email Resend à chaque appel, **aucun rate-limit** (spam, abus, consommation quota, flood boîte contact). *(Élevé)*
- `app/api/newsletter/route.ts:22` — POST public → `create` en base sans rate-limit (pollution table).
- La lib `lib/documents/rate-limit.ts` existe déjà mais n'est pas appelée ici. ⚠️ Elle est **in-memory par instance** → inefficace en serverless multi-instance ; à porter sur Redis/Upstash à terme.
- `app/api/geocode/route.ts` (+ `/suggest`) : proxy Nominatim sans rate-limit (proxy ouvert + violation politique d'usage Nominatim).

### 3. Couplage migration ↔ build
`build = "prisma migrate deploy && next build --webpack"` : chaque build applique les migrations
à la DB pointée par `DATABASE_URL` au moment du build.
- Un build de preview peut migrer une base partagée.
- La **désynchro documentée des migrations 17-20** (`.work-plan.md`) fera **planter tout le build**.
- **Action** : découpler `migrate deploy` vers une étape de release/CI dédiée + résoudre la désynchro
  (`prisma migrate resolve --applied <name>` ; extension `pgvector` requise pour la migration #19).

### 4. `.env.example` incomplet
Clés utilisées dans le code mais **non documentées** : `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`VOYAGE_API_KEY`, `BRAVE_SEARCH_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `MAX_USER_STORAGE_BYTES`.
→ Onboarding/déploiement cassés sans message clair.

---

## 🟠 P1 — Sécurité moyenne & cohérence

### 5. XSS stocké potentiel — `dangerouslySetInnerHTML` sans DOMPurify
DOMPurify est installé mais appliqué **seulement** aux emails et au changelog. HTML brut non assaini :
`components/docbel/article-view.tsx:91`, et blocs page-builder `html-raw.tsx:22`, `text.tsx:42`,
`card.tsx:78`, `embed.tsx:40`, `svg-illustration.tsx:34`, `custom-css.tsx:21`,
`magazine-columns.tsx:53`. Risque limité au rôle admin/éditeur — à confirmer selon qui peut éditer.

### 6. `new Function()` côté client
`components/page-blocks/engagement/calculator.tsx:44` : `safeEval` exécute une formule de bloc
dans le navigateur du visiteur → exécution JS arbitraire si la formule est compromise.

### 7. Cookie `beldoc-bundle-session` en `httpOnly:false`
`app/api/bundles/resume/route.ts:105` → exfiltrable par XSS, alors qu'il donne accès à des données
nominatives de formulaire.

### 8. Documentation trompeuse — « NextAuth v5 »
README (`:12, :85`) et `AGENTS.md:26` annoncent **NextAuth v5**, mais le code utilise **better-auth**
(`package.json`, `lib/auth.ts`, `app/api/auth/[...all]/route.ts` ; zéro import `next-auth`).
Variables documentées fausses : `NEXTAUTH_SECRET`/`NEXTAUTH_URL` au lieu de
`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`NEXT_PUBLIC_BETTER_AUTH_URL` → **casse le déploiement**.
`AGENTS.md` référence aussi `auth.ts` alors que le fichier est `lib/auth.ts`.

### 9. Classement des dépendances
- `@prisma/client` est en `devDependencies` alors qu'il est **runtime** → casserait une install `--prod`.
- `shadcn` (CLI de scaffolding) est en `dependencies` runtime → source de la majorité des vulns
  transitives (`fast-uri`, `hono`, MCP SDK). À déplacer en devDeps (ou retirer au profit de `pnpm dlx`).

### 10. Contrôle d'accès via session cachée
`app/api/files/[id]/download/route.ts:70` et `documents/generated/[id]/download/route.ts:46` lisent
le rôle depuis la session better-auth en cache (`cookieCache` 5 min) au lieu de re-requêter la DB
comme `requireAdminAuth` → un admin rétrogradé garde l'accès jusqu'à 5 min. *(Faible)*

### 11. `baremes/export` GET public
`app/api/baremes/export/route.ts:5` exporte n'importe quel `bareSheet`/`bareFile` par ID en CSV sans
auth. OK seulement si ces tables ne contiennent que des données publiques — **à confirmer**.

---

## 🟡 P2 — Dette technique & qualité

### 12. ESLint : 99 problèmes (74 erreurs)
- 47 `react-hooks/set-state-in-effect` (ironiquement interdits par `AGENTS.md`)
- 21 `@typescript-eslint/no-unused-vars`, 15 `react/no-unescaped-entities`,
  7 `react-hooks/static-components`, 4 `exhaustive-deps`, divers.
- 73 `eslint-disable` dans le code, dont 9 masquant des `any`.

### 13. Validation Zod non généralisée
**33/211 routes** seulement utilisent Zod ; régime hétérogène (validation manuelle ailleurs).

### 14. Dette de typage
- **117 `as unknown as`**, 10 `any` explicites (+ 9 masqués par disable).
- Cast `(session.user as { role?: string })` répété **8 fois** (`header.tsx:101`, `app/admin/page.tsx:14`,
  `chomage/preavis/page.tsx:10`, `changelog/page.tsx:13`, `files/[id]/download/route.ts:70`,
  `tools/[slug]/route.ts:69,97`, `generated/[id]/download/route.ts:47`) → factoriser via `declare module`.

### 15. Rôles incohérents
- `moderator` : présent dans l'enum mais **aucune route ne l'autorise** → ne donne accès à rien de plus
  qu'un `user` (incohérence trompeuse).
- `requirePartnerOrAdminAuth` défini (`lib/auth-check.ts:85`) mais utilisé par **0 route API**.

### 16. Tests manquants sur le métier critique
- `lib/calculators/` (IPP, préavis, allocs-fam, km, pécule, indemnité, tarif social ;
  `_methodology.ts` = 2828 lignes) : **0 test** alors qu'il s'agit de **montants légaux**.
- `lib/auth*` / `lib/auth-check.ts`, `lib/chomage-ia/`, `lib/bundles/` : **0 test**.
- Routes `app/api/**` (211) : **0 test d'intégration**.
- Bien couvert : `lib/baremes`, `lib/bureaus`, `lib/lookup`, `lib/documents`, `lib/pdf-forms`, `lib/pdf-canvas`.

---

## 🟢 P3 — Nettoyage & structure

### 17. Résidus
- `lib/lucide-icons-catalog.ts.bak` à supprimer.
- 9 `scripts/debug-*.ts` non référencés par `package.json` (sort à clarifier).

### 18. TODO obsolètes/trompeurs
Les backends pin/archive/duplicate/delete du chat IA **existent déjà**
(`app/api/chomage-ia/sessions/[id]/route.ts` PATCH, `messages/[id]/route.ts` DELETE), mais
`sessions-rail.tsx`, `message-bubble.tsx`, `chat-full-shell.tsx` gardent des `TODO(backend)` et
fallbacks « Bientôt disponible » morts → à nettoyer pour éviter la confusion.
TODO réels restants : intégrations `lib/pdf-forms/integrations/itsme.ts:100` & `doccle.ts:46`
(stubbées), `app/api/pdf/[slug]/prefill/callback/route.ts:27`.

### 19. Monolithes à découper
`components/docbel/file-manager.tsx` (1976 l.), `components/admin/chomage-ia/chat/chat-full-shell.tsx`
(1407 l.), et 7 `components/docbel/calculators/calc-*.tsx` (>880 l.) à structure factorisable.

### 20. AGENTS.md obsolète
La note « `#C8102E` dupliquée dans ~20 fichiers » est fausse : **4 occurrences seulement**, et
l'accent réel de l'app est `#7C3AED` (`app/globals.css:20`). `<UserFormFields/>` reste à extraire
(`components/users/create-user-dialog.tsx` 270 l. + `edit-user-dialog.tsx` 296 l.).

### 21. Cohérence runtime / env
- README dit « pnpm 11+ » mais `packageManager: pnpm@10.33.2` ; aucun champ `engines` ;
  `@types/node@20` alors que Node 22 tourne.
- `.env.example` : `LOG_LEVEL` mort (le code lit `DATABASE_LOG_LEVEL`) ; `DOCCLE_SENDER_ID` non câblé.
- Majors lourdes en retard (hors hotfix) : Prisma 5→7, TipTap 2→3, resend 4→6, eslint 9→10, TS 5→6,
  zustand 4→5, @hookform/resolvers 3→5.

---

## Quick wins recommandés (faible risque, fort impact)

1. `pnpm up next@16.2.6` (ferme 11+ vulns).
2. Rate-limit sur `contact-messages` + `newsletter`.
3. DOMPurify sur articles + blocs page-builder rendant du HTML brut.
4. Corriger README + AGENTS.md (better-auth, variables `BETTER_AUTH_*`).
5. Compléter `.env.example` (clés IA, Blob, quota).
6. Déplacer `@prisma/client` en `dependencies` et `shadcn` en `devDependencies`.
7. Supprimer `lib/lucide-icons-catalog.ts.bak`.
