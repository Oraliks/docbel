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
| 19 | P3 | i18n | Traduire les 3 questions d'aiguillage (parcours d'études/âge/a travaillé) du dossier allocations-insertion en 12 langues (pattern `*Key`, laissées FR-only lors du refresh du parcours) | `lib/dossiers/allocations-insertion/index.ts`, `messages/*.json` | Faible | `pnpm i18n:check` | à faire |
| 20 | P3 | i18n | Traduire le contenu du dossier `changement-situation-personnelle` (titre/description/journey/warning/doc/theory) dans les 12 langues, laissé FR-only à la création | `lib/dossiers/changement-situation-personnelle/index.ts`, `messages/*.json` | Faible | `pnpm i18n:check` | à faire |
| 21 | P2 | Dette | Identifier les 3 vrais noms AcroForm des dates de modification C1 (adresse/situation familiale/compte) via `scripts/dump-c1.ts` et stamper `dateModificationEffective` dessus à la génération PDF | `lib/pdf-forms/seed/c1-fields-improvements.ts`, `lib/pdf-forms/filler.ts` | Faible | `pnpm test` + génération PDF réelle | à faire |
| 22 | P3 | RioLex | Mappings « Codes ONEM liés » : **99 articles peuplés** via `scripts/generate-lookup-refs.ts` — code#→article# (sanction/admissibilité/indemnisation) **+ pont thématique dispo S38 / vérification V** (lien « table entière » sur articles titrés disponibilité/surveillance/révision/vérification, dont art. 168bis). Abrogés + pseudo-articles méta exclus, variantes Y/Z écartées. **Reste : QA visuelle Oraliks** | `lib/data/riolex-lookup-refs.json`, `scripts/generate-lookup-refs.ts` | Faible | `pnpm attach:lookup-refs --dry` + fiches article | en cours |
| 23 | P3 | Design | Unifier l'idiome de survol `hover:bg-white/NN` → `hover:bg-[color:var(--glass-surface)]` **repo-wide** (rendu mixte après le sweep couleurs du 2026-07-22 : converti sur certains écrans, laissé sur d'autres ; garder les voiles sur panneaux colorés) | 15 fichiers front (+ 5 déjà faits) | Faible | build + hover clair/sombre | **fait** (d8906a2, 2026-07-22) |
| 24 | P3 | Design | Migrer le vocabulaire de **dégradés décoratifs partagé** (`VARIANT_BG`, tuiles rainbow) vers tokens | `tool-card.tsx`, `tool-page.tsx`, `contact-page.tsx`, `confirm-account.tsx` (p/* déjà fait au sweep) | Moyen | écrans accueil + `/p` clair/sombre | **fait** (d39e398 + 14ce592) — inclut `THEME` employeur re-tokenisé en **bleu système** (`--chart-2`), distinct du citoyen violet ; accents forcés sombres (carte mockup toujours blanche) |
| 25 | P3 | Data | Harmoniser les couleurs **stockées en DB** vers la palette système + QA dark `--chart-*` | `app/globals.css`, `scripts/harmonize-db-colors.ts` | Faible→Moyen (prod) | mon-dossier + dark | **fait** (d39e398 + migration prod). **#25a** : override `--chart-*` hue-stable en dark scopé `.glass-root`. **#25b** : 19 bundles vidés (défaut #7C3AED périmé → CATEGORY_HUE ; **1 seule catégorie « emploi »** → primary uniforme mais on-palette+dark), 5 News mappées. Colonnes `color @default("#7C3AED")` → défaut à corriger (SQL additif) pour éviter la régression sur nouveaux rows |

## Plans de design
- **Refonte design complète du front public** — **VAGUE PUBLIQUE V1 LIVRÉE le 2026-07-21** →
  [2026-07-21-refonte-design-public-docbel.md](../superpowers/plans/2026-07-21-refonte-design-public-docbel.md).
  Direction hybride : accueil « guichet guidé » + cockpit `/mes-demarches` + portail éditorial/outils.
  Gamification douce intégrée comme règle transversale : progression, micro-feedback et célébration sobre,
  jamais de points/classements/streaks ni d'effet festif sur une inéligibilité ou un résultat réglementaire.
  Fondations, shell, accueil, guichet, cockpit, reprise, outils et actualités livrés ; build 235 pages,
  i18n, smoke test responsive/sombre et vérification réglementaire validés. Front public uniquement,
  zéro migration et aucune nouvelle bibliothèque d'animation.
- **Refonte parcours citoyen « Mes démarches »** — **VALIDÉ par Oraliks 2026-07-19, prêt à exécuter** →
  [2026-07-19-parcours-mes-demarches.md](../superpowers/plans/2026-07-19-parcours-mes-demarches.md).
  29 tâches en 5 lots, ordre **0 → 1 → 3 → 2 → 4** : quick wins (liens qui perdent `bundleRun`,
  code de reprise, header), vouvoiement + vocabulaire « démarche », espace transversal
  `/mes-demarches` (anonyme), rail de progression partagé `/d`+`/document` (verrou annoncé),
  guichet unique d'entrée. Décisions actées : vous partout · téléchargement tout-ou-rien
  conservé · parcours citoyen 100 % anonyme · « Mes démarches ». Zéro migration DB.
  Maquettes/diagnostic : artifact « Plan graphique — Parcours dossier DocBel » (19/07).
- **Refonte admin « partie users »** — **LIVRÉE (7 lots) 2026-07-13**, commits `f7e6184`→`dfe0257`
  (local, non poussé). Spec → [2026-07-10](../superpowers/specs/2026-07-10-admin-users-refonte-design.md).
  Build OK, 1663 tests verts, **aucune migration DB**. Livré : liste serveur (URL partageable,
  tri, export CSV), fiche 360° 5 onglets (Aperçu/Sécurité/Profil/Activité/Édition), actions
  admin (révoquer sessions, déverrouiller, vérifier email, bannir/débannir), édition complète
  (segment/TVA/partnerType/flags, Zod), hub « Comptes & accès » (bandeau + liens croisés).
  **Reste** : (a) **i18n** de `edit-user-form` + nouveaux composants (laissés FR inline pour ne
  pas entrer en conflit avec une session éditant `messages/*.json`) ; (b) décision métier
  anonymisation vs hard delete à la suppression (liée à l'item 12).
- **Qualité bureaux** (adresses officielles + liens complets + anti-dérive) →
  [BUREAUX_QUALITY_PLAN.md](BUREAUX_QUALITY_PLAN.md). Diagnostic chiffré 2026-07-10
  (`pnpm bureaux:audit`) : 910 adresses stub, 42 groupes de doublons OSM, 421/587 communes
  sans assignment chômage, 0 bureau vérifié. 5 lots, 3 décisions à trancher.
- **Réglementation V3** (« texte de loi vivant ») → [REGLEMENTATION_V3_PLAN.md](REGLEMENTATION_V3_PLAN.md) —
  **vagues 1-5 LIVRÉES 2026-07-03** (commits `ff2d26a`→`9028c45`, build+909 tests verts).
- **Réglementation V4** (« lecture augmentée & outils du conseiller » : glossaire au survol,
  sommaire flottant, paires AR↔AM, explorateur réforme, notes, dossiers…) →
  [REGLEMENTATION_V4_PLAN.md](REGLEMENTATION_V4_PLAN.md). Proposition 2026-07-03, 16 features en 5 vagues
  (V6-V10), rien codé. 4 décisions à trancher (structure loi, notes localStorage/DB, table signalements, réforme).
- **Page-builder — hardening + perf** (tests logique pure, code-splitting des 133 blocs
  au rendu public, intégrité `content Json`, découpage store/block-wrapper, safeEval) →
  [PAGE_BUILDER_PLAN.md](PAGE_BUILDER_PLAN.md). Proposition 2026-07-10, 5 lots (A-E),
  rien codé. 5 décisions à trancher (périmètre, bundle-analyzer, blocs legacy,
  rétention révisions, presets DB).

## Unification « Parcours & dossiers » — Lots 1→4 LIVRÉS + MERGÉS dans main
Rapproche PDF Forms ↔ Decision Builder (déjà couplés : moteur de conditions
partagé, arbre → `bundleSlug` → run). Commits `2b906e3`→`15fbc2c`, 1396 tests verts,
`/admin` + `/admin/parcours/analytics` compilent (HTTP 404 = garde auth).
Inclut le **fix build routes bundles** (`fix/bundles-run-routes` mergé : runs
unifiés sous `/api/bundles/runs/[runId]`, conflit `[bundleRunId]`/`[id]` résolu).
- **Lot 1** — nav fusionnée en un seul module « Parcours & dossiers » ordonné par
  étape (Orientation → Dossiers → Formulaires PDF → Organismes → Statistiques) ;
  rattache 2 pages orphelines (analytics PDF + soumissions).
- **Lot 2** — cross-links + intégrité : panneau « Référencé par » dans l'éditeur de
  dossier (arbres pointant dessus + lien) ; badge d'état + « Ouvrir le dossier » +
  alerte inactif/introuvable dans le sélecteur de résultat d'arbre ; garde-fou 409
  (DELETE + PUT active:false) si un arbre PUBLIÉ référence le dossier, avec forçage.
  `lib/decision-builder/references-core.ts` (pur, 7 tests). **Lot 2d déjà existant**
  (validateTreeContentAgainstDb bloque déjà la publication vers un dossier absent/inactif).
- **Lot 3** — `/admin/parcours/analytics` : funnel UNIQUE (recherche → orientation →
  dossier ouvert → démarré → **documents obtenus**) coloré par phase + drill-down vers
  les 2 dashboards détaillés. `lib/admin/parcours-funnel*` (core pur, 6 tests).
  ⚠️ **Découverte** : `BundleRun.completedAt` / `status="completed"` ne sont JAMAIS
  écrits (colonnes mortes) → le « complété » du cockpit (`getBundleFunnel().completed`,
  `getUsageKpis().completion`) vaut TOUJOURS 0. J'ai contourné en ajoutant l'event
  `documents_downloaded` (fin réelle du parcours). **Reste à faire** : soit écrire
  `completedAt` au bon endroit (transition allRequiredDone), soit retirer la métrique
  « complété » du cockpit. Historique non backfillé → « documents obtenus » se remplit
  à partir de maintenant.
- **Lot 4 — LIVRÉ** (branche `feat/parcours-canonical-keys`, spec+plan+10 commits code) :
  vocabulaire de clés canoniques (`lib/parcours/canonical-keys.ts`, starter à valider) +
  tags sur options d'arbre (`canonical`) et questions de pré-qual (`canonicalKey`/valeurs) +
  cœur pur `canonical-facts` (dérivation + prefill, testés) + UI de tagging admin
  (inspecteur de nœud, éditeur d'éligibilité, sentinel « Aucune ») + runtime serveur
  (`app/d/[slug]/page.tsx` résout les IDs d'OptionNode du cookie d'orientation contre
  l'arbre publié → prefill modifiable + badge « d'après vos réponses »). Repli sûr partout,
  zéro migration, exécuté en subagent-driven (tous reviews verts + revue finale opus).
  - **Dossiers codés — plomberie FAITE** (`ccccaf9`) : `DossierQuestion` porte `canonicalKey`/
    `canonicalTrue`/`canonicalFalse`/`canonicalValue`, transmis par `dossierQuestionsToEligibility`
    (question `statut` de chomage-complet taguée `a_deja_travaille` en démo, **mapping à valider**).
    **Reste pour voir le prefill se déclencher** (hors code) : (1) taguer les **options d'arbre**
    correspondantes en admin (inspecteur de nœud) ; (2) `DECISION_TREE_RUNTIME_ENABLED=true` ;
    (3) valider/étendre les mappings métier (dont les autres dossiers codés + la situation familiale).
  - Suivis mineurs (non bloquants, revue finale) : reset des valeurs canoniques stale au
    changement de clé dans l'éditeur ; type-guard au lieu du cast `nodes[id]` ; badge aussi
    sur les réponses issues de `prefillFromOrientation` (dossiers codés).
## Module « Paramètres globaux » — LIVRÉ + MERGÉ dans main
Page admin `/admin/parametres` type SaaS/CMS + câblage live. Spec :
[2026-07-11](../superpowers/specs/2026-07-11-parametres-globaux-design.md). Commits
`3e3fbce`→`693df42`, 1383 tests verts, vérifié end-to-end en dev (nom custom → titre
d'onglet + `og:site_name` + logo header).
- **Fait** : socle `lib/site-settings*.ts` (Zod + memo-cache, 21 tests) + API
  `/api/admin/site-settings` ; onglets Général/SEO/Maintenance+annonces ; métadonnées
  racine (`generateMetadata`) ; gate maintenance + bannière ; nom du site branché sur
  header/sidebar/OG (plus aucun « Docbel » codé en dur dans les métadonnées).
- **Suites (P2/P3, non faites)** : onglets de regroupement Emails/Intégrations/Conformité
  (surfacer les clés `AppSetting` existantes : toggles IA, `billing_enabled`, RGPD) ;
  templatiser le copyright du footer (nom encore dans `messages/*.copyright`) ;
  `app/robots.ts` lisant `noindex` ; libellé de nav i18n (actuellement hardcodé FR).
- ✅ **Blocage build routes bundles RÉSOLU** (via l'unification, mergée main) : runs
  unifiés sous `/api/bundles/runs/[runId]`, `pnpm build` repasse.

## Quick wins déjà faits cette session (cf. rapport)
- `.env.example` complété (clés réellement utilisées).
- `CLAUDE.md` créé ; `docs/` réorganisé ; `AGENTS.md` allégé.
- Avertissement `db push` ajouté au README.
- Audits/plans historiques déplacés sous `docs/`.

## Règles d'exécution
- Un item à la fois, **3–5 fichiers max** par lot. Items P0/P1 RGPD/sécurité d'abord.
- Tout item « migration / auth / cookies CMP complet / refonte » = **plan séparé**, jamais
  improvisé. Les items 12, 13 nécessitent un plan avant code.
