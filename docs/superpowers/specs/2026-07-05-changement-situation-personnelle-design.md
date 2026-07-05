# Spec — Dossier « Changement dans ma situation personnelle »

- **Date :** 2026-07-05
- **Statut :** design validé par Oraliks — à relire avant plan
- **Sujet :** nouveau type de dossier dont le document central est le C1,
  destiné à quiconque touche **déjà** des allocations et doit signaler un
  changement (adresse, compte bancaire, situation familiale/ménage, permis de
  séjour, cotisation syndicale, changement d'organisme de paiement) — avec
  couverture complète du C1 réel (les triggers activités/pension/incapacité/
  cohabitation déjà écrits s'appliquent aussi, sans travail supplémentaire).
- **Origine :** demande directe d'Oraliks, affinée par échange (cf. §2).

---

## 1. Contexte & problème

Les 5 dossiers codés aujourd'hui (`chomage-temporaire`, `chomage-complet`,
`chomage-frontalier`, `prepension`, `allocations-insertion`) modélisent tous
une **nouvelle demande**. Aucun ne couvre le cas de la personne déjà
indemnisée dont la situation change en cours de route — pourtant le
formulaire C1 réel modélise déjà précisément ce cas : un champ `motifIntroduction`
avec 4 valeurs (« première fois » / « interruption » / **« je déclare une
modification »** / **« je change d'organisme de paiement »**), et sous
« modification », 5 cases à cocher (adresse, compte bancaire, situation
familiale/ménage, permis de séjour, cotisation syndicale). Ce dossier donne à
ce cas d'usage une tuile et un parcours dédiés, sans dupliquer la logique
métier déjà écrite pour le C1.

## 2. Décisions validées (issues des échanges avec Oraliks)

- **Multi-sélection** : un dossier peut couvrir plusieurs changements
  simultanés (ex. adresse + compte bancaire) en un seul C1.
- **Périmètre v1** : couverture **complète** du C1 réel, pas seulement les
  5 catégories citées au départ — les triggers déjà écrits (activité
  accessoire, administrateur de société, indépendant, pension/retraite,
  incapacité 33 %, mandat artistique, tremplin-indépendants, cohabitation
  ambiguë, colocation, personne FAC) s'appliquent donc aussi.
- **Point d'entrée** : nouvelle tuile **indépendante** dans le hub
  (`/creer-ma-demande`), pas rattachée à un autre dossier — ce changement
  concerne n'importe quel bénéficiaire, pas seulement les gens en insertion.
- **Pas de questionnaire d'orientation** (`questions: []`) : conforme à
  l'abandon en cours du système d'aiguillage ailleurs dans le projet.
  L'interaction se fait **dans le formulaire C1 lui-même**, déjà organisé en
  sections (cf. `section-labels.ts`) — pas de mini-questionnaire séparé en
  amont.
- **Écran `journey` obligatoire** (4 étapes, composant `DossierJourneyIntro`
  déjà générique — cf. spec 2026-07-03) avant le formulaire.
- **Motif « changement d'organisme de paiement » inclus** dans ce même
  dossier (pas un dossier séparé) : vient sans coût puisque le champ
  `motifIntroduction` reste natif et éditable (cf. §3.4).
- `motifIntroduction` : **defaultValue = "modification"** (pas
  « interruption » — le chômage est présumé ininterrompu pour ce public).
  Le champ reste **visible et modifiable** (garde-fou si mauvais dossier,
  principe « informatif jamais bloquant »).
- **Date d'effet partagée** : 3 des 5 catégories de modification (adresse,
  situation personnelle/ménage, compte bancaire) ont chacune leur propre
  case date sur le PDF réel. Règle métier : si plusieurs sont cochées, elles
  doivent avoir la **même** date, sinon il faut une déclaration C1 séparée
  par date différente. Décision : **un seul champ date partagé** côté
  parcours (plutôt que 3 champs + validation croisée après coup) — rend le
  cas « dates incohérentes » structurellement impossible. « Cotisation
  syndicale » et « permis de séjour » n'ont pas de date.
- **Contenu « transferts d'organisme de paiement »** (délais d'introduction/
  prise d'effet selon le type d'allocation en cours — Chômage Complet / AGR /
  Chômage Temporaire) : source manifestement **interne** (jargon « BC »,
  « flux EC8 ») → **paraphrasée** en section `theory` (audience
  admin/partenaire), jamais reproduite verbatim. Version citoyenne = aide
  contextuelle simple, sans jargon, sans le détail des délais exacts.
