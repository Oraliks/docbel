/// Arbre d'orientation ONEM/RVA 2026 — données fournies par Oraliks (doc
/// "docbel_onem_wizard_orientation_2026", 21/06/2026), collées VERBATIM ici.
/// Un mapper pur `mapOnem2026ToWizardSituations()` les convertit vers le format
/// `WizardSituation[]` de l'app (types canoniques lib/dossier-wizard/config.ts).
///
/// Règles de mapping :
///   - availability "orientation_externe" → dossierSlug forcé à null (ce n'est
///     pas un dossier Docbel ; rendu en carte de contact).
///   - availability "disponible"/"a_creer" → slug conservé (un dossier réel ou
///     un stub existe).
///   - availability + nextStep conservés ; sourceIds/adminNotes ignorés (doc
///     interne, non exposé).

import type {
  WizardResult,
  WizardSituation,
  WizardSubOption,
} from "../../../lib/dossier-wizard/config";

// ── Types V2 du document (locaux) ───────────────────────────────────────────

type DossierSlug =
  | "chomage-complet"
  | "chomage-temporaire"
  | "changement-situation-personnelle"
  | "allocations-insertion"
  | "reforme-fin-droit-chomage"
  | "travail-temps-partiel-maintien-droits"
  | "allocation-garantie-revenus"
  | "travail-etranger-frontalier"
  | "document-u1"
  | "rcc"
  | "interruption-carriere-credit-temps"
  | "conges-thematiques"
  | "vacances-jeunes"
  | "vacances-seniors"
  | "travail-des-arts"
  | "ffe-fermeture-entreprise"
  | "activite-pendant-chomage"
  | "dispense-formation-stage"
  | "incapacite-sante"
  | "autre-contact";

interface WizardResultV2 {
  dossierSlug: DossierSlug | null;
  dossierTitle: string;
  availability: "disponible" | "a_creer" | "orientation_externe";
  rationale: string;
  nextStep: string;
  matchLevel?: "recommande" | "pertinent" | "a_verifier";
  allocationEstimate?: boolean;
  related?: DossierSlug[];
  adminNotes?: string;
  sourceIds?: string[];
}

interface WizardRefineOptionV2 {
  value: string;
  label: string;
  helpText?: string;
  result: WizardResultV2;
}

interface WizardSubOptionV2 {
  value: string;
  label: string;
  helpText?: string;
  refineQuestion?: {
    question: string;
    helpText?: string;
    options: WizardRefineOptionV2[];
  };
  result?: WizardResultV2;
}

interface WizardSituationV2 {
  value: string;
  icon:
    | "Briefcase"
    | "Search"
    | "GraduationCap"
    | "Hourglass"
    | "Accessibility"
    | "HelpCircle"
    | "UserMinus"
    | "MapPinned";
  label: string;
  description?: string;
  subQuestion?: {
    question: string;
    helpText?: string;
    options: WizardSubOptionV2[];
  };
  result?: WizardResultV2;
}

// ── Slugs réellement disponibles en base (dossiers actifs) ───────────────────
// Tout le reste est "a_creer" (stub) ou "orientation_externe".
export const ONEM_2026_AVAILABLE_SLUGS = [
  "chomage-complet",
  "chomage-temporaire",
  "changement-situation-personnelle",
] as const;

// ── Littéral VERBATIM du document ────────────────────────────────────────────

