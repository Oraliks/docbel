# CLEANUP_QUEUE — Nettoyage technique par lots

## Tri documentaire autorisé — 23/10/2026

Objectif : rendre les documents utiles faciles à retrouver pour l'échéance V1 du 23/11,
sans ré-audit global, perte de preuve ou modification du contrat familial.
Responsable : coordination DocBel. Lots de **3–5 fichiers maximum**. Ce tri est
documentaire et indépendant du chantier RGPD ou de la réouverture reportés.

| Classe | Documents concernés | Action |
| --- | --- | --- |
| Consignes et carte actives | `AGENTS.md`, `README.md`, `docs/context/PROJECT_INDEX.md`, règles spécialisées | Conserver ; corriger seulement les écarts démontrés dans un lot ciblé |
| Pilotage actif | `NEXT_ACTIONS.md`, `MVP_SCOPE.md`, `RGPD_QUEUE.md`, `DECISIONS_V1.md` | Conserver ; une source de décision, liens vers les preuves plutôt que narration répétée |
| Contrat protégé | Référence familiale `LOCKED`, sauvegardes et reçus d'empreinte | Exclure strictement de tout déplacement, suppression et réécriture |
| Preuves de livraison | `docs/operations/*`, rapports 27/09, recettes et revues datées | Conserver accessibles ; dater leur portée et lier au suivi courant |
| Historique de conception | `docs/superpowers/plans/*`, `specs/*` | Conserver comme historique ; classer par livraison prouvée, pas par ancienneté seule |
| Anciens audits | Audits techniques/RGPD 05–06/2026 | Archivés de façon réversible dans `docs/archive/` ; remplacements et restes qualifiés ci-dessous |
| Références i18n, booking, formations, barèmes | Documentation utilisée par code ou consignes actuelles | Conserver tant que ses liens/usages sont actifs ; fusionner seulement après comparaison |

Inventaire initial lecture seule du 23/10 : `context` 14 fichiers, `tasks` 12,
`operations` 18, `rgpd` 2, `audits` 5, `superpowers` 62 (58 Markdown et 4 HTML).
Après archivage, `audits` contient 3 fichiers ; les 2 anciens audits sont conservés
dans `archive`. Ce décompte ne mesure pas l'obsolescence. Les preuves locales restent à
qualifier avant toute publication ; absence Git ne signifie pas déchet.

### Lots prévus

1. **Fait :** synchroniser carte, suivi et exploitation barèmes avec les PR #73/#82.
   Confirmation V1 et préparation RGPD ajoutées sans toucher au contrat.
2. **Terminé localement le 23/10 :** les audits techniques et RGPD ont été déplacés
   intacts dans `docs/archive/` avec leurs renvois directs actualisés ci-dessous.
   Les restes uniques sont signalés ici et conservés dans les audits ; ils ne sont
   pas convertis en tâches actives. Aucun audit métier nouveau.
   L'audit chômage du 04/07 reste en place tant que sa dépendance au référentiel
   n'est pas établie. Aucun audit métier nouveau ni changement de théorie.
3. **Terminé localement le 23/10 :** condenser `NEXT_ACTIONS.md` en état courant daté,
   avec liens vers les preuves et décisions ouvertes. La chronologie précédente a été
   déplacée vers `docs/archive/NEXT_ACTIONS_HISTORY_2026-10-23.md` avec ses quatre
   liens relatifs adaptés.
4. **Tri ciblé terminé :** les plans/specs ci-dessous ont une source de statut.
   Les autres restent en place, faute de preuve documentée de remplacement ou de
   fin ; aucune archive supplémentaire n'est justifiée par leur seule date.

Fin de chaque lot : chemins résolus vérifiés dans le dépôt, liens entrants adaptés,
preuves et décisions uniques conservées, aucun document protégé touché, diff relu.
Ne supprimer définitivement qu'un doublon exact sans information unique ni référence
active. Préférer l'archivage réversible. Pas de nettoyage de branches/worktrees ou
des modifications d'autres agents dans ce mandat documentaire.

### Qualification et archivage des deux audits — 23/10/2026

**Archivé réversiblement ; originaux conservés intacts.** Les empreintes après
déplacement correspondent aux sources. Lecture intégrale des 21 items techniques
et des 10 axes RGPD, comparés aux suivis existants. Ce tri n'est ni une recette
code/DB/production, ni une validation juridique ou métier. Les compteurs de mai
ne sont pas actuels.

