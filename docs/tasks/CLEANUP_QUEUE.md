# CLEANUP_QUEUE — Nettoyage technique par lots

Source : `docs/audits/AUDIT_TECH_2026-05-29.md` (recouper avec CONTRADICTIONS.md — plusieurs
items déjà faits). **Max 3–5 fichiers par lot.** Faire un lot, valider, committer, suivant.

## Nettoyage réalisé le 28/09/2026

- Consignes centralisées dans `AGENTS.md` ; `CLAUDE.md` et l'intégration `.claude/`
  retirés. Vérification métier conservée dans
  [`VERIFICATION_WORKFLOW.md`](../agents/chomage/VERIFICATION_WORKFLOW.md).
- 31 composants, hooks et utilitaires orphelins retirés après contrôle des imports,
  réexports et chargements dynamiques. Les routes et composants actifs sont conservés.
- Snapshot `.admin-fr-keys.json`, backup RioLex `_pilot.json.bak` et diagnostics
  ponctuels `tmp-audit-bonus-sheet-dump.py` / `inspect-schema.mjs` retirés.
- L'ancienne carte seule utilisatrice de MarkerCluster est retirée, ainsi que
  `leaflet.markercluster` et ses types. La carte actuelle et Leaflet sont conservés.
- Les plans et spécifications historiques restent consultables ; leurs anciennes
  consignes d'outillage ne remplacent pas les règles actuelles d'`AGENTS.md`.

## Lot 1 — Quick wins docs / env (faible risque)
- [x] Compléter `.env.example` (clés réellement utilisées).
- [x] Avertissement `db push` dans README.
- [ ] Confirmer le sort des fallbacks legacy `NEXTAUTH_SECRET`/`AUTH_SECRET` dans le code
      (retirer si morts).
- [ ] Vérifier `LOG_LEVEL` mort vs `DATABASE_LOG_LEVEL` (déjà aligné dans `.env.example`).

## Lot 2 — Lint ciblé (ne pas viser le zéro d'un coup)
- [ ] Réduire les `@typescript-eslint/no-unused-vars` restants — purement mécanique.
- [ ] Réduire `react/no-unescaped-entities` selon la sortie ESLint actuelle.
- [ ] Traiter `react-hooks/set-state-in-effect` **par fichier**, prudemment
      (changement de comportement possible). Valider chaque écran touché.
- Validation : `pnpm lint` (mesurer le delta, pas l'absolu).

## Lot 3 — Code mort / résidus
- [x] Neuf `scripts/debug-*.ts` examinés : conservés. Plusieurs sont référencés dans
      la méthodologie des calculateurs ; les autres restent des diagnostics réutilisables.
- [ ] TODO trompeurs du chat IA (pin/archive/delete « Bientôt disponible » alors que le
      backend existe) : `sessions-rail.tsx`, `message-bubble.tsx`, `chat-full-shell.tsx`.
- [x] Backup `.bak` du pilote RioLex supprimé ; les articles du corpus actif sont conservés.
- [x] Résidu `/creer-ma-demande` : ancien `loading.tsx` et `LifeEventCard` retirés.
      La route de redirection vers `/mon-dossier` reste disponible pour les anciens liens.

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
- [x] Tests auth et bundles présents ; adapter la couverture au prochain changement ciblé.
- Validation : `pnpm test`.