- **Délai légal général de déclaration d'une modification** (hors transfert
  d'OP) : **non précisé** par Oraliks à ce stade → pas de chiffre inventé
  dans le contenu citoyen (cf. §5, §9).

## 3. Modèle de données & champs

Aucun nouveau type — tout réutilise `DossierDefinition` /
`PdfFormField` / `PdfFormTrigger` existants.

### 3.1 Nouveau module dossier

`lib/dossiers/changement-situation-personnelle/index.ts` :

```ts
export const changementSituationPersonnelle: DossierDefinition = {
  slug: "changement-situation-personnelle",
  title: "Changement dans ma situation personnelle",
  titleKey: "changementSituation.title",
  description:
    "Déclare un changement d'adresse, de compte bancaire, de situation familiale, de permis de séjour ou d'organisme de paiement pendant que tu touches des allocations.",
  descriptionKey: "changementSituation.description",
  category: "emploi",
  icon: "🔄",
  color: "#7C3AED", // violet accent unifié du design system
  vocabularyTags: [
    "changement d'adresse", "déménagement chômage", "changement de compte bancaire",
    "situation familiale", "permis de séjour", "changement d'organisme de paiement",
    "transfert FGTB CSC CAPAC SYNOVA", "C1 modification",
  ],
  types: [], // pas de motifs au niveau dossier : le choix vit dans le C1 lui-même
  questions: [],
  warnings: [
    {
      title: "Une seule date par déclaration",
      message:
        "Si tes changements n'ont pas tous la même date d'effet, fais une déclaration séparée pour chaque date différente.",
      severity: "info",
    },
  ],
  documents: [
    {
      slug: "c1-changement-situation",
      title: "C1 — Déclaration de changement de situation",
      titleKey: "changementSituation.doc.c1.title",
      issuer: "ONEM",
      required: true,
      sourcePdfPath: "private/pdfs/C1_FR.pdf",
      internalRef: "Dossier changement-situation-personnelle, document unique (motif « modification » / « changement d'organisme »).",
      fields: [
        { field: "niss", required: true, section: "identite", pdfFieldName: "NISS" },
      ],
    },
  ],
  journeyCtaLabel: "Déclarer mon changement",
  journeyCtaLabelKey: "changementSituation.journeyCtaLabel",
  journey: [ /* cf. §5 — 4 étapes */ ],
  theory: [ /* cf. §5 — section transferts d'OP, admin/partenaire */ ],
};
```

### 3.2 Registre

`lib/dossiers/registry.ts` : import + une ligne dans `REGISTRY`, comme les
5 autres. Aucun impact sur les dossiers existants (garanti par le
commentaire déjà présent dans ce fichier).

### 3.3 Nouvelle cible PdfForm

`lib/pdf-forms/seed/apply-c1-improvements-core.ts` — ajouter à
`C1_IMPROVEMENT_TARGETS` :

```ts
{ slug: "c1-changement-situation", improve: applyC1Improvements, triggers: C1_TRIGGERS },
```