| Candidat | Remplacement pour agir aujourd'hui | Informations à conserver / décision |
| --- | --- | --- |
| [AUDIT_TECH_2026-05-29](../archive/AUDIT_TECH_2026-05-29.md) | [CONTRADICTIONS](CONTRADICTIONS.md), [SECURITY_QUEUE](SECURITY_QUEUE.md), [TECH_DEBT_QUEUE](TECH_DEBT_QUEUE.md) | Items clos, V3 `safeEval`, dettes structurelles et intégrations restent consultables dans l'audit ; les queues portent les statuts actuels. La photographie de mai est une preuve datée. |
| [AUDIT_RGPD_2026-06-06](../archive/AUDIT_RGPD_2026-06-06.md) | [RGPD_QUEUE](RGPD_QUEUE.md), revue confidentialité (`docs/operations/PRIVACY_RELEASE_REVIEW.md`), DECISIONS_V1 (`docs/operations/DECISIONS_V1.md`), registre (`docs/rgpd/REGISTRE_TRAITEMENTS.md`) et procédure d'incident (`docs/rgpd/PROCEDURE_VIOLATION.md`) | Axes historiques répartis dans les suivis ; l'audit n'est pas une source juridique actuelle. Les détails non repris restent dans l'archive et sont signalés ci-dessous. |

Le remplacement est réparti entre ces sources : **aucun document ne remplace seul
les deux audits**. La revue confidentialité, section « Informations nécessaires »,
signale déjà les formulations historiques à ne pas reprendre telles quelles
(DPO, exception art. 9, habilitation NRN, effacement). La note de conformité, les
montants de sanctions, délais, tarifs et conseils de fournisseurs de l'ancien
audit restent des assertions historiques non revalidées par ce tri. Le choix
personnel/sans société et la portée sans compte ni dossier sont déjà décidés ; ne
pas les remettre en arbitrage. Leur désactivation technique n'est pas prouvée ici.

**Restes uniques conservés dans les audits archivés, sans lancement de travaux :**

| Source historique | Détail non repris explicitement | Destination de qualification à coordonner par le chef |
| --- | --- | --- |
| Tech #20 | Extraction proposée de `UserFormFields` entre création/édition utilisateur | Archive uniquement ; aucun défaut actuel confirmé |
| Tech #21 | `DOCCLE_SENDER_ID` annoncé non câblé ; ancien écart Node/types | Archive uniquement ; les valeurs de mai ne prouvent pas l'état actuel |
| RGPD axe 7 | Brouillons de messagerie admin en `localStorage` ; bloc optionnel `gdpr-notice` / `declineText` facultatif | Archive uniquement ; pas de réouverture de la bannière |
| RGPD axe 8 | Chiffrement éventuel de `PdfFormDraft.payload`, rotation/version des clés et hypothèse timing dédoublonnage | Archive uniquement ; aucun traitement PDF/crypto |
| RGPD axes 9–10 | Avertissements champs libres ; exemples d'alertes et page `/securite` | Archive uniquement ; exercice synthétique déjà repris dans PROCEDURE_VIOLATION §10 |

**Références entrantes adaptées :** CLEANUP_QUEUE, CONTRADICTIONS, RGPD_QUEUE et
SECURITY_QUEUE pointent aux emplacements archivés ou à cette qualification.

| Document source | Référence à préserver lors du déplacement |
| --- | --- |
| `docs/tasks/CLEANUP_QUEUE.md` | Qualification, archives et statuts actuels |
| `docs/tasks/CONTRADICTIONS.md` | Résumé des points vérifiés et liens vers les deux archives |
| `docs/tasks/RGPD_QUEUE.md` | Source historique désormais liée à l'archive |
| `docs/tasks/SECURITY_QUEUE.md` | Les alertes historiques #5/#7 restent reliées à l'audit archivé |
| `docs/archive/AUDIT_TECH_2026-05-29.md` | Lien relatif vers l'audit RGPD, conservé car les archives sont côte à côte |

Empreintes SHA-256 après déplacement, égales à celles des originaux :

- Tech : `8B6A992C49629C43E55D3D174FA1A92CD54689565E076B0A87F9820074E67BC6`.
- RGPD : `F12ECB41F5551404AA554BF9BC5BF8C2C4C4E9AE0EB0A5E0A72591F7A1462D82`.

