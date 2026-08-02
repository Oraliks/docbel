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
| 25 | P3 | Data | Harmoniser les couleurs **stockées en DB** vers la palette système + QA dark `--chart-*` | `app/globals.css`, `scripts/harmonize-db-colors.ts` | Faible→Moyen (prod) | mon-dossier + dark | **fait** (d39e398 + migration prod). **#25a** : override `--chart-*` hue-stable en dark scopé `.glass-root`. **#25b** : 19 bundles vidés (défaut #7C3AED périmé → CATEGORY_HUE ; **1 seule catégorie « emploi »** → primary uniforme mais on-palette+dark), 5 News mappées. Défauts `color @default("#7C3AED")` **corrigés** (56abf08) : 6 colonnes → `#5B46E5` / `""` (bundle) via `prisma/migrations/harmonize_color_defaults.sql` |

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

### Formulaires PDF — issus de la refonte C1A (2026-07-29)

| # | Prio | Cat. | Objectif | Fichiers probables | Risque | Validation | Statut |
|---|------|------|----------|--------------------|--------|------------|--------|
| 26 | P2 | Dette | Retirer les 2 regles de tamponnage du C1 devenues redondantes depuis le correctif `autoAnswered` (motif + remarque famille). Deux mecanismes ecrivent la meme case ; le PDF sort identique aujourd'hui. A faire **la prochaine fois qu'on ouvre le C1** | `lib/pdf-forms/bindings/per-form/c1-changement.ts` | Moyen (change ce qui s'imprime) | relecture d'un PDF C1 case par case | a faire |
| 27 | P2 | Dette | Reparer les 2 champs du C1 masques par `hidden` alors qu'ils portent une donnee : leur case part **blanche** (`adresse_email_facultatif`, `num_ro_de_t_l_phone_facultatif`) | `lib/pdf-forms/seed/c1/identite.ts` | Faible | PDF C1 genere | a faire |
| 28 | P2 | Dette | Appliquer `inheritedFromDossier` aux 6 autres compagnons (mecanisme pret, applique au seul C1A) — **un document a la fois** | `lib/pdf-forms/seed/c1b-fields.ts` etc. | Faible | PDF genere par document | C1C fait ; les 4 suivants couverts par le plan ci-dessous |
| 29 | P2 | Dette | Realigner la geometrie des 6 compagnons non traites : leurs ecarts sont deja consignes en dette dans `ECARTS_ASSUMES` — un lot par document | `lib/pdf-forms/seed/*-fields.ts` | Moyen | `widget-geometry.test.ts` | C1C fait ; les 4 suivants couverts par le plan ci-dessous |
| 30 | P2 | Dette | **C1B, C46, C47, C1-Partenaire** — plan ecrit et diagnostic deja fait : `docs/superpowers/plans/2026-07-30-formulaires-onem-restants.md`. **Un formulaire par session**, ordre C47 → C1-Partenaire → C46 → C1B. Le gros du travail est le PARCOURS (les 4 sont a 0 champ groupe et 0 champ herite), plus 3 champs multi-widgets qui ecrivent la meme valeur dans 2 a 4 cases distinctes | `lib/pdf-forms/seed/*-fields.ts`, `form-presentation.ts` | Moyen (ce qui s'imprime) | scenarios + `verif-couverture-widgets.py` a 100 % + relecture PDF | a faire |
| 31 | P3 | Dette | Annexe Regis — hors du plan ci-dessus, et la plus lourde en dette : **14 ecarts** de geometrie assumes (contre 1 a 3 pour les autres) | `lib/pdf-forms/seed/c1-regis-fields.ts` | Moyen | `widget-geometry.test.ts` | **FAIT** (S14, 7046dc7) — 0 ecart, parcours en etapes, recette 40/42 |
| 32 | P2 | Metier | **Widget « Date de DA » : deux sens dans le parc, a trancher une fois.** Le C1-Partenaire et le C1-Regis y posent la date du JOUR (champ auto, invisible du citoyen, `prefillFrom: system.today`) sous le libelle imprime « date de la demande d'allocations » ; le C1 principal, lui, y reprend une date DECLAREE (`date-header-p2` → `dateModificationEffective`/`dateDemande`). Soit c'est une case de cachet dateur et la date du jour convient, soit c'est la date de la demande et le citoyen doit pouvoir la saisir | `lib/pdf-forms/seed/c1-regis-fields.ts`, `c1-partenaire-fields.ts`, `bindings/per-form/c1-changement.ts` | Moyen (ce qui s'imprime sur une declaration officielle) | relecture d'un PDF de chaque | **Oraliks** — decision metier |
| 33 | P2 | Contenu | **Transcrire la legende « Explications relatives a la rubrique I »** (page 2 de l'Annexe Regis : familles de codes N / A / FN1-FN5 / FY1-FY5) dans la base chomage. Aujourd'hui l'Annexe Regis n'existe NULLE PART dans `docs/knowledge/chomage/` : tout texte d'aide de son seed est structurellement non sourçable, et l'aide FN4 affirme deux conditions (« aucun lien de parente », « vie financiere ») absentes de la seule citation disponible au depot | `docs/knowledge/chomage/formulaires-onem.md`, `RULES_INDEX.md` | Faible | `/verif-reglementation` sur le seed c1-regis | **Oraliks** — legende en main |
| 34 | P3 | Contenu | Aide « verifiez sur votre eID » posee sur la ligne ADRESSE du C1-Regis : l'adresse n'est pas imprimee sur la carte eID belge (elle vit dans la puce). Le geste concret est plutot un extrait de registre / composition de menage delivre par la commune | `lib/pdf-forms/seed/c1-regis-fields.ts` | Faible | relecture | **Oraliks** — a confirmer |
| 35 | P3 | Conformite | Phrase de prudence « Docbel ne remplace pas une decision de l'ONEM ou de votre organisme de paiement » ABSENTE de tout `components/pdf-forms/**` : un citoyen remplit et telecharge un formulaire officiel sans jamais la lire. Un encart unique couvrirait les 8 documents | `components/pdf-forms/document-page-layout.tsx` ou `form-shell.tsx` | Faible | ecran d'un document | a faire |
| 36 | P3 | Dette | Le 4e widget du champ `voir 19` (C1A) n'est servi par aucun scenario de recette : les trois revenus de Q19 s'ecrivent en positionnel et ne couvrent que 3 de ses 4 rectangles. Verifier sur le papier si cette 4e case attend quelque chose | `lib/pdf-forms/seed/c1a-fields.ts` | Faible | `verif-couverture-widgets.py` | **FAIT** (2026-08-02) — ce n'etait pas une case vide : c'est la 4e ligne du bloc « irregulierement » de Q18, jamais remplie |
| 37 | P3 | Dette | Le C1A imprime la 4e ligne de « mentionnez-les toutes » 11 pt trop a droite : le PDF officiel pose deux widgets sur cette ligne (n°4 decale, n°5 aligne) et le template `{index}` ne permet pas de sauter le n°4. Un `pdfFieldNames` explicite par ligne reglerait le calage | `lib/pdf-forms/types.ts`, `filler.ts`, `c1a-fields.ts` | Faible | PDF genere | **FAIT** (2026-08-02) — `pdfFieldNames` explicite par ligne ; les 4 activites sont alignees |
| 38 | P3 | Dette | Le nom de l'en-tete page 2 du C1 et du C1B chevauche legerement son pointille (regles `nom-header-p2` / `bind("nom")`). Lisible, mais moins net que les peignes voisins recalés le 2026-08-02 | `lib/pdf-forms/filler.ts` (POSITIONAL_EXTRA_STAMPS), `bindings/per-form/c1b.ts` | Faible | PDF genere | **FAIT** (2026-08-02) — les deux noms passent en stamp positionnel |

### Suites de l'audit PDF-forms (2026-08-01)

Audit complet du système de formulaires PDF réalisé le 2026-08-01 (rapport en
conversation ; constats vérifiés fichier:ligne ; 2 246 tests verts, build OK,
lint 129 erreurs pré-existantes). Décisions Oraliks intégrées : opposabilité
par stats sans stockage de fichiers · admin en lecture seule sur les 8 ONEM ·
code mort à retirer · date de téléchargement voulue · 100 % FR · vous partout.

**Plan d'exécution en 15 sessions (1 session = 1 lot, modèle recommandé par
lot)** → [2026-08-01-suites-audit-pdf-forms.md](../superpowers/plans/2026-08-01-suites-audit-pdf-forms.md).
Ordre : S1 RGPD logs/anonymisation → S2 CI → S3 cohérence dossier → S4 correctifs
divers → S5 gel admin ONEM → S6 sync traçable → S7 opposabilité+diagnostics →
S8 ensureWriteAllowed → S9 code mort → S10 vouvoiement seeds → S11 e2e C47 →
S12 runner dégraissé → puis S13 moules (C46+C47) / S14 C1-Regis (= item #31)
au fil des reprises, S15 docs/monitoring quand on veut. S1–S12 sont
indépendants des items #26–#30 ci-dessus.

## Règles d'exécution
- Un item à la fois, **3–5 fichiers max** par lot. Items P0/P1 RGPD/sécurité d'abord.
- Tout item « migration / auth / cookies CMP complet / refonte » = **plan séparé**, jamais
  improvisé. Les items 12, 13 nécessitent un plan avant code.
