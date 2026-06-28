# CLEANUP_QUEUE — Nettoyage technique par lots

Source : `docs/audits/AUDIT_TECH_2026-05-29.md` (recouper avec CONTRADICTIONS.md — plusieurs
items déjà faits). **Max 3–5 fichiers par lot.** Faire un lot, valider, committer, suivant.

## Lot 1 — Quick wins docs / env (faible risque) ✅ en partie fait cette session
- [x] Compléter `.env.example` (clés réellement utilisées).
- [x] Avertissement `db push` dans README.
- [ ] Confirmer le sort des fallbacks legacy `NEXTAUTH_SECRET`/`AUTH_SECRET` dans le code
      (retirer si morts).
- [ ] Vérifier `LOG_LEVEL` mort vs `DATABASE_LOG_LEVEL` (déjà aligné dans `.env.example`).

## Lot 2 — Lint ciblé (ne pas viser le zéro d'un coup)
- [ ] Réduire les `@typescript-eslint/no-unused-vars` (≈21) — purement mécanique.
- [ ] Réduire `react/no-unescaped-entities` (≈15).
- [ ] Attaquer `react-hooks/set-state-in-effect` (≈47) **par fichier**, prudemment
      (changement de comportement possible). Valider chaque écran touché.
- Validation : `pnpm lint` (mesurer le delta, pas l'absolu).

## Lot 3 — Code mort / résidus
- [ ] 9 `scripts/debug-*.ts` non référencés → décider garder/archiver (cf. MVP_SCOPE).
- [ ] TODO trompeurs du chat IA (pin/archive/delete « Bientôt disponible » alors que le
      backend existe) : `sessions-rail.tsx`, `message-bubble.tsx`, `chat-full-shell.tsx`.
- [ ] (`.bak` déjà absent — rien à faire.)

## Lot 4 — Typage session
- [ ] Factoriser `(session.user as { role?: string })` (≈8 occurrences) via `declare module`
      (header.tsx, admin/page.tsx, chomage/preavis, changelog, 2 download routes, tools route).
- Validation : `pnpm build`.

## Lot 5 — Composants monolithiques (un par lot)
- [ ] `components/docbel/file-manager.tsx` (~1976 l.).
- [ ] `components/admin/chomage-ia/chat/chat-full-shell.tsx` (~1407 l.).
- [ ] `components/docbel/calculators/calc-*.tsx` (7 fichiers >880 l.).
- Risque moyen → découper par sous-composants, valider chaque écran.

## Lot 6 — Tests métier critiques (prioritaire car montants légaux)
- [x] `lib/calculators/` : préavis (`indemnite-rupture`) + IPP testés
      (`lib/calculators/__tests__/`, 37 tests). Restants : chomage, brut-net, pension, etc.
- [ ] `lib/auth*` / `lib/auth-check.ts`, `lib/bundles/` : tests unitaires de base.
- Validation : `pnpm test`.