**État :** archivage réversible livré localement ; détails uniques préservés, aucune
référence familiale protégée touchée. Vérification des liens consignée au bilan final.

L'historique de [CONTRADICTIONS](CONTRADICTIONS.md) est également archivé intégralement
dans [`CONTRADICTIONS_HISTORY_2026-10-23.md`](../archive/CONTRADICTIONS_HISTORY_2026-10-23.md).
SHA-256 avant et après copie :
`62A1DAE3C92BF0BFEB386942F439BF0F3C4D0FF0203BD87FBB49B9F2C0A6DB84`.

### Plans et spécifications ciblés — 23/10/2026

| Document | Classement | Motif et remplacement |
| --- | --- | --- |
| `docs/archive/work-plan-chat-ia.md` | Historique archivé | Le plan indique des fonctions déjà câblées ; les travaux restants utiles sont repris dans TECH_DEBT_QUEUE. Archive existante conservée. |
| `docs/archive/onboarding-implementation.md` | Historique archivé | L'avertissement de schéma obsolète et `db:push` reste couvert par AGENTS/README. Archive existante conservée. |
| `docs/superpowers/plans/2026-07-07-pdf-bindings-canonical-ux-plan.md` | Référence historique utile, laissée en place | AGENTS situe les phases 1–7 comme fusionnées et décrit les règles courantes. Les notes de décisions et limites du plan sont conservées ; ne pas reprendre ses anciennes étapes d'exécution sans mandat. |
| `docs/superpowers/plans/2026-07-30-formulaires-onem-restants.md` | Historique de suite, laissée en place | L'ancien suivi la présentait comme un reste PDF, mais son état après les dernières livraisons n'est pas établi ici. Aucun travail PDF ne découle de ce tri. |
| Autres plans/specs | Conservés | Aucun état de livraison/remplacement lié à la cible actuelle n'a été établi par les suivis actifs ; ne pas les archiver sur leur âge seul. |

### Historique condensé de NEXT_ACTIONS

L'ancienne chronologie a été déplacée, avec ses quatre liens relatifs adaptés, vers
[`NEXT_ACTIONS_HISTORY_2026-10-23.md`](../archive/NEXT_ACTIONS_HISTORY_2026-10-23.md).
Empreinte SHA-256 de l'archive :
`2389B58FD1C29396B75AF33A323421875619C1E00E13BDF4E9400C32599D1436`.

Source technique : [audit archivé](../archive/AUDIT_TECH_2026-05-29.md).
**Max 3–5 fichiers par lot.** Valider chaque lot avant le suivant.

## Nettoyage réalisé le 28/09/2026

- Consignes centralisées dans `AGENTS.md` ; `CLAUDE.md` et l'intégration `.claude/`
  retirés. Vérification métier conservée dans
  `VERIFICATION_WORKFLOW.md` (`docs/agents/chomage/VERIFICATION_WORKFLOW.md`).
- 31 composants, hooks et utilitaires orphelins retirés après contrôle des imports,
  réexports et chargements dynamiques. Les routes et composants actifs sont conservés.
- Snapshot `.admin-fr-keys.json`, backup RioLex `_pilot.json.bak` et diagnostics
  ponctuels `tmp-audit-bonus-sheet-dump.py` / `inspect-schema.mjs` retirés.
- L'ancienne carte seule utilisatrice de MarkerCluster est retirée, ainsi que
  `leaflet.markercluster` et ses types. La carte actuelle et Leaflet sont conservés.
- Les plans et spécifications historiques restent consultables ; leurs anciennes
  consignes d'outillage ne remplacent pas les règles actuelles d'`AGENTS.md`.

## Backlog technique historique

Les lots 1–6 ci-dessous décrivent des travaux de code et de tests issus d'une
ancienne queue. Leurs statuts actuels n'ont pas été réévalués dans le nettoyage
documentaire du 23/10 ; leur présence ne mandate pas leur exécution. Les thèmes
structurels restent aussi répertoriés dans TECH_DEBT_QUEUE.

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
- [ ] Résidu `/creer-ma-demande` (fusionné dans le guichet `/mon-dossier`, Task 4.3) :
      `app/creer-ma-demande/loading.tsx` = loading de segment MORT (la page est un
      `redirect()` synchrone → jamais rendu). À retirer. (Les commentaires stale de
      `app/mon-dossier/page.tsx` et `lib/dossiers/types.ts` ont été toilettés.)

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