**Séquence de seed (confirmée, déjà éprouvée pour les 5 autres dossiers) :**
`applyOneC1Improvement` fait un `prisma.pdfForm.findUnique({ where: { slug } })`
et renvoie `not_found` si la ligne n'existe pas — ce mécanisme **met à jour**
un `PdfForm` existant, il ne le **crée** pas. La création se fait via
`seedDossier(def, userId)` (`lib/dossiers/seed.ts`), déjà exposé pour
n'importe quel dossier du registre par `POST
/api/admin/bundles/seed/[slug]` (`app/api/admin/bundles/seed/[slug]/route.ts`) :
idempotent par slug, ingère `sourcePdfPath` (private/pdfs/C1_FR.pdf),
crée le `DocumentBundle` + le `PdfForm` "c1-changement-situation" + son
`DocumentBundleItem`. Ordre d'exécution en prod :
1. Enregistrer le dossier dans `registry.ts`.
2. `POST /api/admin/bundles/seed/changement-situation-personnelle` (crée la ligne PdfForm, champs auto-inférés).
3. Ajouter la cible à `C1_IMPROVEMENT_TARGETS` puis rejouer
   `POST /api/admin/pdf-forms/apply-c1-improvements` (enrichit les champs + attache les triggers, comme pour `c1`/`c1-insertion`).

Aucune migration de schéma (le modèle `PdfForm` existe déjà) : uniquement des
INSERT/UPDATE Prisma Client — conforme à la règle absolue du projet sur la
Neon partagée (jamais `db push`).

### 3.4 Champ `motifIntroduction` — defaultValue paramétré

`applyC1Improvements()` (dans `c1-fields-improvements.ts`) est **partagée**
entre `c1`, `c1-insertion` et (désormais) `c1-changement-situation`. Un
`defaultValue` figé sur `motifIntroduction` s'appliquerait aux trois, ce qui
n'est pas voulu (les deux autres doivent garder leur comportement actuel,
sans défaut sur « modification »). → ajouter un paramètre optionnel à
`applyC1Improvements(fields, opts?: { defaultMotif?: string })`, appelé avec
`{ defaultMotif: "modification" }` uniquement pour la nouvelle cible. Petit
changement d'API, à documenter dans le plan (signature + les deux autres
appels inchangés).

### 3.5 Nouveau champ `dateModificationEffective`

Ajouté dans `C1_QUESTIONS` (ou équivalent), section `demande`, juste après
les 5 cases de modification :

```ts
{
  id: "dateModificationEffective",
  pdfFieldName: "", // à déterminer — cf. note ci-dessous
  type: "date",
  required: false,
  label: { fr: "Date d'effet de la/les modification(s) cochée(s) ci-dessus", nl: "", de: "" },
  help: {
    fr: "Une seule date pour l'adresse, la situation personnelle/du ménage et le compte bancaire. Ne concerne pas la cotisation syndicale ni le permis de séjour (pas de date sur le formulaire officiel).",
    nl: "", de: "",
  },
  visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
  section: SECTION_DEMANDE,
  order: 9.5,
}
```

⚠️ **Point d'implémentation, pas résolu ici** : le PDF officiel a 3 cases
date distinctes (adresse / situation personnelle-ménage / compte bancaire),
actuellement **non mappées** dans le code (seules les checkbox le sont). Il
faudra identifier les 3 vrais noms AcroForm via `scripts/dump-c1.ts` et, à la
génération du PDF, stamper la valeur unique de `dateModificationEffective`
sur les 3 emplacements correspondant aux cases effectivement cochées. Tâche
de plan/implémentation, pas de design.

### 3.6 Aide citoyenne sur `dateChangementOrganisme`

Champ existant, enrichi (texte simple, sans jargon, sans délai chiffré
inventé) :

```ts
help: {
  fr: "Le transfert prend effet le mois suivant, sous certaines conditions de délai qui dépendent de ton type d'allocation actuel. Ton nouvel organisme de paiement te confirmera la date exacte.",
  nl: "", de: "",
},
```

## 4. Parcours utilisateur

```
Hub (/creer-ma-demande)
  └─ tuile « Changement dans ma situation personnelle »
       └─ écran journey (4 étapes + CTA « Déclarer mon changement »)
            └─ formulaire C1, organisé en sections existantes
                 (motif pré-sélectionné « modification », éditable)
                 └─ triggers évalués en direct →
                      matérialisation auto des formulaires compagnons
                      pertinents (C1A/B/C, C46, C47, C1-Partenaire, C1-Regis)
                 └─ génération PDF (C1 + compagnons stampés)