const wizardSituationsOnem2026: WizardSituationV2[] = [
  {
    value: "contrat-suspendu",
    icon: "Hourglass",
    label: "Votre contrat est temporairement suspendu",
    description: "Vous gardez votre contrat, mais vous ne travaillez pas temporairement.",
    subQuestion: {
      question: "Pourquoi votre travail est-il suspendu ?",
      helpText: "Cette porte concerne les situations où votre contrat continue, mais où votre employeur ne vous fait pas travailler temporairement.",
      options: [
        {
          value: "chomage-temporaire-economique-intemperies-technique",
          label: "Manque de travail, intempéries ou accident technique",
          helpText: "Votre employeur vous annonce que vous êtes temporairement sans travail, mais sans fin de contrat.",
          result: {
            dossierSlug: "chomage-temporaire",
            dossierTitle: "Chômage temporaire",
            availability: "disponible",
            rationale: "Votre contrat semble continuer, mais l’exécution du travail est suspendue temporairement. Le dossier à vérifier est donc le chômage temporaire.",
            nextStep: "Préparez une orientation vers le chômage temporaire et indiquez que l’utilisateur doit contacter son organisme de paiement le plus rapidement possible.",
            matchLevel: "recommande",
            allocationEstimate: false,
            sourceIds: ["ONEM_CHOMAGE_TEMPORAIRE", "ONEM_EC32"],
          },
        },
        {
          value: "chomage-temporaire-force-majeure-greve-lockout",
          label: "Force majeure, grève, lock-out ou fermeture temporaire",
          helpText: "Par exemple : impossibilité de travailler, fermeture temporaire, grève, lock-out ou autre suspension annoncée par l’employeur.",
          result: {
            dossierSlug: "chomage-temporaire",
            dossierTitle: "Chômage temporaire à vérifier",
            availability: "disponible",
            rationale: "Ces situations peuvent relever du chômage temporaire lorsque le contrat n’est pas rompu. Le motif exact doit cependant être confirmé par l’employeur ou l’organisme de paiement.",
            nextStep: "Orienter vers la page chômage temporaire, avec un avertissement : l’employeur doit avoir déclaré correctement la situation.",
            matchLevel: "pertinent",
            allocationEstimate: false,
            sourceIds: ["ONEM_CHOMAGE_TEMPORAIRE", "ONEM_TEMPS_PARTIEL"],
          },
        },
        {
          value: "absence-maladie-ou-incapacite-pendant-contrat",
          label: "Maladie, accident ou incapacité pendant le contrat",
          helpText: "Vous ne travaillez pas parce que votre état de santé vous empêche de travailler.",
          result: {
            dossierSlug: "incapacite-sante",
            dossierTitle: "Incapacité de travail ou mutuelle",
            availability: "orientation_externe",
            rationale: "Lorsque l’arrêt de travail est lié à une incapacité de santé, l’orientation principale n’est généralement pas le chômage mais la mutuelle ou l’organisme compétent.",
            nextStep: "Afficher une orientation prudente vers la mutuelle, avec possibilité de revenir vers chômage complet si le contrat est ensuite terminé.",
            matchLevel: "a_verifier",
            allocationEstimate: false,
            related: ["chomage-complet"],
          },
        },
      ],
    },
  },
  {
    value: "perte-emploi-fin-contrat",
    icon: "UserMinus",
    label: "Vous avez perdu votre emploi",
    description: "Votre contrat est terminé, va se terminer, ou vous voulez rouvrir un dossier après une interruption.",
    subQuestion: {
      question: "Quelle situation correspond à votre fin de contrat ?",
      helpText: "Depuis le 01/03/2026, il faut distinguer les nouvelles demandes, les redemandes et les mesures transitoires.",
      options: [
        {
          value: "premiere-demande-apres-emploi",
          label: "C’est votre première demande après une période de travail",
          helpText: "Vous demandez des allocations de chômage complet pour la première fois après une occupation salariée.",
          refineQuestion: {
            question: "Votre demande concerne-t-elle une date à partir du 1er mars 2026 ?",
            helpText: "Les conditions d’accès ont changé à partir du 01/03/2026.",
            options: [
              {
                value: "premiere-demande-apres-28022026",
                label: "Oui, la demande concerne une date à partir du 1er mars 2026",
                result: {
                  dossierSlug: "chomage-complet",
                  dossierTitle: "Chômage complet après occupation — nouvelle réglementation 2026",
                  availability: "disponible",
                  rationale: "Vous indiquez une première demande après une occupation salariée dans le régime applicable depuis le 01/03/2026. Le bon dossier d’orientation est le chômage complet après occupation.",
                  nextStep: "Orienter vers chômage complet et afficher clairement que le guide ne vérifie pas le nombre de jours requis ni le montant.",
                  matchLevel: "recommande",
                  allocationEstimate: true,
                  sourceIds: ["ONEM_T200", "ONEM_T201", "ONEM_T202"],
                },
              },
              {
                value: "premiere-demande-avant-01032026-ou-transition",
                label: "Non, ou vous étiez déjà concerné avant mars 2026",
                result: {
                  dossierSlug: "reforme-fin-droit-chomage",
                  dossierTitle: "Mesures transitoires de la réforme du chômage",
                  availability: "a_creer",
                  rationale: "Les demandes liées à une situation déjà ouverte avant le 01/03/2026 peuvent relever des mesures transitoires. Il faut éviter de les mélanger avec une nouvelle demande classique.",
                  nextStep: "Créer un parcours dédié aux mesures transitoires et inviter l’utilisateur à vérifier les courriers reçus de l’ONEM ou de son organisme de paiement.",
                  matchLevel: "a_verifier",
                  allocationEstimate: false,
                  related: ["chomage-complet"],
                  sourceIds: ["ONEM_REFORME_2026", "ONEM_T202"],
                },
              },
            ],
          },
        },
        {
          value: "redemande-apres-interruption",
          label: "Vous avez déjà eu des allocations et vous refaites une demande",
          helpText: "Par exemple après un travail, une maladie, une formation, une interruption ou une fin de droit.",
          result: {
            dossierSlug: "chomage-complet",
            dossierTitle: "Redemande de chômage complet après interruption",
            availability: "disponible",
            rationale: "Vous semblez vouloir rouvrir ou réexaminer un droit après une interruption. Depuis mars 2026, certaines redemandes doivent être traitées selon la nouvelle réglementation si les conditions d’un nouveau droit sont réunies.",
            nextStep: "Orienter vers chômage complet, mais afficher une alerte : redemande, interruption et mesures transitoires doivent être vérifiées par l’organisme de paiement.",
            matchLevel: "pertinent",
            allocationEstimate: true,
            related: ["reforme-fin-droit-chomage"],
            sourceIds: ["ONEM_T200", "ONEM_T202"],
          },
        },
        {
          value: "fin-contrat-enseignement",
          label: "Vous travailliez dans l’enseignement",
          helpText: "Votre contrat dans l’enseignement est terminé ou suspendu selon les périodes scolaires.",
          result: {
            dossierSlug: "chomage-complet",
            dossierTitle: "Chômage complet après occupation dans l’enseignement",
            availability: "disponible",
            rationale: "Les occupations dans l’enseignement peuvent mener à une demande de chômage complet, mais certains documents et périodes spécifiques doivent être vérifiés.",
            nextStep: "Orienter vers chômage complet avec une note spéciale : occupation dans l’enseignement, rémunération différée et documents employeur à vérifier.",
            matchLevel: "a_verifier",
            allocationEstimate: true,
            sourceIds: ["ONEM_T200", "ONEM_T74"],
          },
        },
        {
          value: "demission-commun-accord-litige",
          label: "Vous avez démissionné, signé un accord ou il y a un litige",
          helpText: "Par exemple : départ volontaire, rupture d’un commun accord, abandon, sanction, désaccord avec l’employeur.",
          result: {
            dossierSlug: "chomage-complet",
            dossierTitle: "Chômage complet avec vérification du motif de fin de contrat",
            availability: "disponible",
            rationale: "La demande peut relever du chômage complet, mais le motif de la fin du contrat peut avoir une influence importante. Le pré-guide ne doit pas conclure automatiquement.",
            nextStep: "Orienter vers chômage complet avec matchLevel à vérifier et recommander de contacter l’organisme de paiement avant toute conclusion.",
            matchLevel: "a_verifier",
            allocationEstimate: true,
            sourceIds: ["ONEM_T200"],
          },
        },
      ],
    },
  },
  {
    value: "reforme-fin-droit-2026",
    icon: "HelpCircle",
    label: "Vous êtes concerné par la réforme du chômage 2026",
    description: "Vous avez reçu une lettre, vous arrivez en fin de droit, ou vous aviez déjà des allocations avant mars 2026.",
    subQuestion: {
      question: "Quelle est votre situation par rapport à la réforme ?",
      helpText: "Cette porte évite de confondre les nouvelles demandes avec les mesures transitoires et les fins de droit.",
      options: [
        {
          value: "lettre-fin-droit-onem-ou-organisme-paiement",
          label: "Vous avez reçu une lettre de fin de droit ou d’avertissement",
          helpText: "Vous avez reçu un courrier de l’ONEM ou de votre organisme de paiement concernant la limitation dans le temps.",
          result: {
            dossierSlug: "reforme-fin-droit-chomage",
            dossierTitle: "Réforme 2026 — fin de droit ou mesures transitoires",
            availability: "a_creer",
            rationale: "Votre situation semble directement liée à la limitation du chômage complet dans le temps. Ce n’est pas une simple première demande classique.",
            nextStep: "Créer un parcours de lecture du courrier : date de fin de droit, période d’indemnisation, reprise de travail éventuelle, exceptions possibles, contact organisme de paiement.",
            matchLevel: "recommande",
            allocationEstimate: false,
            related: ["chomage-complet"],
            sourceIds: ["ONEM_REFORME_2026", "ONEM_T202"],
          },
        },
        {
          value: "allocations-avant-mars-2026-sans-nouvelle-demande",
          label: "Vous aviez déjà des allocations avant mars 2026",
          helpText: "Vous voulez comprendre si votre droit est limité dans le temps ou non.",
          result: {
            dossierSlug: "reforme-fin-droit-chomage",
            dossierTitle: "Mesures transitoires pour allocations avant mars 2026",
            availability: "a_creer",
            rationale: "Les personnes déjà indemnisées avant le 01/03/2026 peuvent relever de mesures transitoires. Le wizard doit les orienter vers un parcours séparé.",
            nextStep: "Demander si l’utilisateur a reçu une lettre, s’il a repris le travail, s’il a eu une interruption et s’il est dans une exception possible.",
            matchLevel: "recommande",
            allocationEstimate: false,
            related: ["chomage-complet"],
            sourceIds: ["ONEM_REFORME_2026", "ONEM_T202"],
          },
        },
        {
          value: "reprise-travail-pour-rouvrir-droit",
          label: "Vous avez retravaillé et vous voulez rouvrir un droit",
          helpText: "Vous avez repris un travail après une période de chômage ou après une fin de droit.",
          result: {
            dossierSlug: "chomage-complet",
            dossierTitle: "Nouveau droit au chômage complet après reprise de travail",
            availability: "disponible",
            rationale: "Une reprise de travail peut permettre une nouvelle demande, mais la nouvelle réglementation exige une vérification du nombre de jours de travail ou assimilés dans la période de référence.",
            nextStep: "Orienter vers chômage complet avec note : le pré-guide ne calcule pas les 312 jours ni la période de référence.",
            matchLevel: "a_verifier",
            allocationEstimate: true,
            related: ["reforme-fin-droit-chomage"],
            sourceIds: ["ONEM_T200", "ONEM_T202"],
          },
        },
        {
          value: "exception-limitation-55-rcc-arts-handicap",
          label: "Vous pensez être dans une exception à la limitation",
          helpText: "Par exemple : RCC, travailleur des arts, situation de handicap spécifique, 55 ans avec carrière suffisante.",
          result: {
            dossierSlug: "reforme-fin-droit-chomage",
            dossierTitle: "Exception possible à la limitation dans le temps",
            availability: "a_creer",
            rationale: "Certaines catégories peuvent ne pas être concernées par la limitation dans le temps ou suivent des règles spécifiques. Le pré-guide doit orienter vers une vérification, pas confirmer le droit.",
            nextStep: "Afficher les grandes catégories d’exceptions et renvoyer vers l’organisme de paiement pour validation.",
            matchLevel: "a_verifier",
            allocationEstimate: false,
            related: ["rcc", "travail-des-arts", "chomage-complet"],
            sourceIds: ["ONEM_T202", "ONEM_RCC", "ONEM_ARTS"],
          },
        },
      ],
    },
  },
  {
    value: "sortie-etudes-jeune",
    icon: "GraduationCap",
    label: "Vous sortez des études",
    description: "Vous avez terminé ou arrêté vos études et vous cherchez vers quelle démarche aller.",
    subQuestion: {
      question: "Où en êtes-vous après les études ?",
      helpText: "Les allocations d’insertion ne sont pas la même chose que le chômage complet basé sur un travail salarié.",
      options: [
        {
          value: "demande-allocation-insertion-apres-stage",
          label: "Vous voulez demander des allocations après votre stage d’insertion",
          helpText: "Vous avez terminé les études, vous êtes inscrit comme demandeur d’emploi et vous pensez avoir terminé le parcours d’insertion.",
          result: {
            dossierSlug: "allocations-insertion",
            dossierTitle: "Allocations d’insertion après études",
            availability: "a_creer",
            rationale: "Votre situation correspond à une demande d’allocations après études. Depuis le 01/03/2026, ce droit est limité à 12 mois dans le régime général.",
            nextStep: "Créer un parcours spécifique jeunes : âge, fin des études, diplôme/attestation, stage d’insertion, recherche active d’emploi.",
            matchLevel: "recommande",
            allocationEstimate: false,
            sourceIds: ["ONEM_T199"],
          },
        },
        {
          value: "jeune-a-travaille-apres-etudes",
          label: "Vous avez travaillé comme salarié après vos études",
          helpText: "Vous avez eu un vrai contrat de travail après la fin des études.",
          result: {
            dossierSlug: "chomage-complet",
            dossierTitle: "Chômage complet à vérifier après travail salarié",
            availability: "disponible",
            rationale: "Si vous avez travaillé comme salarié, votre situation peut relever du chômage complet plutôt que des allocations d’insertion. Le parcours de travail doit être vérifié.",
            nextStep: "Orienter vers chômage complet, avec possibilité de revenir vers allocations d’insertion si les conditions du chômage complet ne sont pas remplies.",
            matchLevel: "a_verifier",
            allocationEstimate: true,
            related: ["allocations-insertion"],
            sourceIds: ["ONEM_T199", "ONEM_T200"],
          },
        },
        {
          value: "jeune-pas-encore-stage-ou-inscription",
          label: "Vous n’êtes pas encore inscrit ou vous débutez les démarches",
          helpText: "Vous venez de terminer ou d’arrêter vos études et vous ne savez pas encore quoi faire.",
          result: {
            dossierSlug: "allocations-insertion",
            dossierTitle: "Parcours après études à préparer",
            availability: "a_creer",
            rationale: "Avant une demande d’allocations d’insertion, il faut généralement passer par les démarches d’inscription et le parcours d’insertion professionnelle.",
            nextStep: "Orienter d’abord vers l’inscription comme demandeur d’emploi auprès du service régional compétent, puis vers le parcours insertion.",
            matchLevel: "pertinent",
            allocationEstimate: false,
            sourceIds: ["ONEM_T199"],
          },
        },
        {
          value: "jeune-plus-25-ou-diplome-incertain",
          label: "Vous avez 25 ans ou plus, ou votre diplôme est incertain",
          helpText: "Vous n’êtes pas sûr de remplir les conditions d’âge, de diplôme ou d’attestation.",
          result: {
            dossierSlug: "autre-contact",
            dossierTitle: "Conditions d’insertion à vérifier",
            availability: "orientation_externe",
            rationale: "Les allocations d’insertion ont des conditions précises, notamment liées à l’âge, aux études et au parcours d’insertion. Le pré-guide doit éviter de conclure automatiquement.",
            nextStep: "Renvoyer vers l’organisme de paiement ou le service régional de l’emploi pour vérification personnalisée.",
            matchLevel: "a_verifier",
            allocationEstimate: false,
            related: ["allocations-insertion", "chomage-complet"],
            sourceIds: ["ONEM_T199"],
          },
        },
      ],
    },
  },
  {
    value: "travail-temps-partiel",
    icon: "Briefcase",
    label: "Vous travaillez ou reprenez un travail à temps partiel",
    description: "Vous ne travaillez pas à temps plein et vous voulez savoir si une démarche ONEM existe.",
    subQuestion: {
      question: "Quelle situation à temps partiel vous concerne ?",
      helpText: "Le temps partiel peut mener à un maintien des droits, une AGR, un chômage temporaire ou un chômage complet après la fin du contrat.",
      options: [
        {
          value: "reprise-temps-partiel-apres-chomage",
          label: "Vous reprenez un travail à temps partiel après le chômage",
          helpText: "Vous étiez chômeur complet et vous commencez un emploi à temps partiel.",
          result: {
            dossierSlug: "allocation-garantie-revenus",
            dossierTitle: "Allocation de garantie de revenus ou maintien des droits",
            availability: "a_creer",
            rationale: "Un chômeur qui reprend un temps partiel peut, sous conditions, demander un maintien des droits et éventuellement une allocation de garantie de revenus.",
            nextStep: "Créer un parcours séparé : maintien des droits, disponibilité, demande à l’employeur, horaire, rémunération et éventuelle AGR.",
            matchLevel: "recommande",
            allocationEstimate: false,
            related: ["travail-temps-partiel-maintien-droits"],
            sourceIds: ["ONEM_AGR", "ONEM_TEMPS_PARTIEL"],
          },
        },
        {
          value: "temps-partiel-sans-allocation-actuelle",
          label: "Vous travaillez déjà à temps partiel sans allocations",
          helpText: "Vous voulez savoir si vous devez demander un statut ou préparer la suite.",
          result: {
            dossierSlug: "travail-temps-partiel-maintien-droits",
            dossierTitle: "Travail à temps partiel avec maintien des droits à vérifier",
            availability: "a_creer",
            rationale: "Le statut de travailleur à temps partiel avec maintien des droits peut être important pour préserver certains droits futurs, mais il dépend de formalités et conditions précises.",
            nextStep: "Créer un parcours administratif temps partiel : début d’occupation, ancien droit, horaire, disponibilité et demande via organisme de paiement.",
            matchLevel: "a_verifier",
            allocationEstimate: false,
            related: ["allocation-garantie-revenus", "chomage-complet"],
            sourceIds: ["ONEM_TEMPS_PARTIEL", "ONEM_AGR"],
          },
        },
        {
          value: "fin-contrat-temps-partiel",
          label: "Votre contrat à temps partiel se termine",
          helpText: "Vous avez perdu ou allez perdre votre emploi à temps partiel.",
          result: {
            dossierSlug: "chomage-complet",
            dossierTitle: "Chômage complet ou demi-allocations après temps partiel",
            availability: "disponible",
            rationale: "Après la fin d’un contrat à temps partiel, le droit peut dépendre du statut antérieur, du maintien des droits ou du caractère volontaire du temps partiel.",
            nextStep: "Orienter vers chômage complet avec questions complémentaires temps partiel. Ne pas promettre une allocation complète sans vérification.",
            matchLevel: "a_verifier",
            allocationEstimate: true,
            related: ["travail-temps-partiel-maintien-droits"],
            sourceIds: ["ONEM_TEMPS_PARTIEL", "ONEM_T200"],
          },
        },
        {
          value: "chomage-temporaire-temps-partiel",
          label: "Votre temps partiel est temporairement suspendu",
          helpText: "Votre employeur vous met en chômage temporaire alors que vous êtes à temps partiel.",
          result: {
            dossierSlug: "chomage-temporaire",
            dossierTitle: "Chômage temporaire pendant un temps partiel",
            availability: "disponible",
            rationale: "Même en temps partiel, une suspension temporaire du contrat par l’employeur peut relever du chômage temporaire.",
            nextStep: "Orienter vers chômage temporaire et prévoir des explications adaptées aux temps partiels.",
            matchLevel: "pertinent",
            allocationEstimate: false,
            related: ["travail-temps-partiel-maintien-droits"],
            sourceIds: ["ONEM_CHOMAGE_TEMPORAIRE", "ONEM_TEMPS_PARTIEL"],
          },
        },
      ],
    },
  },
  {
    value: "etranger-frontalier-u1",
    icon: "MapPinned",
    label: "Vous avez travaillé à l’étranger ou comme frontalier",
    description: "Votre parcours implique un autre pays, une résidence en Belgique ou une demande de document international.",
    subQuestion: {
      question: "Quelle situation internationale correspond à votre demande ?",
      helpText: "Le pays de travail, le pays de résidence et les périodes de travail doivent être distingués.",
      options: [
        {
          value: "retour-belgique-apres-travail-etranger",
          label: "Vous revenez en Belgique après avoir travaillé à l’étranger",
          helpText: "Vous voulez savoir si vos périodes à l’étranger peuvent être prises en compte pour le chômage belge.",
          result: {
            dossierSlug: "travail-etranger-frontalier",
            dossierTitle: "Chômage après occupation à l’étranger",
            availability: "a_creer",
            rationale: "Depuis mars 2026, l’ONEM prévoit une feuille spécifique pour les périodes d’occupation à l’étranger et leur prise en compte dans le droit au chômage belge.",
            nextStep: "Créer un parcours : pays concerné, résidence, occupation belge éventuelle après l’étranger, documents disponibles et organisme de paiement.",
            matchLevel: "recommande",
            allocationEstimate: true,
            related: ["chomage-complet", "document-u1"],
            sourceIds: ["ONEM_T30", "ONEM_T200"],
          },
        },
        {
          value: "resident-belgique-travail-autre-pays-frontalier",
          label: "Vous résidez en Belgique et vous travailliez dans un autre pays",
          helpText: "Vous êtes ou étiez travailleur frontalier ou dans une situation proche.",
          result: {
            dossierSlug: "travail-etranger-frontalier",
            dossierTitle: "Travail frontalier — chômage à vérifier",
            availability: "a_creer",
            rationale: "Les situations frontalières dépendent du pays de travail, du pays de résidence et des règles européennes ou bilatérales. Le guide doit orienter sans conclure automatiquement.",
            nextStep: "Créer un parcours frontalier séparé : pays, résidence, dernier emploi, document portable, organisme compétent.",
            matchLevel: "a_verifier",
            allocationEstimate: true,
            related: ["chomage-complet", "document-u1"],
            sourceIds: ["ONEM_T30", "ONEM_U1"],
          },
        },
        {
          value: "demande-document-u1-belgique-vers-etranger",
          label: "Vous avez besoin d’un document pour faire valoir votre travail belge à l’étranger",
          helpText: "Vous quittez la Belgique ou un autre pays vous demande une attestation de périodes belges.",
          result: {
            dossierSlug: "document-u1",
            dossierTitle: "Document U1 — périodes de travail belges",
            availability: "a_creer",
            rationale: "Le document U1 sert à attester les périodes d’assurance accomplies en Belgique pour un droit au chômage à l’étranger.",
            nextStep: "Créer un mini-parcours document U1 : pays de destination, périodes belges, assujettissement, pièces à joindre.",
            matchLevel: "recommande",
            allocationEstimate: false,
            sourceIds: ["ONEM_U1"],
          },
        },
        {
          value: "frontalier-chomage-temporaire-ec32",
          label: "Vous êtes frontalier et votre employeur vous met en chômage temporaire",
          helpText: "Vous devez utiliser ou comprendre la carte électronique de chômage temporaire.",
          result: {
            dossierSlug: "chomage-temporaire",
            dossierTitle: "Chômage temporaire pour travailleur frontalier",
            availability: "disponible",
            rationale: "Le chômage temporaire concerne aussi les travailleurs frontaliers lorsque leur contrat est temporairement suspendu. L’accès à l’eC3.2 peut demander une attention particulière.",
            nextStep: "Orienter vers chômage temporaire et prévoir une note spécifique pour l’accès numérique des frontaliers.",
            matchLevel: "pertinent",
            allocationEstimate: false,
            related: ["travail-etranger-frontalier"],
            sourceIds: ["ONEM_EC32", "ONEM_CHOMAGE_TEMPORAIRE"],
          },
        },
      ],
    },
  },
  {
    value: "fin-carriere-rcc-credit-temps",
    icon: "Briefcase",
    label: "Vous êtes en fin de carrière",
    description: "Vous approchez de la pension, d’un RCC ou d’une réduction de prestations en fin de carrière.",
    subQuestion: {
      question: "Quelle situation de fin de carrière vous concerne ?",
      helpText: "Le RCC, le chômage complet et le crédit-temps fin de carrière ne sont pas le même dossier.",
      options: [
        {
          value: "rcc-complement-entreprise",
          label: "Votre employeur parle d’un complément d’entreprise",
          helpText: "On parle encore parfois de prépension dans le langage courant.",
          result: {
            dossierSlug: "rcc",
            dossierTitle: "Régime de chômage avec complément d’entreprise",
            availability: "a_creer",
            rationale: "Le RCC concerne un travailleur licencié qui peut avoir droit à une allocation de chômage et à un complément d’entreprise. Ce n’est pas un chômage complet classique.",
            nextStep: "Créer un parcours RCC séparé : licenciement, âge, passé professionnel, CCT/régime applicable, complément employeur.",
            matchLevel: "recommande",
            allocationEstimate: true,
            related: ["chomage-complet"],
            sourceIds: ["ONEM_RCC"],
          },
        },
        {
          value: "licenciement-fin-carriere-sans-rcc",
          label: "Vous êtes licencié en fin de carrière sans RCC confirmé",
          helpText: "Aucun complément d’entreprise n’a été confirmé.",
          result: {
            dossierSlug: "chomage-complet",
            dossierTitle: "Chômage complet en fin de carrière à vérifier",
            availability: "disponible",
            rationale: "Si aucun RCC n’est confirmé, la piste peut rester le chômage complet. Depuis la réforme, l’âge et le passé professionnel peuvent influencer la limitation dans le temps.",
            nextStep: "Orienter vers chômage complet avec un avertissement sur les exceptions éventuelles à la limitation dans le temps.",
            matchLevel: "a_verifier",
            allocationEstimate: true,
            related: ["reforme-fin-droit-chomage", "rcc"],
            sourceIds: ["ONEM_T202", "ONEM_T200"],
          },
        },
        {
          value: "credit-temps-fin-carriere",
          label: "Vous voulez réduire votre temps de travail en fin de carrière",
          helpText: "Vous travaillez encore et vous voulez réduire vos prestations avant la pension.",
          result: {
            dossierSlug: "interruption-carriere-credit-temps",
            dossierTitle: "Crédit-temps fin de carrière",
            availability: "a_creer",
            rationale: "Une réduction de prestations en fin de carrière relève du crédit-temps ou de l’interruption de carrière, pas d’une demande de chômage complet.",
            nextStep: "Créer un parcours interruption/crédit-temps : secteur privé ou public, réduction demandée, durée, âge, conditions ONEM.",
            matchLevel: "recommande",
            allocationEstimate: false,
            sourceIds: ["ONEM_INTERRUPTION_CARRIERE"],
          },
        },
        {
          value: "pension-ou-retraite",
          label: "Vous partez à la pension ou vous êtes déjà pensionné",
          helpText: "Votre question concerne surtout la pension ou la retraite.",
          result: {
            dossierSlug: "autre-contact",
            dossierTitle: "Pension ou retraite — orientation externe",
            availability: "orientation_externe",
            rationale: "La pension n’est pas un dossier ONEM de chômage classique. Le pré-guide doit rediriger vers le service compétent ou un contact adapté.",
            nextStep: "Afficher une sortie propre vers les services pension et éviter de proposer un dossier chômage sauf perte d’emploi avant pension.",
            matchLevel: "a_verifier",
            allocationEstimate: false,
            related: ["chomage-complet", "rcc"],
          },
        },
      ],
    },
  },
  {
    value: "interruption-conges-formation-activite",
    icon: "Search",
    label: "Vous voulez interrompre, réduire ou adapter votre activité",
    description: "Formation, stage, crédit-temps, congé thématique, activité accessoire ou travail des arts.",
    subQuestion: {
      question: "Quelle démarche voulez-vous faire ?",
      helpText: "Ces démarches ne doivent pas être confondues avec une première demande de chômage complet.",
      options: [
        {
          value: "formation-stage-pendant-chomage",
          label: "Suivre une formation, des études ou un stage pendant le chômage",
          helpText: "Vous êtes ou pensez être chômeur indemnisé et vous voulez suivre une formation ou des études.",
          result: {
            dossierSlug: "dispense-formation-stage",
            dossierTitle: "Dispense pour formation, études ou stage",
            availability: "a_creer",
            rationale: "Un chômeur indemnisé qui suit une formation ou des études peut devoir demander une dispense ou vérifier ses obligations. Ce n’est pas une nouvelle demande de chômage classique.",
            nextStep: "Créer un parcours par région et type de formation : Actiris, FOREM, VDAB ou ADG, puis organisme de paiement selon le cas.",
            matchLevel: "pertinent",
            allocationEstimate: false,
            related: ["chomage-complet"],
            sourceIds: ["ONEM_FORMATION_STAGE"],
          },
        },
        {
          value: "credit-temps-conge-thematique",
          label: "Demander un crédit-temps ou un congé thématique",
          helpText: "Par exemple : congé parental, assistance médicale, soins palliatifs, crédit-temps avec motif.",
          result: {
            dossierSlug: "interruption-carriere-credit-temps",
            dossierTitle: "Interruption de carrière, crédit-temps ou congé thématique",
            availability: "a_creer",
            rationale: "Ces demandes relèvent des allocations d’interruption et suivent leurs propres règles. Elles ne doivent pas être orientées vers chômage complet.",
            nextStep: "Créer un parcours séparé : secteur privé/public, type de congé, réduction demandée, durée, demande en ligne éventuelle.",
            matchLevel: "recommande",
            allocationEstimate: false,
            related: ["conges-thematiques"],
            sourceIds: ["ONEM_INTERRUPTION_CARRIERE"],
          },
        },
        {
          value: "activite-accessoire-benevolat-independant",
          label: "Exercer une activité pendant le chômage",
          helpText: "Par exemple : activité indépendante accessoire, bénévolat, activité occasionnelle ou revenus complémentaires.",
          result: {
            dossierSlug: "activite-pendant-chomage",
            dossierTitle: "Activité pendant le chômage à déclarer ou vérifier",
            availability: "a_creer",
            rationale: "Une activité pendant le chômage peut influencer le droit ou le paiement des allocations. Le pré-guide doit orienter vers une vérification avant de commencer ou déclarer l’activité.",
            nextStep: "Créer un parcours activité : type d’activité, rémunération, fréquence, début avant/après chômage, déclaration à l’organisme de paiement.",
            matchLevel: "a_verifier",
            allocationEstimate: false,
            related: ["chomage-complet", "chomage-temporaire"],
            sourceIds: ["ONEM_ACTIVITE_CHOMAGE"],
          },
        },
        {
          value: "travailleur-des-arts",
          label: "Vous travaillez dans le secteur artistique",
          helpText: "Vous disposez ou demandez une attestation du travail des arts, ou vous voulez demander des allocations du travail des arts.",
          result: {
            dossierSlug: "travail-des-arts",
            dossierTitle: "Allocations du travail des arts",
            availability: "a_creer",
            rationale: "Les travailleurs des arts ont des règles spécifiques et un dossier distinct du chômage complet classique.",
            nextStep: "Créer un parcours travail des arts : attestation, date d’effet, organisme de paiement, période d’application.",
            matchLevel: "recommande",
            allocationEstimate: false,
            related: ["chomage-complet"],
            sourceIds: ["ONEM_ARTS"],
          },
        },
      ],
    },
  },
  {
    value: "sante-handicap-incapacite",
    icon: "Accessibility",
    label: "Votre santé influence votre capacité à travailler",
    description: "Maladie, incapacité, handicap ou retour après une période d’incapacité.",
    subQuestion: {
      question: "Quelle situation de santé vous concerne ?",
      helpText: "Le chômage et l’incapacité de travail ne relèvent pas toujours du même organisme.",
      options: [
        {
          value: "incapacite-actuelle-mutuelle",
          label: "Vous êtes actuellement incapable de travailler",
          helpText: "Votre état de santé vous empêche actuellement de travailler.",
          result: {
            dossierSlug: "incapacite-sante",
            dossierTitle: "Incapacité de travail — mutuelle ou organisme compétent",
            availability: "orientation_externe",
            rationale: "Lorsque la personne est incapable de travailler pour raison de santé, l’orientation principale est généralement la mutuelle plutôt qu’un dossier chômage.",
            nextStep: "Afficher une orientation externe vers la mutuelle, avec possibilité de revenir au chômage complet si le contrat est terminé et que la personne est à nouveau apte.",
            matchLevel: "recommande",
            allocationEstimate: false,
            related: ["chomage-complet"],
          },
        },
        {
          value: "retour-apres-incapacite-contrat-termine",
          label: "Votre incapacité se termine et votre contrat est terminé",
          helpText: "Vous sortez d’une période de maladie ou d’invalidité et vous n’avez plus d’emploi.",
          result: {
            dossierSlug: "chomage-complet",
            dossierTitle: "Chômage complet après incapacité à vérifier",
            availability: "disponible",
            rationale: "Après une incapacité, une demande de chômage complet peut être pertinente si le contrat est terminé et si la personne est à nouveau disponible pour le marché de l’emploi.",
            nextStep: "Orienter vers chômage complet avec avertissement : aptitude, fin de contrat et documents de la mutuelle doivent être vérifiés.",
            matchLevel: "a_verifier",
            allocationEstimate: true,
            related: ["incapacite-sante"],
            sourceIds: ["ONEM_SANTE_CHOMAGE", "ONEM_T200"],
          },
        },
        {
          value: "handicap-accompagnement-emploi",
          label: "Vous cherchez un accompagnement lié au handicap et à l’emploi",
          helpText: "Votre question concerne surtout l’accompagnement, l’adaptation ou la reconnaissance de votre situation.",
          result: {
            dossierSlug: "incapacite-sante",
            dossierTitle: "Accompagnement handicap et emploi",
            availability: "orientation_externe",
            rationale: "Cette situation relève souvent d’un service régional, d’un accompagnement spécialisé ou d’un organisme de santé, avant d’être un dossier chômage classique.",
            nextStep: "Orienter vers le service régional compétent et proposer une vérification chômage seulement si la personne est sans emploi et apte au travail.",
            matchLevel: "a_verifier",
            allocationEstimate: false,
            related: ["chomage-complet"],
          },
        },
      ],
    },
  },
  {
    value: "vacances-conges-soins",
    icon: "Hourglass",
    label: "Vous cherchez une allocation liée aux congés",
    description: "Vacances jeunes, vacances seniors ou congé pour soins d’accueil.",
    subQuestion: {
      question: "Quel type de congé ou allocation cherchez-vous ?",
      helpText: "Ces dossiers sont spécifiques et ne doivent pas être rangés dans chômage complet.",
      options: [
        {
          value: "vacances-jeunes",
          label: "Vacances jeunes",
          helpText: "Vous avez moins de 25 ans et vous n’avez pas un droit complet aux vacances rémunérées ordinaires.",
          result: {
            dossierSlug: "vacances-jeunes",
            dossierTitle: "Vacances jeunes",
            availability: "a_creer",
            rationale: "Les vacances jeunes sont un dossier ONEM spécifique lié aux jours de vacances non couverts par le pécule ordinaire.",
            nextStep: "Créer un parcours vacances jeunes : âge, première année de travail, droit incomplet aux vacances, jours demandés.",
            matchLevel: "pertinent",
            allocationEstimate: false,
            sourceIds: ["ONEM_VACANCES_JEUNES"],
          },
        },
        {
          value: "vacances-seniors",
          label: "Vacances seniors",
          helpText: "Vous avez 50 ans ou plus et vous n’avez pas un droit complet aux vacances rémunérées ordinaires après chômage ou invalidité.",
          result: {
            dossierSlug: "vacances-seniors",
            dossierTitle: "Vacances seniors",
            availability: "a_creer",
            rationale: "Les vacances seniors sont un dossier ONEM spécifique pour compléter un droit incomplet aux vacances dans certaines situations.",
            nextStep: "Créer un parcours vacances seniors : âge, reprise de travail, période précédente de chômage ou invalidité, droit incomplet aux vacances.",
            matchLevel: "pertinent",
            allocationEstimate: false,
            sourceIds: ["ONEM_VACANCES_SENIORS"],
          },
        },
        {
          value: "soins-accueil",
          label: "Congé pour soins d’accueil",
          helpText: "Vous devez vous absenter pour des obligations liées à l’accueil familial d’une personne placée.",
          result: {
            dossierSlug: "conges-thematiques",
            dossierTitle: "Congé ou allocation pour soins d’accueil",
            availability: "a_creer",
            rationale: "Les soins d’accueil relèvent d’un dossier spécifique lié aux congés, distinct du chômage complet et du chômage temporaire.",
            nextStep: "Créer un parcours congés : type de congé, statut travailleur, période demandée, organisme compétent.",
            matchLevel: "pertinent",
            allocationEstimate: false,
            related: ["interruption-carriere-credit-temps"],
          },
        },
      ],
    },
  },
  {
    value: "faillite-fermeture-employeur",
    icon: "Briefcase",
    label: "Votre employeur est en faillite ou ferme l’entreprise",
    description: "Vous avez perdu votre emploi ou des montants vous sont dus à cause d’une fermeture ou faillite.",
    subQuestion: {
      question: "Que cherchez-vous principalement ?",
      helpText: "Une fermeture d’entreprise peut mener à deux pistes : chômage complet pour la perte d’emploi et FFE pour certains montants dus.",
      options: [
        {
          value: "perte-emploi-suite-faillite",
          label: "Vous avez perdu votre emploi à cause de la faillite ou fermeture",
          helpText: "Votre contrat est terminé et vous voulez demander des allocations de chômage.",
          result: {
            dossierSlug: "chomage-complet",
            dossierTitle: "Chômage complet après faillite ou fermeture",
            availability: "disponible",
            rationale: "Si votre contrat est terminé suite à une faillite ou fermeture, le chômage complet peut être la première orientation pour les allocations, avec une piste séparée pour le FFE.",
            nextStep: "Orienter vers chômage complet et proposer aussi une carte liée au Fonds de fermeture des entreprises pour les montants dus.",
            matchLevel: "recommande",
            allocationEstimate: true,
            related: ["ffe-fermeture-entreprise"],
            sourceIds: ["ONEM_T200", "ONEM_FFE"],
          },
        },
        {
          value: "montants-dus-par-employeur-fermeture",
          label: "Votre employeur vous doit encore des montants",
          helpText: "Par exemple : indemnité de fermeture, arriérés, indemnités contractuelles ou autres montants liés à la fermeture.",
          result: {
            dossierSlug: "ffe-fermeture-entreprise",
            dossierTitle: "Fonds de fermeture des entreprises",
            availability: "a_creer",
            rationale: "Le Fonds de fermeture des entreprises peut intervenir dans certains montants dus lors d’une fermeture ou faillite. Ce dossier est distinct de la demande de chômage complet.",
            nextStep: "Créer un parcours FFE séparé : type de montant, date de fermeture, ancienneté, contrat rompu, pièces disponibles.",
            matchLevel: "recommande",
            allocationEstimate: false,
            related: ["chomage-complet"],
            sourceIds: ["ONEM_FFE"],
          },
        },
        {
          value: "fermeture-temporaire-sans-fin-contrat",
          label: "L’entreprise ferme temporairement mais votre contrat continue",
          helpText: "Votre employeur ferme temporairement, mais vous n’êtes pas licencié.",
          result: {
            dossierSlug: "chomage-temporaire",
            dossierTitle: "Chômage temporaire à vérifier",
            availability: "disponible",
            rationale: "Si l’entreprise ferme temporairement sans rupture du contrat, la situation peut relever du chômage temporaire plutôt que du chômage complet.",
            nextStep: "Orienter vers chômage temporaire et demander si l’employeur a annoncé une déclaration de chômage temporaire.",
            matchLevel: "a_verifier",
            allocationEstimate: false,
            related: ["ffe-fermeture-entreprise"],
            sourceIds: ["ONEM_CHOMAGE_TEMPORAIRE", "ONEM_TEMPS_PARTIEL"],
          },
        },
      ],
    },
  },
  {
    value: "changement-situation-personnelle",
    icon: "Accessibility",
    label: "Votre situation personnelle ou familiale a changé",
    description:
      "Vous recevez déjà des allocations et devez signaler un changement avec le formulaire C1.",
    subQuestion: {
      question: "Quel changement voulez-vous déclarer ?",
      helpText:
        "Choisissez le changement principal. Vous pourrez en déclarer plusieurs dans le même C1 s'ils prennent effet à la même date.",
      options: [
        {
          value: "situation-familiale-assistant",
          label: "Vous devez déclarer une situation familiale ou un changement dans votre ménage",
          helpText:
            "L'arbre vous envoie vers Mon Dossier : l'assistant posera les questions familiales et préparera le C1 officiel.",
          result: {
            dossierSlug: "changement-situation-personnelle",
            dossierTitle: "Préparer une déclaration de situation familiale",
            availability: "disponible",
            rationale:
              "Les règles de situation familiale (conjoint, partenaire, FAC, enfants, pension alimentaire, garde alternée et colocation) sont recueillies dans l'assistant Mon Dossier, puis utilisées pour préremplir le C1.",
            nextStep:
              "Ouvrir Mon Dossier et répondre aux questions familiales. Le C1 officiel restera modifiable et l'Annexe REGIS ou le C1P sera ajouté si nécessaire.",
            matchLevel: "recommande",
            allocationEstimate: false,
            sourceIds: ["ONEM_C1", "ONEM_ART_110"],
          },
        },
        {
          value: "adresse",
          label: "Vous avez changé d'adresse",
          result: {
            dossierSlug: "changement-situation-personnelle",
            dossierTitle: "Déclarer un changement d'adresse",
            availability: "disponible",
            rationale:
              "Le formulaire C1 permet de signaler votre nouvelle adresse pendant que vous recevez des allocations.",
            nextStep:
              "Ouvrir le dossier de changement de situation et préparer la nouvelle adresse ainsi que sa date d'effet.",
            matchLevel: "recommande",
            allocationEstimate: false,
            sourceIds: ["ONEM_C1"],
          },
        },
        {
          value: "situation-personnelle-menage",
          label: "Votre situation personnelle ou celle de votre ménage a changé",
          helpText:
            "Par exemple : mariage, séparation, cohabitation ou changement concernant une personne du ménage.",
          result: {
            dossierSlug: "changement-situation-personnelle",
            dossierTitle: "Déclarer un changement de situation personnelle ou familiale",
            availability: "disponible",
            rationale:
              "La composition du ménage et la situation familiale peuvent influencer votre dossier d'allocations et se déclarent au moyen du C1.",
            nextStep:
              "Ouvrir le dossier de changement de situation et préparer les informations sur les personnes concernées.",
            matchLevel: "recommande",
            allocationEstimate: false,
            sourceIds: ["ONEM_C1"],
          },
        },
        {
          value: "permis-sejour-travail",
          label: "Votre permis de séjour ou de travail a changé",
          result: {
            dossierSlug: "changement-situation-personnelle",
            dossierTitle: "Déclarer un changement de permis",
            availability: "disponible",
            rationale:
              "Le C1 permet de signaler une modification de votre permis de séjour ou de travail à votre organisme de paiement.",
            nextStep:
              "Ouvrir le dossier de changement de situation et préparer une copie du nouveau permis.",
            matchLevel: "recommande",
            allocationEstimate: false,
            sourceIds: ["ONEM_C1"],
          },
        },
        {
          value: "compte-bancaire",
          label: "Votre numéro de compte bancaire a changé",
          result: {
            dossierSlug: "changement-situation-personnelle",
            dossierTitle: "Déclarer un nouveau compte bancaire",
            availability: "disponible",
            rationale:
              "Votre organisme de paiement doit connaître le compte sur lequel vos allocations doivent être versées.",
            nextStep:
              "Ouvrir le dossier de changement de situation et préparer le nouvel IBAN, le BIC éventuel et le nom du titulaire.",
            matchLevel: "recommande",
            allocationEstimate: false,
            sourceIds: ["ONEM_C1"],
          },
        },
        {
          value: "organisme-paiement",
          label: "Vous voulez changer d'organisme de paiement",
          helpText: "Par exemple : passer de la CAPAC à un syndicat ou inversement.",
          result: {
            dossierSlug: "changement-situation-personnelle",
            dossierTitle: "Changer d'organisme de paiement",
            availability: "disponible",
            rationale:
              "Le C1 prévoit une demande spécifique de transfert vers un autre organisme de paiement.",
            nextStep:
              "Ouvrir le dossier et indiquer le nouvel organisme ainsi que la date souhaitée du transfert.",
            matchLevel: "recommande",
            allocationEstimate: false,
            sourceIds: ["ONEM_C1"],
          },
        },
      ],
    },
  },
  {
    value: "autre-situation-contact",
    icon: "HelpCircle",
    label: "Vous ne savez pas quel dossier choisir",
    description: "Votre situation ne correspond pas clairement aux choix proposés.",
    result: {
      dossierSlug: "autre-contact",
      dossierTitle: "Orientation vers un organisme de paiement ou un service compétent",
      availability: "orientation_externe",
      rationale: "Certaines situations sont trop spécifiques pour être orientées automatiquement dans un pré-guide public. Il vaut mieux éviter une mauvaise orientation et proposer un contact fiable.",
      nextStep: "Afficher les pistes de contact : organisme de paiement pour les allocations, ONEM pour informations générales, service régional de l’emploi pour accompagnement/recherche d’emploi, mutuelle pour incapacité.",
      matchLevel: "a_verifier",
      allocationEstimate: false,
      related: ["chomage-complet", "chomage-temporaire"],
    },
  },
];

