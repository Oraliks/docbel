// Dossier "Régime de chômage avec complément d'entreprise (RCC)" — anciennement
// « prépension ». Module autonome.
//
// Le RCC combine des allocations de chômage versées par l'ONEM et un
// complément payé par l'ex-employeur, au bénéfice de travailleurs âgés
// licenciés. Les conditions (âge, ancienneté, métier lourd, CCT applicable)
// évoluent régulièrement — ce module se contente d'orienter et de signaler
// les facteurs déterminants ; il ne tranche pas l'éligibilité.
//
// Aucun lien avec les autres dossiers (chomage-temporaire, chomage-complet,
// chomage-frontalier).

import type {
  DossierDefinition,
  DossierTheorySection,
} from "../types";

/// Sections de l'espace théorique. Paraphrasées en interne — aucune copie
/// verbatim de l'ONEM ou du SPF Emploi. Les bindings `{{ … }}` sont
/// interpolés au rendu depuis la structure du dossier.
const THEORY: DossierTheorySection[] = [
  {
    id: "qu-est-ce-que-le-rcc",
    title: "Qu'est-ce que le RCC ?",
    body: `
Le **RCC** (Régime de chômage avec complément d'entreprise) est l'ancienne
« prépension ». Le mot a changé en 2012 mais la logique reste la même :
un travailleur en fin de carrière qui est licencié touche **deux revenus
combinés** :

1. Les **allocations de chômage** versées par l'ONEM (comme un chômeur classique).
2. Un **complément d'entreprise** payé par l'ex-employeur, en plus des
   allocations. Ce complément n'est pas une faveur : il découle d'une
   convention collective (sectorielle ou d'entreprise).

Ce n'est donc pas une « préretraite » — la personne reste officiellement
chômeuse jusqu'à la pension légale, avec les obligations qui vont avec
(sauf dispense pour âge avancé).
    `.trim(),
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-10",
  },
  {
    id: "conditions-de-base",
    title: "Conditions de base",
    body: `
Quatre facteurs déterminent l'accès au RCC. Les seuils chiffrés (62 ans,
40 ans d'ancienneté, etc.) bougent au fil des accords interprofessionnels
et des CCT — ils sont indiqués à titre indicatif et doivent être vérifiés
auprès de l'organisme de paiement pour chaque dossier.

1. **Âge** — généralement 62 ans pour le régime général, 60 ans pour les
   métiers lourds. Des seuils plus bas existent dans certains régimes
   (longue carrière, entreprise en difficulté).
2. **Ancienneté de carrière** — typiquement 40 ans dans le régime général,
   33 ans pour les métiers lourds, parfois moins selon la CCT.
3. **Motif de fin de contrat** — il faut un **licenciement par l'employeur**.
   Une démission, une rupture amiable ou un départ volontaire ferment
   l'accès au RCC.
4. **CCT applicable** — il faut une convention collective (sectorielle
   ou d'entreprise) qui prévoit le RCC pour la situation du travailleur.

Les questions d'orientation du dossier interrogent ces facteurs :

{{ questions }}

Aucune réponse ne bloque l'utilisateur ; les réponses servent à pointer
les éléments à vérifier en priorité avec l'organisme de paiement.
    `.trim(),
    audience: ["admin", "partner"],
    bindings: ["questions"],
    lastReviewedAt: "2026-06-10",
  },
  {
    id: "regimes-speciaux",
    title: "Régimes spéciaux",
    body: `
À côté du régime général, plusieurs régimes RCC spécifiques existent. Ils
abaissent les seuils d'âge ou d'ancienneté, mais imposent leurs propres
conditions.

- **Métiers lourds** — travail de nuit, équipes successives (ex. 3×8),
  travail interrompu, conditions physiques pénibles. Permet généralement
  un accès dès 60 ans avec 33 ans de carrière (à vérifier selon la CCT).
- **Longue carrière (40 ans)** — destiné aux travailleurs qui cumulent
  40 ans de carrière, indépendamment du caractère « lourd » du métier.
- **Entreprise en difficulté** — l'employeur doit être officiellement
  reconnu comme tel par le ministre de l'Emploi. Conditions assouplies
  pour les travailleurs licenciés dans ce cadre.
- **Entreprise en restructuration** — situation similaire (plan de
  licenciement collectif reconnu), avec ses propres conditions d'âge et
  d'ancienneté.

Le régime applicable n'est pas un choix libre du travailleur : il
dépend de la CCT en vigueur dans l'entreprise ou le secteur, et de la
situation personnelle (âge, carrière, métier exercé). Le délégué
syndical et l'organisme de paiement sont les interlocuteurs naturels
pour identifier le bon régime.
    `.trim(),
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-10",
  },
];

