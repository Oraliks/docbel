# Suites de l'audit PDF-forms — plan en 15 sessions

> **Pour les sessions d'exécution :** une session = UN lot de ce plan, jamais deux.
> Démarrer une session avec : « Exécute le lot Sn du plan
> `docs/superpowers/plans/2026-08-01-suites-audit-pdf-forms.md` ». Chaque lot est
> autonome (contexte, fichiers, étapes, validation). Pour les lots non triviaux
> (marqués ♦), la session commence par relire les fichiers cibles puis écrit son
> propre mini-plan TDD avant de coder (superpowers:writing-plans).
> Lots touchant `lib/pdf-forms/seed/**` : lancer `/verif-reglementation` avant
> commit (informatif, jamais bloquant).

**But :** exécuter les corrections issues de l'audit du 2026-08-01
(rapport en conversation, constats vérifiés fichier:ligne) en petits lots
committables, avec les décisions d'Oraliks intégrées.

**Décisions actées (2026-08-01, Oraliks) :**
1. Opposabilité : OUI via **stats/métadonnées** en admin — **aucun stockage de fichiers**.
2. Admin : **pas d'édition des formulaires ONEM** (les 8 slugs semés) ; l'éditeur
   reste pour d'éventuels futurs documents non-ONEM.
3. Code mort : **à retirer** (Doccle/itsme non prévus pour l'instant).
4. Les 7 PDF non embarqués (C109-36, C27, C32, C6) : **plus tard**, après 100 %
   des documents existants. L'éditeur visuel reste (dormant, servira aux PDF plats).
5. Date du document régénéré = **date du téléchargement : voulu** (à documenter).
6. **100 % FR** pour l'instant ; NL plus tard par upload des PDF officiels NL.
7. **« Vous » partout**, y compris dans les aides des seeds.

## Contraintes globales (toutes les sessions)

- ❌ Jamais `prisma db push` sur Neon : schéma via SQL **additif** + `prisma db execute`.
- ❌ `git add` de chemins **explicites** uniquement (workdir partagé multi-agents).
- Max 3–5 fichiers par lot (exceptions balayages mécaniques : S8, S10 — notées).
- Validation systématique : `pnpm test` (2 246 tests), `pnpm build`, et
  `pnpm lint` sans NOUVELLE erreur (base constatée : 129 erreurs / 52 warnings).
- Textes réglementaires : jamais réécrits — seuls les textes d'aide DocBel sont modifiables.
- Après tout lot modifiant un seed : le re-semis
  (`pnpm tsx scripts/apply-c1-improvements.ts --yes [--slug <slug>]`) est exécuté
  par Oraliks, pas par l'agent (base partagée).

## Choix du modèle par session

Règle simple : **Sonnet 5** pour les lots mécaniques/localisés à spec fermée ;
**Opus 5** pour les lots qui demandent du jugement multi-fichiers (écritures en
base, refactor du runner, e2e, conception de schéma).

| Ordre | Lot | Objectif court | Modèle | Statut |
|---|---|---|---|---|
| 1 | S1 | RGPD : logs sans PII + anonymisation complète | Sonnet | fait (983b225) |
| 2 | S2 | CI GitHub Actions (lint + tests) + timeout vitest | Sonnet | fait (cbabe61, run #2 vert) |
| 3 | S3 | Cohérence dossier : orderBy, 404 run irrésoluble, event download | Sonnet | fait (ac228c3), push en attente |
| 4 | S4 | Correctifs divers : test-generate, nom de fichier, 2 messages « tu » | Sonnet | fait (52cccea + 26e9092 NL/DE), poussé |
| 5 | S5 | Gel de l'édition admin des 8 slugs ONEM + bannière | Sonnet | fait (ebbc4e7), push en attente — QA visuelle admin à faire par Oraliks |
| 6 | S6 ♦ | Sync seed→DB traçable (révision + version) | Opus | à faire |
| 7 | S7 ♦ | Opposabilité : hash stable + diagnostics persistés + tuile admin | Opus | à faire |
| 8 | S8 | `ensureWriteAllowed` sur les routes admin PDF (balayage) | Sonnet | à faire |
| 9 | S9 | Nettoyage code mort (diag, presets, helpers bindings…) | Sonnet | à faire |
| 10 | S10 | « Vous » partout dans les seeds (aides uniquement) | Sonnet | à faire |
| 11 | S11 ♦ | E2E Playwright : un parcours C47 complet → PDF | Opus | à faire |
| 12 | S12 ♦ | Runner dégraissé (pied de soumission + hook autosave) | Opus | à faire |
| 13 | S13 ♦ | Moules réellement partagés — 1er passage (C46 + C47) | Opus | à faire |
| 14 | S14 ♦ | C1-Regis réaligné (= NEXT_ACTIONS #31 enrichi) | Opus | à faire |
| 15 | S15 | Docs à jour + monitoring crons + perf mineures | Sonnet | à faire |

S1→S12 sont indépendants du travail documentaire en cours (#26–#30) ; S13/S14
se calent sur les reprises de documents ; S15 quand on veut.

---

### S1 — RGPD : logs sans PII + anonymisation complète — `Sonnet`

**Contexte.** (a) `app/api/pdf/[slug]/generate/route.ts:266-269` logge
`filled.diagnostics` en entier ; pour `kind: "caracteres-non-rendus"`, `detail`
contient les caractères du citoyen (noms non latins) — cf. `filler.ts:1002`.
Le résumé de `filler.ts:1699-1702` (fieldId + kind, sans detail) est le bon modèle.
(b) Le cron `app/api/cron/bundle-runs-purge/route.ts:40-47` anonymise sans vider
`orientationAnswers`.

**Fichiers.** Modifier : `app/api/pdf/[slug]/generate/route.ts`,
`app/api/cron/bundle-runs-purge/route.ts`. Test : le test existant du cron s'il
existe (`lib/bundles/__tests__/` / `grep bundle-runs-purge`), sinon en créer un
pur sur la liste des champs anonymisés.

**Étapes.**
- [ ] Dans generate : remplacer le log par une projection sans `detail` :
  `filled.diagnostics.map(({ fieldId, widget, kind }) => ({ fieldId, widget, kind }))`.
- [ ] Dans le cron : ajouter `orientationAnswers: Prisma.DbNull` au bloc `data`
  de l'anonymisation (à côté de `draftPayloads`).
- [ ] Test : vérifier que la liste des champs vidés contient `orientationAnswers`
  (test de non-régression sur l'objet `data`, extrait en constante exportée si besoin).
- [ ] `pnpm test` + `pnpm build`. Commit
  `fix(rgpd): les logs de génération taisent les caractères citoyens et l'anonymisation vide orientationAnswers`.

**Critère d'acceptation.** Générer en dev un payload avec un nom cyrillique →
le log ne contient aucun caractère de la valeur ; le test du cron liste
`orientationAnswers`.

---

### S2 — CI GitHub Actions + timeout vitest — `Sonnet`

**Contexte.** Aucun `.github/`. 2 246 tests que rien n'exécute automatiquement.
Deux tests sur vrais PDF partent en timeout (5 s par défaut) sous charge —
vérifié : verts isolément. `pnpm build` exige une DATABASE_URL (pages statiques
qui interrogent Neon au build) → **hors CI pour l'instant**, décision à part.

**Fichiers.** Créer : `.github/workflows/ci.yml`. Modifier : `vitest.config.ts`.

**Étapes.**
- [ ] `vitest.config.ts` : ajouter `testTimeout: 15_000` dans `test: {}`.
- [ ] Workflow : déclencheur `push` + `pull_request` sur `main` ; job unique
  ubuntu-latest : checkout → pnpm/action-setup (version 10) → setup-node 20 avec
  cache pnpm → `pnpm install --frozen-lockfile` → `pnpm lint || true` (dette de
  129 erreurs assumée — passage bloquant plus tard) → `pnpm test`.
  Les PDF de `private/pdfs/` sont versionnés → les 15 fichiers de tests
  « vrais PDF » tournent en CI (ne PAS les laisser se skipper).
- [ ] Vérifier localement `pnpm test` avec le nouveau timeout. Commit
  `ci: lint + 2246 tests vitest sur chaque push` puis push et vérifier le run
  vert sur GitHub (pas de gh CLI : vérification via l'UI web).

**Critère.** Un run GitHub Actions vert ; un test cassé volontairement en local
ferait échouer le job (ne pas le committer).

---

### S3 — Cohérence dossier : orderBy, 404, event download — `Sonnet`

**Contexte.** (a) `app/document/[...path]/page.tsx:127-134` : l'`include` des
`bundle.items` n'a pas d'`orderBy` alors que la fusion prefill documente
« première occurrence gagne » → prefill inter-documents non déterministe.
`loadDossierState` (lib/bundles/completion.ts:90) trie déjà par `order: "asc"`.
(b) `app/api/pdf/[slug]/generate/route.ts:220-228` : un `bundleRunId` fourni mais
irrésoluble (étranger/clôturé) saute le verrou tout-ou-rien ET la persistance,
en silence. (c) `app/api/bundles/runs/[runId]/download/[pdfFormId]/route.ts`
n'émet pas l'événement `documents_downloaded` (le zip et le mail le font,
cf. `download-all/route.ts:71-75`) → funnel sous-compté.

**Fichiers.** Modifier : `app/document/[...path]/page.tsx`,
`app/api/pdf/[slug]/generate/route.ts`,
`app/api/bundles/runs/[runId]/download/[pdfFormId]/route.ts`.
Test : `lib/pdf-forms/__tests__/` ou `lib/bundles/__tests__/` selon l'extraction.

**Étapes.**
- [ ] `items: { include: {...}, orderBy: { order: "asc" } }` dans
  `loadBundleSharedValues` (aligne sur `loadDossierState`).
- [ ] Dans generate : quand `bundleRunId` est présent et que
  `loadDossierState` renvoie `null` → répondre 404 `{ error: "Dossier introuvable" }`
  AVANT toute génération (au lieu de continuer sans verrou ni persistance).
  Attention : ne rien changer au cas `bundleRunId` absent (usage autonome voulu).
- [ ] Dans download unitaire : émettre `documents_downloaded` sur le modèle
  exact du zip (même helper `lib/bundles/analytics.ts`, mêmes métadonnées).
- [ ] Toujours dans `page.tsx` (mêmes fichiers, même lot) : (a) remplacer le
  prédicat `run.status !== "in_progress"` de `loadBundleSharedValues` (l. 136)
  par `isBundleRunEditable(run)` (`lib/bundles/run-lifecycle.ts`) pour l'aligner
  sur `loadDossierState` — un run `completed` legacy garde prefill/brouillon/rail ;
  (b) quand `?bundleRun=` est présent sans `?bundleSlug=`, dériver le slug du
  run chargé au lieu d'afficher silencieusement le formulaire sans rail ;
  (c) remplacer le `permanentRedirect` (308, mis en cache à vie par les
  navigateurs) par un `redirect` 307 — un `publicPath` doit rester modifiable.
- [ ] `pnpm test` + `pnpm build`. Commit
  `fix(dossiers): prefill déterministe, 404 sur run irrésoluble, funnel complet`.

**Critère.** Test unitaire : deux documents porteurs de la même `canonicalKey`
→ la valeur pré-remplie est celle du plus petit `order`, de façon stable.

---

### S4 — Correctifs divers generate/test-generate/voix — `Sonnet`

**Contexte.** (a) `app/api/admin/pdf/forms/[id]/test-generate/route.ts:44`
appelle `readSourcePdf(form.sourceStoragePath)` **sans** le fallback
`form.sourceFileName` (contrairement à generate:230) et **jette** les
diagnostics. (b) Le runner nomme le fichier téléchargé `${form.slug}.pdf`
(`components/pdf-forms/pdf-form-runner.tsx:1079`) en ignorant le
`Content-Disposition` serveur (`renderFilename` : slug + date). (c) Deux
messages en tutoiement dans `lib/pdf-forms/validation.ts:129` (NISS date) et
`:668` (week-end) — décision « vous partout ».

**Fichiers.** Modifier : `app/api/admin/pdf/forms/[id]/test-generate/route.ts`,
`components/pdf-forms/pdf-form-runner.tsx`, `lib/pdf-forms/validation.ts`.

**Étapes.**
- [ ] test-generate : passer `form.sourceFileName` en 2ᵉ argument ; logger les
  diagnostics (projection sans `detail`, comme S1).
- [ ] Runner : lire le nom depuis `Content-Disposition`
  (`res.headers.get("content-disposition")`, extraire `filename="…"`) avec repli
  `${form.slug}.pdf`.
- [ ] validation.ts : réécrire les 2 messages FR en vouvoiement (NL/DE des mêmes
  entrées déjà en « u »/« Sie » — ne toucher que le FR ; garder le sens exact).
- [ ] validation.ts : plafond générique anti-abus dans `fieldToZod` — tout champ
  `text`/`textarea` SANS `maxLength` déclaré reçoit une borne de 2 000 caractères
  (message FALLBACK.format) ; test : une valeur de 2 001 caractères est refusée,
  un champ avec `maxLength: 5000` explicite garde sa borne.
- [ ] `pnpm test` (les messages sont peut-être figés dans des tests → adapter),
  `pnpm build`. Commit `fix(pdf-forms): test-generate fiabilisé, nom de fichier serveur, vouvoiement des 2 messages`.

---

### S5 — Gel de l'édition admin des 8 slugs ONEM — `Sonnet`

**Contexte (décision n°2).** L'admin ne doit plus pouvoir éditer `fields` ni
`triggers` des 8 formulaires semés — le seed les écrase de toute façon
(`apply-c1-improvements-core.ts:95-101`). L'éditeur reste entier pour de futurs
documents non-ONEM. Les onglets Paramètres/Publication (publicPath, active,
allowDownload…) restent éditables partout : le sync n'y touche pas.

**Fichiers.** Modifier : `app/api/admin/pdf/forms/[id]/route.ts` (garde PATCH),
`lib/pdf-forms/seed/apply-c1-improvements-core.ts` (exporter la liste des slugs :
`export const SEEDED_SLUGS = C1_IMPROVEMENT_TARGETS.map(t => t.slug)`),
`components/admin/pdf-forms/pdf-form-editor.tsx` (bannière + désactivation des
onglets Champs/Déclencheurs). Test : route PATCH (pur : extraire la garde en
fonction testable) ou test du composant si plus simple.

**Étapes.**
- [ ] Garde serveur : dans le PATCH, si `slug ∈ SEEDED_SLUGS` et que le body
  contient `fields` ou `triggers` → 409
  `{ error: "Formulaire géré par le code (seed) — édition des champs verrouillée", code: "seed_managed" }`.
  Les autres clés du body restent acceptées.
- [ ] UI : bannière permanente sur `/admin/pdf/[id]` pour ces slugs
  (« Géré par le code — les champs et déclencheurs se modifient dans
  `lib/pdf-forms/seed/` puis re-semis ») ; onglets Champs/Déclencheurs en lecture
  seule (consultation du mapping conservée).
- [ ] Pour les FUTURS documents non semés (décision n°2 : l'éditeur reste pour
  eux) : dans le même PATCH, si le formulaire est `published` et que `fields`
  change, exécuter `checkPublishable` et refuser (422 + liste des issues) en cas
  d'erreur BLOQUANTE — sauf `body.force === true` (hotfix assumé). Aujourd'hui un
  formulaire publié peut être édité vers un état invalide servi immédiatement
  (`checkPublishable` n'est appelé que par la route publish).
- [ ] `pnpm test` + `pnpm build` + vérif écran `/admin/pdf/[id]` d'un slug semé
  ET d'un formulaire non semé (édition intacte). Commit
  `feat(admin/pdf): les 8 formulaires ONEM passent en lecture seule côté schéma`.

---

### S6 ♦ — Sync seed→DB traçable — `Opus`

**Contexte.** `applyOneC1Improvement` écrit `fields`+`triggers` sans snapshot,
sans bump de `version`, sans verrou — alors que le PATCH admin fait les trois
(`app/api/admin/pdf/forms/[id]/route.ts:127-147`, transaction + révision +
`version+1` + `where: { id, updatedAt }`). Après S5 le risque d'écrasement
d'éditions admin disparaît pour `fields`, mais la **traçabilité** manque
toujours : impossible de savoir ce qu'un re-semis a changé ni de revenir en arrière.

**Fichiers.** Modifier : `lib/pdf-forms/seed/apply-c1-improvements-core.ts`.
Test : `lib/pdf-forms/seed/__tests__/apply-c1-improvements-core.test.ts`.

**Étapes (session : relire d'abord le core + le PATCH, puis mini-plan TDD).**
- [ ] Dans `applyOneC1Improvement(target, apply=true)` : envelopper l'écriture
  dans une transaction qui (1) crée une `PdfFormRevision` (snapshot de
  `fields`/`technicalSchema` AVANT, `changeType: "seed_sync"`,
  `changeNotes: "re-semis " + target.slug`), (2) update avec `version: existing.version + 1`.
  Ne créer révision + bump QUE si le JSON de `fields` change réellement
  (même comparaison normalisée que le PATCH) — un sync no-op reste no-op.
- [ ] Le résumé retourné (`changed` etc.) mentionne la révision créée.
- [ ] Tests : sync sans changement → aucune révision, version stable ; sync avec
  changement → révision créée avec l'ancien contenu, version incrémentée.
- [ ] `pnpm test` + `pnpm build`. Commit
  `feat(pdf-forms): chaque re-semis laisse une révision et incrémente la version`.

**Interfaces.** Produit : `changeType: "seed_sync"` — S7 et l'historique admin
(`revisions-dialog`) l'affichent tel quel, aucun changement requis côté UI.

---

### S7 ♦ — Opposabilité : hash stable + diagnostics persistés + stats admin — `Opus`

**Contexte (décision n°1).** Il faut pouvoir établir en admin, SANS stocker de
fichier ni de payload : (a) qu'une génération donnée était complète (aucune case
non écrite) ; (b) qu'un document régénéré est **au même contenu métier** que
l'original. Aujourd'hui `payloadHash` inclut la date injectée du jour
(`generate/route.ts:93` → `:360`) donc ne prouve rien, et les diagnostics
meurent en `console.warn` (generate) ou sont jetés (`regenerate-pdfs.ts`,
zip/mail/téléchargement). `stableDocumentKey`
(`lib/bundles/document-identity.ts:22-35`) exclut déjà les champs auto et les
vides — c'est la brique du hash stable. Décision n°5 rappelée : la date
imprimée reste celle du téléchargement, c'est voulu — l'opposabilité porte sur
le contenu métier, pas sur les octets.

**Fichiers.** Modifier : `prisma/schema.prisma` (colonnes additives sur
`PdfFormSubmissionLog` : `stablePayloadHash String?`,
`diagnosticsSummary Json?`), SQL additif à exécuter par Oraliks
(`prisma db execute` — l'écrire dans le commit, ex.
`prisma/migrations/manual/2026-08-XX-submissionlog-opposabilite.sql` :
`ALTER TABLE "PdfFormSubmissionLog" ADD COLUMN IF NOT EXISTS "stablePayloadHash" TEXT, ADD COLUMN IF NOT EXISTS "diagnosticsSummary" JSONB;`),
`app/api/pdf/[slug]/generate/route.ts` (logSubmission enrichi),
`lib/bundles/regenerate-pdfs.ts` + les 3 routes de download/zip/mail (écrire une
ligne de log par régénération, `delivery: "regenerate"`),
`lib/pdf-forms/analytics.ts` + `app/admin/pdf/analytics/*` (tuile « générations
avec diagnostics » + compteur par kind). Tests : analytics purs + logSubmission.

**Étapes (session : mini-plan TDD obligatoire ; SQL additif, jamais db push).**
- [ ] `stablePayloadHash = sha256Hex(stableDocumentKey(validated, fields))` —
  calculé sur le payload validé AVANT `applyServerAutoFields` ou en excluant les
  auto-fields (choisir et documenter : l'important est l'invariance à la date).
- [ ] `diagnosticsSummary = { count, kinds: {...} }` — **jamais** `detail`.
- [ ] Régénérations (download/zip/mail) : une ligne de log chacune, mêmes champs.
- [ ] Tuile admin : générations 30 j avec `diagnosticsSummary.count > 0`,
  répartition par kind, lien vers le formulaire.
- [ ] Documenter la décision n°5 (date du téléchargement voulue) dans
  `docs/context/PDF_FORMS_RULES.md` (section livraison).
- [ ] `pnpm test` + `pnpm build`. Commit
  `feat(pdf-forms): hash de contenu stable + diagnostics persistés + stats admin (opposabilité sans stockage)`.

**Critère.** Deux téléchargements du même dossier à deux dates → même
`stablePayloadHash` ; une génération avec widget introuvable simulé → visible
dans la tuile admin.

---

### S8 — `ensureWriteAllowed` sur les routes admin PDF — `Sonnet` (balayage assumé > 5 fichiers)

**Contexte.** Le garde lecture-seule d'impersonation (`lib/admin/readonly-guard.ts:44`)
protège 14 routes admin mais **aucune** des ~21 routes `app/api/admin/pdf*`.
Modèle d'insertion : `app/api/admin/form-context-tips/route.ts:38`.

**Étapes.**
- [ ] Ajouter `const writeBlock = await ensureWriteAllowed(); if (writeBlock) return writeBlock;`
  en tête de chaque handler **mutateur** (POST/PATCH/PUT/DELETE) des routes
  admin PDF — jamais sur les GET ni sur le cron.
- [ ] `pnpm build` + spot-check d'une route en mode impersonation.
  Commit `fix(admin/pdf): le mode « voir en tant que » ne peut plus écrire sur les routes PDF`.

---

### S9 — Nettoyage code mort — `Sonnet`

**Contexte (décision n°3).** À retirer, constaté sans consommateur :
- `app/api/admin/pdf/diag/route.ts` (auto-déclaré « à supprimer », aucun appelant) ;
- `identityBindings`, `fullnameBinding`, `addressBindings` dans
  `lib/pdf-forms/bindings/shared.ts` (aucun call site ; **garder `concatBinding`**) ;
- module presets : `app/admin/pdf/presets/`, `app/api/admin/pdf/presets/**`,
  `components/admin/pdf-forms/presets-manager.tsx`, le champ `presetKey` de
  `field-editor.tsx` (la prop `presetKey` de `types.ts` reste — donnée existante
  en base, ne rien casser à la lecture) ; `scripts/seed-pdf-presets.ts` + entrée
  package.json ; la table Prisma reste (pas de DROP — inerte) ;
- `app/api/admin/pdf/forms/[id]/duplicate/route.ts` (aucun appelant UI) ;
- masquer l'option de livraison Doccle côté runner tant que `sendToDoccle`
  throw (les stubs `integrations/*` restent — petits et documentés).

**Étapes.**
- [ ] Supprimer/ajuster les éléments listés ; grep de contrôle après chaque
  suppression (`presetKey`, `identityBindings`, `duplicate`) pour vérifier
  l'absence de références restantes.
- [ ] `pnpm test` + `pnpm build` + écran `/admin/pdf` et `/admin/pdf/[id]`.
- [ ] Mettre à jour `docs/context/PROJECT_INDEX.md` si les presets y figurent.
  Commit `chore(pdf-forms): retrait du code mort (diag, presets, helpers bindings, duplicate)`.

---

### S10 — « Vous » partout dans les seeds — `Sonnet` (balayage textes > 5 fichiers)

**Contexte (décision n°7).** Tutoiement résiduel dans les aides des seeds
(constaté : `c1/identite.ts:57`, `c1/famille.ts:106-157`, `c1/activites.ts`,
`c1/paiement.ts:182`, `c1b:109`, `c46:152`, `c47:190` + `:381`,
`c1-partenaire:137` + `:368`, `_shared/moules.ts:152`). **Uniquement les textes
d'aide/labels rédigés par DocBel** — jamais les textes recopiés du PDF officiel.

**Étapes.**
- [ ] Balayage `grep -n "\btu\b\|\bta \|\bton \|\btes \|As-tu\|Réponds\|Demande "`
  sur `lib/pdf-forms/seed/**` ; réécrire chaque occurrence en vouvoiement, sens
  strictement conservé.
- [ ] Étendre le test de voix du C1A (`c1a-fields.test.ts:1058`) en un test
  partagé qui balaie les 8 seeds (échoue sur `\btu\b|As-tu|\bta carte\b` dans
  les `help`/`label`).
- [ ] `/verif-reglementation` (informatif). `pnpm test`. Commit
  `fix(pdf-forms): vouvoiement uniforme dans les aides des 8 seeds`.
- [ ] **Après merge : re-semis par Oraliks** (`apply-c1-improvements --yes`),
  sinon rien ne change à l'écran.

---

### S11 ♦ — E2E : un parcours C47 complet → PDF — `Opus`

**Contexte.** Zéro e2e sur `/document` ; le runner (2 409 l.) n'a aucun test
d'interaction. Le C47 est le plus court (2-3 étapes hors dossier). Pré-requis
env : dev server lancé à la main, `PLAYWRIGHT_BASE_URL`, seed locale+consent
(pièges connus : `pressSequentially` sur inputs React, soft-nav lente —
cf. mémoire e2e du dépôt). L'e2e reste HORS CI pour l'instant (dépend d'un
serveur + Neon partagée).

**Fichiers.** Créer : `tests/e2e/pdf-forms/c47-generate.spec.ts`
(+ helper éventuel dans `tests/e2e/helpers/`).

**Étapes (session : relire `tests/e2e/mon-dossier/*.spec.ts` pour les patterns).**
- [ ] Spec : ouvrir `/document/onem/c47` → répondre au parcours minimal (un
  cadre de demande, identité, signature auto) → cocher le consentement →
  « Signer et générer » → intercepter la réponse : `content-type: application/pdf`,
  taille > 10 ko. Vérifier aussi qu'aucun scroll-jump ne survient (position de
  scroll stable après réponse — garde anti-régression du bug signalé 4×).
- [ ] Lancer 3× de suite pour vérifier la stabilité. Commit
  `test(e2e): parcours C47 de bout en bout jusqu'au PDF`.

---

### S12 ♦ — Runner dégraissé — `Opus`

**Contexte.** `pdf-form-runner.tsx` : 2 409 lignes, deux rendus (classique +
macro) aux pieds de page quasi dupliqués (~l. 1407-1504 vs 2300-2402),
`MacroRunnerBody` ~25 props, `submit()` ~275 l. AUCUN changement de
comportement : extraction pure. Danger historique : scroll-jump (cale
`plancherPage`), navigationTick, autosave — ne pas toucher à leurs mécanismes.

**Fichiers.** Modifier : `components/pdf-forms/pdf-form-runner.tsx`.
Créer : `components/pdf-forms/submit-footer.tsx` (pied partagé : livraison,
signature, consentement, résumé d'erreurs, autosave+reset, boutons),
`components/pdf-forms/use-draft-autosave.ts` (debounce + max-wait + flush +
discard). Test : S11 (e2e C47) sert de filet — **exécuter S11 avant S12**.

**Étapes (session : mini-plan writing-plans obligatoire avant de toucher).**
- [ ] Extraire le pied de soumission en un composant unique paramétré
  (les DEUX rendus l'utilisent — supprimer la duplication).
- [ ] Extraire le hook d'autosave (état `lastSavedAt`, `pendingSave`, timers,
  `flushDraft`/`discardDraft`) sans changer une seule constante.
- [ ] `pnpm test` + `pnpm build` + e2e S11 vert + QA visuelle par Oraliks
  (C1 macro + C1A une-question + un formulaire classique). Commit
  `refactor(pdf-forms): pied de soumission et autosave extraits du runner (aucun changement de comportement)`.

---

### S13 ♦ — Moules réellement partagés, 1er passage (C46 + C47) — `Opus`

**Contexte.** `_shared/moules.ts` annonce « partagé par tous » mais n'a qu'un
importeur (`c1/helpers.ts`). 4 blocs sont dupliqués ≥ 5× à l'identique : paire
oui/non (3 conventions, dont le motif qui a causé les radios inversées du C1C),
bloc NISS, bloc signature, `appliquerGroupes` (6 copies de 10 lignes). Décision
d'audit : ne mutualiser QUE ces 4 blocs, document par document, en commençant
par les deux plus petits (C46 : 11 champs, C47 : 12).

**Fichiers.** Modifier : `lib/pdf-forms/seed/_shared/moules.ts`,
`lib/pdf-forms/seed/c46-fields.ts`, `lib/pdf-forms/seed/c47-fields.ts` + leurs
tests seed. Garde-fous existants : `seeds-vs-pdf.test.ts`,
`widget-geometry.test.ts` (aucun écart nouveau toléré).

**Étapes.**
- [ ] Enrichir `moules.ts` : `ouiNonSur({ pdfOui, pdfNon, ... })` qui impose
  l'ordre des cases IMPRIMÉES (l'API rend l'inversion impossible : les widgets
  sont nommés par la réponse qu'ils portent), `champNISS(...)`,
  `champSignature(...)`, `appliquerGroupes(...)` — signatures calquées sur les
  usages actuels, zéro option spéculative.
- [ ] Migrer C46 puis C47 dessus ; diff runtime AVANT/APRÈS des champs générés
  (script jetable en scratchpad : JSON.stringify des deux listes → identiques).
- [ ] `/verif-reglementation`. `pnpm test` (les 8 suites seed + géométrie).
  Commit `refactor(pdf-forms): moules partagés branchés sur C46 et C47 (sortie identique)`.
- [ ] **Re-semis par Oraliks** après merge. Les 5 autres documents migreront
  au fil de leurs reprises (Sonnet suffira, le patron étant posé).

---

### S14 ♦ — C1-Regis réaligné — `Opus`

**Contexte.** = [NEXT_ACTIONS #31] enrichi par l'audit : 14 écarts géométriques
assumés (le pire du parc), aucun `stepGroup` (seul document resté au découpage
par section), absent de `PRESENTATION_BY_SLUG`, pas de `legacyIds` passé à
`mergeEnrichedFields` alors que `_merge.ts:4-10` le désigne, pas de date de
signature. Suivre la checklist de `docs/context/PDF_FORMS_RULES.md:370-381` et
le patron des 6 compagnons (trio QUESTIONS/GROUPE_IDENTITE/RATTACHEMENTS).
Créer aussi `scripts/gen-c1-regis-scenarios.ts` (décalque C1C) et passer
`verif-couverture-widgets.py` à 100 %.

**Fichiers.** `lib/pdf-forms/seed/c1-regis-fields.ts`,
`lib/pdf-forms/form-presentation.ts`, `lib/pdf-forms/__tests__/widget-geometry.test.ts`
(vider l'entrée), `lib/pdf-forms/seed/__tests__/c1-regis-fields.test.ts`,
`scripts/gen-c1-regis-scenarios.ts`. Session complète type « reprise de
document » — prévoir la relecture case par case du PDF généré par Oraliks.

---

### S15 — Docs à jour + monitoring + perf mineures — `Sonnet`

**Contexte.** Dérives constatées : CLAUDE.md/AGENTS.md « 271 tests » (réel :
2 246) et « ~74 erreurs lint » (réel : 129) ; `lib/pdf-forms/README.md` décrit
le flux admin-first d'origine et dit la police « non versionnée » (les 3 sont
suivies par git) ; `.env.example` idem ; `PROJECT_INDEX.md` référence
`lib/documents/bundle-conditions.ts` (déplacé sous `lib/bundles/`) ;
`/admin/monitoring` liste 6 crons en dur sur les 13 de `vercel.json`. Perf :
3 lectures disque de polices par génération ; `loadForm` et le run chargés 2×
par affichage de la page document.

**Étapes.**
- [ ] Mise à jour des 5 docs (chiffres, flux réel seed-first, polices, chemin bundles).
- [ ] Monitoring : dériver la liste des crons de `vercel.json` (import du JSON)
  au lieu du tableau en dur.
- [ ] Filler : mémoïser les 3 buffers de police en portée module
  (`let cached: Buffer | null`) — attention : rester lazy, ne rien charger à l'import.
- [ ] Page document : envelopper `loadForm` dans `React.cache()` (metadata +
  page partagent alors la même requête).
- [ ] `pnpm test` + `pnpm build`. Commit
  `chore(pdf-forms): docs réalignées, monitoring des crons dérivé, polices et loadForm mémoïsés`.

---

## Hors plan (décisions actées, aucune session à prévoir)

- **NL** : plus tard, par upload des PDF officiels NL via la route `version`
  (diff + migration d'enrichissement déjà en place) — décision n°6.
- **7 PDF restants** (C109-36 ×3, C27 ×2, C32, C6) : après 100 % des documents
  actuels — décision n°4. L'éditeur visuel reste en place pour les PDF plats.
- **Rate-limit partagé (Upstash)** : reste porté par NEXT_ACTIONS #13 (global,
  pas spécifique PDF).
- **Stockage des PDF générés** : définitivement NON — décision n°1.
- **Écritures concurrentes sur `BundleRun.payloads`/`draftPayloads`** (audit
  P-07) : deux onglets du même dossier qui valident en parallèle peuvent se
  perdre mutuellement un document (read-modify-write d'un objet JSON entier,
  sans verrou — `generate:283-309`, `draft:84-94`). **Risque connu et accepté
  en l'état** (usage mono-onglet dominant) ; à rouvrir en session dédiée
  (`jsonb_set` ciblé ou transaction avec garde `updatedAt`) si un cas réel
  remonte au support.