// ── Mapper pur V2 → format de l'app ──────────────────────────────────────────

function mapResultV2(r: WizardResultV2): WizardResult {
  // orientation_externe : pas un dossier Docbel → slug forcé à null.
  const slug = r.availability === "orientation_externe" ? null : r.dossierSlug;
  return {
    dossierSlug: slug,
    dossierTitle: r.dossierTitle,
    rationale: r.rationale,
    availability: r.availability,
    nextStep: r.nextStep,
    ...(r.matchLevel ? { matchLevel: r.matchLevel } : {}),
    ...(r.allocationEstimate ? { allocationEstimate: r.allocationEstimate } : {}),
    ...(r.related && r.related.length ? { related: r.related } : {}),
  };
}

function mapSubOptionV2(s: WizardSubOptionV2): WizardSubOption {
  return {
    value: s.value,
    label: s.label,
    ...(s.helpText ? { helpText: s.helpText } : {}),
    ...(s.refineQuestion
      ? {
          refineQuestion: {
            question: s.refineQuestion.question,
            ...(s.refineQuestion.helpText
              ? { helpText: s.refineQuestion.helpText }
              : {}),
            options: s.refineQuestion.options.map((o) => ({
              value: o.value,
              label: o.label,
              ...(o.helpText ? { helpText: o.helpText } : {}),
              result: mapResultV2(o.result),
            })),
          },
        }
      : {}),
    ...(s.result ? { result: mapResultV2(s.result) } : {}),
  };
}