```

Aucune nouvelle route : `app/d/[slug]/page.tsx` gère déjà `journey` +
`BundleRunner` + matérialisation des triggers de façon générique.

## 5. Contenu — journey & theory

**Journey (brouillon à valider par Oraliks — aucun délai chiffré inventé) :**

```ts
journey: [
  { order: 1, icon: "user-check", title: "Ta situation a changé",
    body: "Déménagement, nouveau compte bancaire, changement familial, permis de séjour ou envie de changer d'organisme de paiement : ce formulaire couvre ces cas." },
  { order: 2, icon: "file-check", title: "Un seul C1 pour plusieurs changements",
    body: "Tu peux cocher plusieurs cases à la fois si elles prennent effet à la même date. Sinon, fais une déclaration séparée par date." },
  { order: 3, icon: "calendar", title: "Prépare tes informations",
    body: "Nouvelle adresse, IBAN, date d'effet — aie ces éléments sous la main avant de commencer." },
  { order: 4, icon: "wallet", title: "Envoi à ton organisme de paiement",
    body: "Une fois complété, le C1 (et les formulaires complémentaires si besoin) part vers ton organisme de paiement (FGTB, CSC, SYNOVA, CAPAC)." },
],
```

**Theory (admin/partenaire uniquement, paraphrase — jamais verbatim) :**

```ts
theory: [{
  id: "transferts-organisme-paiement",
  title: "Délais des transferts d'organisme de paiement",
  body: `
Le délai d'introduction et la prise d'effet d'un transfert d'organisme de
paiement dépendent du type d'allocation en cours :

- **Chômage complet / AGR** : demande à introduire au plus tard le dernier
  jour du mois précédant celui visé par le transfert ; prise d'effet le
  1ᵉʳ jour du mois suivant la réception du flux par le bureau du chômage.
- **Chômage temporaire** : demande à introduire au plus tard le dernier jour
  du 2ᵉ mois qui suit celui visé ; prise d'effet dès le 1ᵉʳ jour du mois
  visé (sauf chômage temporaire déjà indemnisé pour ce mois).

Source interne (formation partenaire) — paraphrasé, jamais cité verbatim.
  `.trim(),
  audience: ["admin", "partner"],
  internalRef: "Slide interne « Transferts d'OP » (formation partenaire), reçue 2026-07-05.",
  lastReviewedAt: "2026-07-05",
}],
```

## 6. i18n

Namespace `public.dossierContent.changementSituation.*` : `title`,
`description`, `journeyCtaLabel`, `journey.step<1-4>.{title,body}`,
`doc.c1.title`. Même méthode que le refresh `insertion` (traduction soignée
dans les 12 langues déjà couvertes, pas de traduction mécanique). Le contenu
`theory` reste non traduit (audience admin/partenaire uniquement, comme les
sections theory existantes).

## 7. Tests / validation

- Test unitaire sur la nouvelle cible de seed (mirroring
  `c1a-fields.test.ts` etc.) : présence des champs hérités, `defaultValue`
  appliqué uniquement à cette cible (pas de régression sur `c1`/`c1-insertion`),
  visibilité de `dateModificationEffective`.
- Pas de nouveau test sur `triggers.ts` (mécanisme générique réutilisé tel
  quel, déjà testé).
- `pnpm test`, `pnpm build`, `pnpm i18n:check`.
- Vérification manuelle (preview) :
  - tuile visible sur `/creer-ma-demande`, clic → écran journey.
  - CTA → formulaire C1, motif pré-sélectionné « modification ».
  - plusieurs cases de modification cochées → un seul champ date apparaît.
  - `motifIntroduction` changé manuellement vers « changement d'organisme
    de paiement » → `dateChangementOrganisme` s'affiche avec son aide.
  - au moins un trigger d'activité (ex. « activité accessoire » = oui) →
    C1A matérialisé dans le parcours.
  - `c1`/`c1-insertion` inchangés (pas de defaultValue « modification »
    qui fuiterait dessus).

## Hors périmètre (explicitement)

- Pas de nouveau moteur de validation cross-champs générique — le champ
  date partagé résout le cas par construction.
- Pas de modification du mécanisme de triggers/formulaires compagnons
  (réutilisé tel quel, déjà générique et branché).
- Pas de nouvelle route (suit le pattern `app/d/[slug]/page.tsx` existant).
- Délai légal général de déclaration d'une modification (hors transfert
  d'OP) : non chiffré, faute de source confirmée par Oraliks — à ajouter
  plus tard si la règle exacte est fournie.
- Le motif « changement d'organisme de paiement » reste un simple champ du
  C1 existant : pas de logique de vérification des conditions d'éligibilité
  au transfert (hors périmètre — informatif via l'aide contextuelle
  uniquement).
