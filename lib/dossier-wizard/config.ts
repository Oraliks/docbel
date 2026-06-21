// Configuration de l'orientation wizard de `/mon-dossier`.
//
// Arbre à 1 à 3 niveaux :
//
//   Situation (step 1)
//     └─ SubQuestion (step 2)        ← « Vos besoins »
//          └─ RefineQuestion (step 3) ← « Affinons » (optionnel)
//               └─ Result (step 4)
//
// Une branche peut résoudre directement à n'importe quel niveau :
//   - une Situation sans subQuestion résout via `result`
//   - une SubOption sans refineQuestion résout via `result`
//   - une RefineOption résout toujours via `result`
//
// `dossierSlug = null` ⇒ « bientôt disponible » (carte d'attente + lien contact).
//
// Arbre construit à partir de la nomenclature ONEM des natures de demande
// (chômage). Les codes internes (TPV, TFT, NCO, DE3, NPR…) sont mentionnés
// en commentaire pour traçabilité — jamais exposés à l'utilisateur.

export interface WizardResult {
  /// Slug du dossier cible. `null` = pas encore disponible.
  dossierSlug: string | null;
  /// Titre du dossier (pour l'affichage du résultat).
  dossierTitle: string;
  /// Phrase qui explique pourquoi ce choix.
  rationale: string;
  /// Champ ADDITIF (optionnel) : signale qu'une estimation indicative
  /// d'allocation a du sens pour ce dossier. Présent uniquement sur les
  /// dossiers dont le revenu est une allocation de chômage proportionnelle au
  /// salaire (chômage complet, frontalier, RCC) — calculée par le moteur pur
  /// `estimerAllocation` de `lib/simulateur-chomage`. Le bloc d'estimation
  /// (`components/docbel/onboarding/allocation-estimate-block.tsx`) ne s'affiche
  /// que si ce champ vaut `true`.
  ///
  /// VOLONTAIREMENT ABSENT pour :
  ///   - les allocations d'insertion (forfait jeunes, logique distincte du
  ///     barème salaire — hors périmètre du simulateur) ;
  ///   - le chômage temporaire (montant lié à la suspension, pas à la 1ʳᵉ
  ///     période d'indemnisation simulée ici) ;
  ///   - les cartes « bientôt disponible » (dossierSlug = null).
  allocationEstimate?: boolean;
}

/// Option de la 3ᵉ étape (« Affinons »). Résout toujours vers un résultat.
export interface WizardRefineOption {
  value: string;
  label: string;
  helpText?: string;
  result: WizardResult;
}

export interface WizardSubOption {
  value: string;
  label: string;
  helpText?: string;
  /// Soit la sous-option raffine encore (step 3), soit elle résout direct.
  /// Exactement un des deux doit être défini.
  refineQuestion?: {
    question: string;
    helpText?: string;
    options: WizardRefineOption[];
  };
  result?: WizardResult;
}

export interface WizardSituation {
  value: string;
  /// Nom d'icône lucide-react (ex. "Briefcase"). Mapping → composant fait dans
  /// `components/docbel/onboarding/dossier-wizard.tsx` (config sérialisable).
  icon: string;
  label: string;
  /// Sous-titre court affiché sous le label dans la carte de situation
  /// (step 1 du wizard). Purement descriptif, aide l'utilisateur à se situer.
  description?: string;
  subQuestion?: {
    question: string;
    helpText?: string;
    options: WizardSubOption[];
  };
  result?: WizardResult;
}

// ── Résultats réutilisés (évite la duplication) ──────────────────────────────

const R_CT: WizardResult = {
  dossierSlug: "chomage-temporaire",
  dossierTitle: "Chômage temporaire",
  rationale:
    "Votre contrat est suspendu pour un temps : vous pouvez toucher des allocations pendant cette période, puis reprendre votre travail.",
};

const R_COMPLET_PREMIERE: WizardResult = {
  dossierSlug: "chomage-complet",
  dossierTitle: "Chômage complet — première demande",
  rationale:
    "Vous avez assez travaillé pour ouvrir un droit au chômage complet pour la première fois.",
  allocationEstimate: true,
};

const R_COMPLET_REDEMANDE: WizardResult = {
  dossierSlug: "chomage-complet",
  dossierTitle: "Chômage complet — redemande",
  rationale:
    "Vous avez déjà été indemnisé par le passé : on rouvre votre droit au chômage complet.",
  allocationEstimate: true,
};

const R_INSERTION: WizardResult = {
  dossierSlug: "allocations-insertion",
  dossierTitle: "Allocations d'insertion (jeunes)",
  rationale:
    "Vous sortez des études sans avoir (assez) travaillé : c'est la voie des allocations d'insertion, après un stage d'insertion de 310 jours.",
};

const R_FRONTALIER: WizardResult = {
  dossierSlug: "chomage-frontalier",
  dossierTitle: "Chômage frontalier",
  rationale:
    "Vous résidez dans un pays et vous travailliez dans un autre (UE/EEE) : votre dossier passe par le régime frontalier (formulaire U1).",
  allocationEstimate: true,
};

