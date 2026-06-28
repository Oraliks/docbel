# TECH_DEBT_QUEUE — Dette de structure

Dette « de fond » (au-delà du nettoyage mécanique de CLEANUP_QUEUE). À traiter quand on
touche déjà la zone concernée — pas de chantier dédié sauf décision.

## Architecture / cohérence
- **Rôle `moderator`** présent dans l'enum mais n'autorise aucune route de plus qu'un `user`
  → trompeur. Décider : lui donner un sens ou le retirer (migration).
- **`requirePartnerOrAdminAuth`** défini (`lib/auth-check.ts`) mais **0 usage** → brancher ou retirer.
- Secret crypto unique `BETTER_AUTH_SECRET` pour 4 usages → découper
  (`BOOKING_NRN_ENC_KEY`/`HMAC_KEY`/`PDF_FORM_SIGNING_KEY`).

## Typage
- ≈117 `as unknown as`, ≈10 `any` explicites (+9 masqués par `eslint-disable`).
- Cast session répété ×8 → `declare module` (cf. CLEANUP lot 4).
- 73 `eslint-disable` dont 9 masquant des `any` → réduire au fil de l'eau.

## Validation
- Zod sur ~33/211 routes seulement → généraliser **sur les nouvelles routes** ; ne pas
  régresser vers la validation manuelle. Page-builder = déjà Zod-first (ne pas réintroduire
  de types par bloc écrits à la main).

## Monolithes (cf. CLEANUP lot 5)
- `file-manager.tsx`, `chat-full-shell.tsx`, `calc-*.tsx`.

## Tests manquants
- `lib/calculators/` (montants légaux), `lib/auth*`, `lib/chomage-ia/`, `lib/bundles/`.
- 0 test d'intégration sur les ~211 routes API.
- Bien couvert : `lib/baremes`, `lib/bureaus`, `lib/lookup`, `lib/documents`,
  `lib/pdf-forms`, `lib/pdf-canvas`.

## TODO réels restants (non « faux »)
- Intégrations stubbées : `lib/pdf-forms/integrations/itsme.ts`, `doccle.ts`,
  `app/api/pdf/[slug]/prefill/callback/route.ts`.
- Chat IA non câblés : pin/archive sessions wiring, DELETE message individuel,
  propagation `AbortSignal` jusqu'à Anthropic, auto-retry 429 (cf. archive work-plan).

## Dépendances (majors en retard — chacune = plan dédié, ne pas grouper)
Prisma 5→7, TipTap 2→3, resend 4→6, eslint 9→10, TS 5→6, zustand 4→5,
`@hookform/resolvers` 3→5. `xlsx@0.18.5` : 2 high sans patch npm public → CDN SheetJS ou exceljs.

## Incohérences couleur (cf. DESIGN_RULES)
`#7C3AED`/`#C8102E` en dur dans charts/icônes → `var(--primary)`/`--chart-*`.

## Scripts
- `scripts/debug-*.ts` (9) non référencés par `package.json` → clarifier/archiver.