export const prepension: DossierDefinition = {
  slug: "prepension",
  title: "Régime de chômage avec complément d'entreprise (RCC)",
  description:
    "Ancienne prépension : pour les travailleurs en fin de carrière licenciés par leur employeur, qui touchent à la fois des allocations de chômage et un complément payé par l'ex-employeur.",
  category: "emploi",
  icon: "🧓",
  color: "#7C3AED",
  vocabularyTags: [
    "prépension",
    "RCC",
    "fin de carrière",
    "complément entreprise",
    "métiers lourds",
    "longue carrière",
    "licenciement",
    "âge",
    "62 ans",
    "60 ans",
  ],
  types: [],

  questions: [
    {
      id: "age",
      label: { fr: "Quel âge as-tu ?" },
      helpText: {
        fr: "Le RCC commence en principe à partir de 60 ou 62 ans selon ta situation. Si tu as moins de 60 ans, l'accès au RCC est très limité (uniquement en cas de restructuration reconnue).",
      },
      type: "select",
      options: [
        { value: "moins-60", label: { fr: "Moins de 60 ans" } },
        { value: "60-61", label: { fr: "Entre 60 et 61 ans" } },
        { value: "62-63", label: { fr: "Entre 62 et 63 ans" } },
        { value: "64-plus", label: { fr: "64 ans ou plus" } },
      ],
    },
    {
      id: "anciennete",
      label: { fr: "Combien d'années de carrière as-tu accumulées ?" },
      helpText: {
        fr: "On compte ici toutes les années où tu as travaillé (ou été assimilé : service militaire, certaines périodes de chômage ou de maladie). Si tu n'es pas sûr, ton organisme de paiement peut faire le calcul exact à partir de ton compte individuel de pension.",
      },
      type: "select",
      options: [
        { value: "moins-30", label: { fr: "Moins de 30 ans" } },
        { value: "30-39", label: { fr: "Entre 30 et 39 ans" } },
        { value: "40-plus", label: { fr: "40 ans ou plus" } },
      ],
    },
    {
      id: "metierLourd",
      label: { fr: "As-tu exercé un métier lourd ?" },
      helpText: {
        fr: "Métier lourd = travail physiquement épuisant ou avec horaires difficiles (équipes 3×8, travail de nuit, chantier extérieur permanent…). Le SPF Emploi tient une liste — demande à ton organisme de paiement si tu n'es pas sûr.",
      },
      type: "boolean",
    },
    {
      id: "motifFinContrat",
      label: { fr: "Comment ton contrat de travail s'est-il terminé (ou va se terminer) ?" },
      helpText: {
        fr: "Pour avoir droit au RCC, il faut être LICENCIÉ par l'employeur. Si tu donnes ta démission ou si tu signes une rupture amiable, tu n'as pas droit au RCC — c'est une règle absolue.",
      },
      type: "select",
      options: [
        { value: "licenciement", label: { fr: "Licenciement par l'employeur" } },
        { value: "demission", label: { fr: "Démission de ma part" } },
        { value: "rupture-amiable", label: { fr: "Rupture amiable (accord commun)" } },
        { value: "autre", label: { fr: "Autre situation" } },
      ],
    },
    {
      id: "dateLicenciementApprox",
      label: { fr: "Depuis combien de temps as-tu été licencié (ou vas l'être) ?" },
      helpText: {
        fr: "Cette information sert à savoir si tu es encore dans les délais pour introduire ta demande ou si une décision a déjà été prise sur ton dossier.",
      },
      type: "select",
      options: [
        { value: "moins-3-mois", label: { fr: "Pas encore licencié ou moins de 3 mois" } },
        { value: "3-12-mois", label: { fr: "Entre 3 et 12 mois" } },
        { value: "1-2-ans", label: { fr: "Entre 1 et 2 ans" } },
        { value: "plus-2-ans", label: { fr: "Plus de 2 ans" } },
      ],
    },
    {
      id: "cctApplicable",
      label: { fr: "Quelle CCT (convention) s'applique à ta situation ?" },
      helpText: {
        fr: "CCT = Convention Collective de Travail. C'est un accord négocié entre patrons et syndicats qui fixe les conditions exactes. Si tu ne sais pas laquelle s'applique, demande à ton délégué syndical ou à ton organisme de paiement.",
      },
      type: "select",
      options: [
        { value: "regime-general", label: { fr: "Régime général" } },
        { value: "metiers-lourds", label: { fr: "Métiers lourds" } },
        { value: "longue-carriere", label: { fr: "Longue carrière (40 ans)" } },
        { value: "entreprise-difficulte", label: { fr: "Entreprise en difficulté" } },
        { value: "entreprise-restructuration", label: { fr: "Entreprise en restructuration" } },
        { value: "inconnu", label: { fr: "Je ne sais pas" } },
      ],
    },
    {
      id: "complementEntreprise",
      label: { fr: "Ton ex-employeur s'est-il engagé par écrit à payer le complément ?" },
      helpText: {
        fr: "Le RCC n'est PAS automatique : ton ex-employeur doit s'engager par écrit à payer le complément. Si l'employeur refuse, tu n'as pas accès au RCC — c'est juste du chômage classique.",
      },
      type: "boolean",
      visibleIf: { fieldId: "motifFinContrat", op: "equals", value: "licenciement" },
    },
    {
      id: "dispenseDispo",
      label: { fr: "As-tu obtenu une dispense de disponibilité adaptée pour le marché du travail ?" },
      helpText: {
        fr: "Dispense de disponibilité = autorisation de ne PAS chercher activement un emploi, accordée généralement aux personnes proches de la pension. Sans dispense, tu dois rester inscrit comme demandeur d'emploi.",
      },
      type: "boolean",
      visibleIf: { fieldId: "complementEntreprise", op: "equals", value: true },
    },
    {
      id: "inscritServiceEmploi",
      label: { fr: "Es-tu déjà inscrit comme demandeur d'emploi (FOREM, ACTIRIS, VDAB, ARBEITSAMT DG) ?" },
      helpText: {
        fr: "Sauf dispense, le bénéficiaire du RCC reste demandeur d'emploi et doit être inscrit auprès du service régional (FOREM en Wallonie, ACTIRIS à Bruxelles, VDAB en Flandre, ARBEITSAMT pour la communauté germanophone).",
      },
      type: "boolean",
    },
  ],

  warnings: [
    {
      title: "Licenciement obligatoire",
      message:
        "Le RCC nécessite IMPÉRATIVEMENT un licenciement par l'employeur. Si tu donnes ta démission, tu perds ce droit.",
      severity: "critical",
    },
    {
      title: "Seuils variables",
      message:
        "Les conditions d'âge et d'ancienneté changent régulièrement (loi-programme, accord interprofessionnel, CCT sectorielles). Vérifie auprès de ton organisme de paiement les seuils en vigueur pour ta situation.",
      severity: "warning",
    },
  ],

  documents: [
    {
      // C1 — Demande d'allocations (travailleur). Document central tant
      // qu'aucun formulaire RCC spécifique n'a été seedé.
      // Slug spécifique au dossier : les PdfForm slugs sont globaux et le
      // seed `force` supprime par slug.
      slug: "c1-prepension",
      title: "C1 — Demande d'allocations",
      issuer: "ONEM",
      required: true,
      sourcePdfPath: "private/pdfs/C1_FR.pdf",
      internalRef: "Dossier RCC — document central en l'absence de formulaire RCC dédié",
      fields: [
        { field: "niss", required: true, section: "identite", pdfFieldName: "NISS" },
      ],
    },
    // TODO: formulaire RCC spécifique (déclaration ONEM dédiée au RCC) —
    //       à seeder dès que le PDF source est disponible.
    // TODO: attestation employeur d'engagement au complément d'entreprise —
    //       à seeder (modèle SPF Emploi / CCT) avec ses propres champs.
  ],

  theory: THEORY,
};