// Cas d'agrégation européenne : après une occupation à l'étranger (UE/EEE),
// retravailler en Belgique (en pratique ≥ 3 mois selon la règle ONEM en
// vigueur au 01.03.2026) permet d'ouvrir un droit belge complet — l'étranger
// se rattache alors via le formulaire U1.
const R_COMPLET_AGREGATION: WizardResult = {
  dossierSlug: "chomage-complet",
  dossierTitle: "Chômage complet (après travail à l'étranger)",
  rationale:
    "Vous avez retravaillé en Belgique après votre occupation à l'étranger : vous pouvez ouvrir un droit belge complet, en rattachant vos périodes étrangères via le formulaire U1.",
  allocationEstimate: true,
};

const R_RCC: WizardResult = {
  dossierSlug: "prepension",
  dossierTitle: "Régime de chômage avec complément d'entreprise (RCC)",
  rationale:
    "Licencié en fin de carrière, vous pouvez cumuler allocations de chômage et complément payé par votre ex-employeur.",
  allocationEstimate: true,
};

export const WIZARD_SITUATIONS: WizardSituation[] = [
  // ── 1. Contrat suspendu temporairement → CT (TEM/INT/GRE/VAC) ──────────────
  {
    value: "contrat-suspendu",
    icon: "Briefcase",
    label: "Mon travail est à l'arrêt temporairement",
    description: "Chômage temporaire, contrat suspendu",
    subQuestion: {
      question: "Votre employeur vous a mis en chômage temporaire ?",
      helpText:
        "Chômage temporaire = votre contrat continue mais le travail est suspendu un moment (manque de travail, intempéries, force majeure, grève, fermeture collective…). Vous reprendrez chez le même employeur.",
      options: [
        {
          value: "oui-ct",
          label: "Oui, je reprendrai chez le même employeur",
          result: R_CT,
        },
        {
          value: "non-fin",
          label: "Non, mon contrat est définitivement terminé",
          result: R_COMPLET_PREMIERE,
        },
      ],
    },
  },

  // ── 2. Perte d'emploi → complet / insertion / étranger ─────────────────────
  {
    value: "perte-emploi",
    icon: "UserMinus",
    label: "J'ai perdu mon emploi",
    description: "Licenciement, fin de contrat ou de CDD",
    subQuestion: {
      question: "Quel est votre parcours ?",
      helpText:
        "On veut savoir si vous avez déjà travaillé assez longtemps pour ouvrir un droit, ou si vous sortez juste des études.",
      options: [
        {
          value: "passe-travail-be",
          label: "J'ai travaillé un bon moment en Belgique",
          helpText:
            "Vous avez un passé professionnel salarié en Belgique (plusieurs mois à plusieurs années).",
          // TPV (1ère demande, art. 33) vs NCO/NPE/ORD (redemande)
          refineQuestion: {
            question: "Est-ce votre toute première demande de chômage ?",
            helpText:
              "« Première fois » = vous n'avez jamais touché d'allocations de chômage avant. Si vous en avez déjà reçu un jour, même il y a longtemps, c'est une redemande.",
            options: [
              {
                value: "premiere",
                label: "Oui, c'est la première fois",
                result: R_COMPLET_PREMIERE,
              },
              {
                value: "redemande",
                label: "Non, j'ai déjà été au chômage avant",
                result: R_COMPLET_REDEMANDE,
              },
            ],
          },
        },
        {
          value: "sors-etudes",
          label: "Je sors des études, j'ai peu ou pas travaillé",
          helpText:
            "Vous n'avez pas (assez) travaillé pour ouvrir un droit classique — c'est la voie de l'insertion.",
          result: R_INSERTION,
        },
        {
          value: "travail-etranger",
          label: "J'ai travaillé à l'étranger (UE/EEE)",
          helpText:
            "Vous avez travaillé dans un pays de l'Union européenne / EEE et vous revenez en Belgique.",
          // Agrégation UE : DE3/E303/U1. Retravailler en BE ouvre le droit complet.
          refineQuestion: {
            question: "Avez-vous retravaillé en Belgique depuis votre retour ?",
            helpText:
              "Reprendre un travail en Belgique (en pratique au moins 3 mois selon la règle en vigueur) permet d'ouvrir un droit belge complet. Sinon, votre dossier passe par le régime frontalier avec le formulaire U1.",
            options: [
              {
                value: "retravaille-be",
                label: "Oui, j'ai retravaillé en Belgique",
                result: R_COMPLET_AGREGATION,
              },
              {
                value: "pas-retravaille",
                label: "Non, je reviens juste de l'étranger",
                result: R_FRONTALIER,
              },
            ],
          },
        },
      ],
    },
  },

  // ── 3. Jeune / fin d'études → insertion (avec garde d'âge) ──────────────────
  {
    value: "jeune-etudes",
    icon: "GraduationCap",
    label: "Je sors des études / je suis jeune",
    description: "Allocations d'insertion, premier emploi",
    subQuestion: {
      question: "Quel âge avez-vous ?",
      helpText:
        "L'âge est déterminant : les allocations d'insertion doivent en principe être demandées avant 25 ans.",
      options: [
        {
          value: "moins-25",
          label: "Moins de 25 ans",
          result: R_INSERTION,
        },
        {
          value: "25-plus",
          label: "25 ans ou plus",
          helpText:
            "Au-delà de 25 ans, l'insertion n'est en principe plus ouverte — tout dépend de si vous avez déjà travaillé.",
          refineQuestion: {
            question: "Avez-vous déjà travaillé (salarié) ?",
            options: [
              {
                value: "a-travaille",
                label: "Oui, j'ai un passé de travail",
                result: R_COMPLET_PREMIERE,
              },
              {
                value: "jamais",
                label: "Non, jamais (ou presque)",
                result: {
                  dossierSlug: "allocations-insertion",
                  dossierTitle: "Allocations d'insertion — vérifier l'âge",
                  rationale:
                    "Au-delà de 25 ans, le droit aux allocations d'insertion n'est généralement plus ouvert (sauf exceptions). On vous oriente vers ce dossier pour vérifier votre situation précise.",
                },
              },
            ],
          },
        },
      ],
    },
  },

  // ── 4. Frontalier / travail à l'étranger ───────────────────────────────────
  {
    value: "frontalier",
    icon: "MapPinned",
    label: "Je suis frontalier ou j'ai travaillé à l'étranger",
    description: "Travail transfrontalier, retour UE/EEE",
    subQuestion: {
      question: "Votre situation transfrontalière ?",
      helpText:
        "Frontalier = vous habitez un pays et travaillez dans un autre, en rentrant chez vous régulièrement.",
      options: [
        {
          value: "frontalier-classique",
          label: "Je rentre chez moi chaque semaine",
          helpText:
            "Vous habitez en Belgique (ou pays voisin) et vous travaillez de l'autre côté de la frontière, en rentrant au moins 1 fois par semaine.",
          result: R_FRONTALIER,
        },
        {
          value: "retour-ue",
          label: "Je rentre d'une occupation à l'étranger (UE/EEE)",
          // Même refine que perte-emploi → cohérence sur l'agrégation
          refineQuestion: {
            question: "Avez-vous retravaillé en Belgique depuis votre retour ?",
            helpText:
              "Reprendre un travail en Belgique (≈ 3 mois minimum) permet d'ouvrir un droit belge complet. Sinon, c'est le régime frontalier avec le formulaire U1.",
            options: [
              {
                value: "retravaille-be",
                label: "Oui, j'ai retravaillé en Belgique",
                result: R_COMPLET_AGREGATION,
              },
              {
                value: "pas-retravaille",
                label: "Non, pas encore",
                result: R_FRONTALIER,
              },
            ],
          },
        },
      ],
    },
  },

  // ── 5. Fin de carrière → RCC (NPR) ──────────────────────────────────────────
  {
    value: "fin-carriere",
    icon: "Hourglass",
    label: "Je suis en fin de carrière (licencié·e)",
    description: "RCC, complément d'entreprise",
    subQuestion: {
      question: "Avez-vous été licencié·e par votre employeur ?",
      helpText:
        "Le régime de chômage avec complément d'entreprise (RCC, ex-prépension) suppose un LICENCIEMENT — pas une démission.",
      options: [
        {
          value: "licencie",
          label: "Oui, mon employeur m'a licencié·e",
          result: R_RCC,
        },
        {
          value: "demission",
          label: "Non, j'ai démissionné / autre",
          result: {
            dossierSlug: "chomage-complet",
            dossierTitle: "Chômage complet",
            rationale:
              "Sans licenciement, le RCC n'est pas ouvert — c'est la voie du chômage complet classique (attention au délai d'attente possible après une démission).",
          },
        },
      ],
    },
  },

  // ── 6. Handicap ─────────────────────────────────────────────────────────────
  {
    value: "handicap",
    icon: "Accessibility",
    label: "Je suis en situation de handicap",
    description: "Incapacité de travail, allocations",
    subQuestion: {
      question: "Vous travaillez actuellement ?",
      options: [
        {
          value: "handicap-travaille",
          label: "Oui",
          result: {
            dossierSlug: "chomage-temporaire",
            dossierTitle: "Chômage temporaire (force majeure médicale)",
            rationale:
              "Si votre incapacité de travail est temporaire, c'est la voie standard.",
          },
        },
        {
          value: "handicap-ne-travaille-pas",
          label: "Non",
          result: {
            dossierSlug: null,
            dossierTitle: "Allocations (DG Personnes handicapées)",
            rationale:
              "Le parcours allocations de remplacement / d'intégration arrive bientôt sur beldoc.",
          },
        },
      ],
    },
  },

  // ── 7. Autre ────────────────────────────────────────────────────────────────
  {
    value: "autre",
    icon: "HelpCircle",
    label: "Autre situation",
    description: "Décrivez votre besoin, on vous oriente",
    result: {
      dossierSlug: null,
      dossierTitle: "Décrivez votre situation",
      rationale:
        "Décrivez votre situation via le formulaire de contact — on vous orientera vers la bonne démarche.",
    },
  },
];
