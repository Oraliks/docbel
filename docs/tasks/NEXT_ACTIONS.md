# NEXT_ACTIONS — Prochaines actions DocBel

Lisible en 2 minutes. Ordre = ordre d'exécution réel. Détail par item dans les queues
spécialisées. Statuts : `à faire` / `en cours` / `bloqué` / `fait`.
Légende priorité : **P0** critique · **P1** important · **P2** souhaitable · **P3** confort.

> Beaucoup d'items « tech » de l'audit 05-29 sont **déjà résolus** (cf. CONTRADICTIONS.md).
> Le vrai bloquant de publication est **RGPD**, pas la dette technique.

| # | Prio | Cat. | Objectif | Fichiers probables | Risque | Validation | Statut |
|---|------|------|----------|--------------------|--------|------------|--------|
| 1 | P0 | RGPD | Gater `<Analytics/>` + `<PageViewBeacon/>` derrière consentement (ou désactiver en attendant le CMP) | `app/layout.tsx`, `app/[slug]/page.tsx` | Faible (retrait), Moyen (gate) | `pnpm build` + écran accueil | à faire |
| 2 | P0 | Sécurité | Supprimer le fallback hardcodé du secret NRN → `throw` au boot | `lib/booking/crypto-nrn.ts`, `lib/booking/dedupe.ts` | Moyen (env prod doit exister) | `pnpm test` + boot dev | à faire |
| 3 | P0 | RGPD | Créer `/mentions-legales`, `/politique-confidentialite`, `/politique-cookies` (brouillons + placeholders, **à valider juriste**) | page-builder ou routes `app/`, template `legal` existant | Faible | navigation + liens | à faire |
| 4 | P0 | RGPD | Câbler les 3 liens morts du footer (`href="#"`) | `components/docbel/landing/footer.tsx` | Faible | écran footer | à faire |
| 5 | P0 | RGPD | Corriger la déclaration fausse « Aucun cookie de pistage tiers » | `lib/app-settings.ts` | Faible | relecture | à faire |
| 6 | P1 | Sécurité | Bannière de consentement (2 catégories min + « Gérer mes cookies ») | `components/cookie-consent/*`, `app/layout.tsx` | Moyen | écran accueil + reload | à faire |
| 7 | P1 | Sécurité | Headers HTTP (HSTS, XFO, Referrer-Policy, Permissions-Policy, CSP report-only) | `next.config.ts` | Moyen (CSP peut casser) → report-only d'abord | `pnpm build` + console | à faire |
| 8 | P1 | Sécurité | Rate-limit sur `contact-messages`, `newsletter`, `auth/[...all]` | `app/api/contact-messages/route.ts`, `app/api/newsletter/route.ts` | Faible | test manuel POST | à faire |
| 9 | P1 | Sécurité | **Vérifier** (pas corriger d'office) : sanitization HTML réellement appliquée + cookie bundle httpOnly | `lib/sanitize-html.ts`, `app/api/bundles/resume/route.ts` | — | grep + lecture | à faire |
| 10 | P1 | MVP | S'assurer que intent-detect/voice **dégradent proprement** quand OFF (publier sans IA) | `app/api/intent-detect/route.ts`, toggles | Faible | test toggle OFF | à faire |
| 11 | P1 | Dette | Tests des calculateurs (montants légaux) — au moins préavis + IPP | `lib/calculators/__tests__/*` | Faible | `pnpm test` | à faire |
| 12 | P2 | RGPD | Endpoints droits : export (`/api/me/export`) + suppression (`/api/me/delete`) + FK Cascade | `app/api/me/*`, `prisma/schema.prisma` (SQL **additif**) | Élevé (migration) → plan dédié | `pnpm test` | à faire |
| 13 | P2 | Sécurité | Migrer rate-limit en mémoire → Upstash | `lib/utils/rate-limit.ts` | Moyen | test charge | à faire |
| 14 | P2 | RGPD | Registre des traitements + procédure violation (docs internes) | `docs/rgpd/*` | Faible | relecture | à faire |
| 15 | P2 | Dette | Généraliser Zod sur les nouvelles routes ; factoriser le cast session (`declare module`) | routes API, types session | Moyen | `pnpm build` | à faire |
| 16 | P3 | Dette | Découper monolithes (`file-manager.tsx`, `chat-full-shell.tsx`, `calc-*.tsx`) | composants ciblés | Moyen | `pnpm build` + écrans | à faire |
| 17 | P3 | Dette | Réduire ESLint (cibler `set-state-in-effect`, unused-vars) sans tout casser | divers | Moyen | `pnpm lint` (delta) | à faire |
| 18 | P3 | Doc | Désigner DPO + déposer demande NRN au SPF Intérieur (administratif) | hors-code | — | — | bloqué (juriste) |

## Quick wins déjà faits cette session (cf. rapport)
- `.env.example` complété (clés réellement utilisées).
- `CLAUDE.md` créé ; `docs/` réorganisé ; `AGENTS.md` allégé.
- Avertissement `db push` ajouté au README.
- Audits/plans historiques déplacés sous `docs/`.

## Règles d'exécution
- Un item à la fois, **3–5 fichiers max** par lot. Items P0/P1 RGPD/sécurité d'abord.
- Tout item « migration / auth / cookies CMP complet / refonte » = **plan séparé**, jamais
  improvisé. Les items 12, 13 nécessitent un plan avant code.
