# SECURITY_QUEUE — File sécurité technique

Source : `docs/audits/AUDIT_TECH_2026-05-29.md` (partiellement périmé) + `AUDIT_RGPD_2026-06-06.md`
(Axe 4, plus récent). Format par item : **risque · scénario · correction · validation**.
Voir CONTRADICTIONS.md : certains items de l'audit tech sont déjà résolus.

## S1 — Secret NRN avec fallback hardcodé (P0)
- **Risque** : secret `"docbel-booking-nrn-fallback"` dans le repo public → si
  `BOOKING_NRN_SECRET` absent en prod, HMAC+AES NRN reposent sur un secret connu.
- **Scénario** : déploiement sans la var → NRN déchiffrables / dedupe forgeable.
- **Correction** : `lib/booking/crypto-nrn.ts` + `lib/booking/dedupe.ts` → lire la var,
  `throw` si absente. S'assurer que la var existe sur Vercel **avant** de merger.
- **Validation** : `pnpm test` ; boot dev avec/sans la var.

## S2 — Aucun header de sécurité applicatif (P1)
- **Risque** : pas de CSP / HSTS / X-Frame-Options / Referrer-Policy / Permissions-Policy.
- **Scénario** : clickjacking, downgrade, fuite de referrer.
- **Correction** : `next.config.ts` → `headers()`. Démarrer **CSP en report-only** pour
  ne rien casser, puis durcir.
- **Validation** : `pnpm build` ; vérifier les en-têtes + console sans violation bloquante.

## S3 — Rate-limit absent sur endpoints publics (P1)
- **Risque** : spam / flood / pollution table / abus quota email.
- **Scénario** : POST en boucle sur `contact-messages` (envoi Resend) ou `newsletter`.
- **Correction** : appliquer un rate-limit (lib existante en attendant Upstash) sur
  `contact-messages`, `newsletter`, et le catch-all `auth/[...all]` (credential stuffing).
- **Validation** : test manuel (POST répétés → 429).

## S4 — Rate-limit in-memory inefficace en serverless (P2)
- **Risque** : `lib/utils/rate-limit.ts` (+ `lib/pdf-forms/security.ts`) = `Map` par instance
  → quasi inopérant sur Vercel (cold starts).
- **Correction** : migrer vers Upstash (`@upstash/ratelimit`+`redis`), fusionner les 2 libs.
  Var `RATE_LIMIT_REDIS_URL` semble prévue. **Plan dédié** (dépendance + infra).
- **Validation** : test multi-instances.

## S5 — Contrôle d'accès via session cachée (P2, faible)
- **Risque** : `files/[id]/download` et `documents/generated/[id]/download` lisent le rôle
  depuis le cache session (5 min) → admin rétrogradé garde l'accès jusqu'à 5 min.
- **Correction** : re-requêter la DB comme `requireAdminAuth`.
- **Validation** : test rétrogradation.

## S6 — `baremes/export` GET public (P2, à confirmer)
- **Risque** : export CSV de n'importe quel `bareSheet`/`bareFile` par ID sans auth.
- **À confirmer** : ces tables ne contiennent-elles que du public ? Si non → auth.
- **Validation** : revue de contenu des tables.

## S7 — CRLF injection header `From:` contact (P3)
- **Correction** : `app/api/contact-messages/route.ts` → rejeter `/[\r\n]/` dans name/email.

## S8 — Divers (P3)
- Mot de passe min 8 (better-auth) vs 10 (`lib/users.ts`) non branché → aligner ≥12.
- MFA admin absent. Session admin 30 j (longue). Tokens OAuth `Account` en clair.
- Secret unique `BETTER_AUTH_SECRET` pour 4 usages crypto → découper.

## À VÉRIFIER avant d'agir (contradiction inter-audits)
- **V1** : sanitization HTML — RGPD dit « tous les 17 `dangerouslySetInnerHTML` assainis »
  via `lib/sanitize-html.ts`. **Vérifier** `article-view.tsx` + blocs page-builder
  (`html-raw`, `text`, `card`, `embed`, `svg-illustration`, `custom-css`, `magazine-columns`)
  avant toute correction. Si déjà couvert → clore, sinon → P1.
- **V2** : cookie `beldoc-bundle-session` — RGPD dit httpOnly OK. **Vérifier**
  `app/api/bundles/resume/route.ts` puis clore.
- **V3** : `new Function()` côté client `calculator.tsx` (`safeEval`) — confirmer la surface
  (formule éditée par admin uniquement ?) ; sinon durcir/sandbox.

> Items sécurité **liés au RGPD** (chiffrement NISS, purge NRN, `citizenNrnEnc`, DPA,
> région Neon) : voir `docs/tasks/RGPD_QUEUE.md`.