/// Convertit le littéral ONEM 2026 (V2) vers `WizardSituation[]` de l'app.
export function mapOnem2026ToWizardSituations(): WizardSituation[] {
  return wizardSituationsOnem2026.map((sit) => ({
    value: sit.value,
    icon: sit.icon,
    label: sit.label,
    ...(sit.description ? { description: sit.description } : {}),
    ...(sit.subQuestion
      ? {
          subQuestion: {
            question: sit.subQuestion.question,
            ...(sit.subQuestion.helpText
              ? { helpText: sit.subQuestion.helpText }
              : {}),
            options: sit.subQuestion.options.map(mapSubOptionV2),
          },
        }
      : {}),
    ...(sit.result ? { result: mapResultV2(sit.result) } : {}),
  }));
}

/// Stubs de dossiers "à créer" (availability a_creer) — créés inactifs en base
/// pour être édités plus tard dans l'admin. (slug → titre lisible.)
export const ONEM_2026_STUB_BUNDLES: { slug: string; name: string }[] = [
  { slug: "allocations-insertion", name: "Allocations d’insertion (après études)" },
  { slug: "reforme-fin-droit-chomage", name: "Réforme 2026 — fin de droit / mesures transitoires" },
  { slug: "travail-temps-partiel-maintien-droits", name: "Travail à temps partiel avec maintien des droits" },
  { slug: "allocation-garantie-revenus", name: "Allocation de garantie de revenus (AGR)" },
  { slug: "travail-etranger-frontalier", name: "Chômage après travail à l’étranger / frontalier" },
  { slug: "document-u1", name: "Document U1 — périodes de travail belges" },
  { slug: "rcc", name: "Régime de chômage avec complément d’entreprise (RCC)" },
  { slug: "interruption-carriere-credit-temps", name: "Interruption de carrière / crédit-temps" },
  { slug: "conges-thematiques", name: "Congés thématiques / soins d’accueil" },
  { slug: "vacances-jeunes", name: "Vacances jeunes" },
  { slug: "vacances-seniors", name: "Vacances seniors" },
  { slug: "travail-des-arts", name: "Allocations du travail des arts" },
  { slug: "ffe-fermeture-entreprise", name: "Fonds de fermeture des entreprises (FFE)" },
  { slug: "activite-pendant-chomage", name: "Activité pendant le chômage" },
  { slug: "dispense-formation-stage", name: "Dispense pour formation / études / stage" },
];
