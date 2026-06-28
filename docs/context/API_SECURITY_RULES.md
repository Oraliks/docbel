# API_SECURITY_RULES — Conventions API & sécurité

Lecture **quand on touche aux routes / à l'auth / aux données sensibles**.

## Conventions API
- Routes dans `app/api/**/route.ts`, fonctions HTTP exportées (`GET/POST/PATCH/PUT/DELETE`).
- `params` est un **`Promise`** (Next 16) → `const { id } = await params`.
- **Auth admin** : `requireAdminAuth` (`lib/auth-check.ts`) en tête de toute route qui
  modifie des données ou expose du privé. Elle **revérifie en DB** que l'utilisateur est
  encore `active` ET `admin` (le JWT/cookie seul ne suffit pas). Un seul helper — ne pas
  recréer de `requireAdmin` local.
- **Réponses JSON** : `headers: { "Content-Type": "application/json; charset=utf-8" }`
  (préserve les accents).
- **Pagination** : `findMany` **toujours borné** par un `take` raisonnable ; pagination +
  filtres côté DB (`where`, `take`/`skip`), jamais charger toute la table puis filtrer en JS.
- **Validation** : Zod installé mais **non généralisé** (~33/211 routes). Préférer Zod sur
  toute nouvelle route ; ne pas régresser vers la validation manuelle.

## Modèle utilisateur
- Rôles enum `UserRole` : `user`, `partner`, `employer`, `moderator`, `admin`. Le compte
  porte aussi `segment` (`citoyen`/`employeur`/`partenaire`) + `partnerType` ; accès outils
  via `canUseTool` (`lib/entitlements.ts`).
- Statuts : `active`, `pending`, `disabled`, `locked`. 5 échecs login ⇒ lock 15 min.
- Mots de passe bcrypt (cost 10). Helpers `lib/users.ts` (`validatePassword`, `isUserRole`,
  `normalizeEmail`, `serializeUser`, `SAFE_USER_SELECT`).
- ⚠️ `moderator` n'autorise **aucune** route de plus qu'un `user` (enum trompeur) ;
  `requirePartnerOrAdminAuth` défini mais inutilisé. Dette connue.

## Fichiers & stockage
- Upload via `app/api/files/upload/route.ts` : valide extension + MIME + signature magique
  + taille (25 Mo) + quota + SVG forcé privé. Stockage `public/uploads/` ou `private/uploads/`.
- Fichiers privés : téléchargeables seulement authentifié admin via `files/[id]/download`.

## Sécurité — acquis (ne pas casser)
- NRN : HMAC-SHA256 + AES-256-GCM (`lib/booking/crypto-nrn.ts`, `dedupe.ts`).
- IP hashées (SHA256) avant stockage ; tokens reset 1h / magic-link 15 min.
- Sanitization HTML isomorphe `lib/sanitize-html.ts` sur les `dangerouslySetInnerHTML`.
- `timingSafeEqual` sur tokens PDF ; `trustedOrigins` better-auth (CSRF) ; crons `CRON_SECRET`.
- Pas d'injection SQL (`$queryRawUnsafe` paramétrés).

## Sécurité — règles
- Ne **jamais** hardcoder un secret de fallback (cf. `BOOKING_NRN_SECRET`) → `throw` au boot.
- Ne pas lire le rôle depuis la session en cache pour des décisions sensibles → re-requêter
  la DB comme `requireAdminAuth`.
- Endpoints publics (`contact-messages`, `newsletter`, `geocode`, `auth/[...all]`) → rate-limit.
  ⚠️ `lib/utils/rate-limit.ts` est **in-memory** (inefficace en serverless) → cible Upstash.
- Ne pas exposer de PII via une route GET non authentifiée (vérifier `baremes/export`).

## Ne pas faire
- ❌ Committer `.env*` / `.db`.
- ❌ Hardcoder `createdBy: "admin"` / `logActivity("Admin", …)` → `authCheck.user.id/.name`.
- ❌ Répéter `(session.user as { role?: string })` (dette de typage connue, ~8 fois) →
  factoriser via `declare module` quand on y touche.

> Détail des actions sécurité ouvertes : `docs/tasks/SECURITY_QUEUE.md`.
> Détail conformité (NRN, art. 9, transferts) : `docs/tasks/RGPD_QUEUE.md`.
