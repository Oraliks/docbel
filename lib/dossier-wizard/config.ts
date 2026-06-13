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
    "Ton contrat est suspendu pour un temps : tu peux toucher des allocations pendant cette période, puis reprendre ton travail.",
};

const R_COMPLET_PREMIERE: WizardResult = {
  dossierSlug: "chomage-complet",
  dossierTitle: "Chômage complet — première demande",
  rationale:
    "Tu as assez travaillé pour ouvrir un droit au chômage complet pour la première fois.",
  allocationEstimate: true,
};

const R_COMPLET_REDEMANDE: WizardResult = {
  dossierSlug: "chomage-complet",
  dossierTitle: "Chômage complet — redemande",
  rationale:
    "Tu as déjà été indemnisé par le passé : on rouvre ton droit au chômage complet.",
  allocationEstimate: true,
};

const R_INSERTION: WizardResult = {
  dossierSlug: "allocations-insertion",
  dossierTitle: "Allocations d'insertion (jeunes)",
  rationale:
    "Tu sors des études sans avoir (assez) travaillé : c'est la voie des allocations d'insertion, après un stage d'insertion de 310 jours.",
};

const R_FRONTALIER: WizardResult = {
  dossierSlug: "chomage-frontalier",
  dossierTitle: "Chômage frontalier",
  rationale:
    "Tu résides dans un pays et tu travaillais dans un autre (UE/EEE) : ton dossier passe par le régime frontalier (formulaire U1).",
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
    "Tu as retravaillé en Belgique après ton occupation à l'étranger : tu peux ouvrir un droit belge complet, en rattachant tes périodes étrangères via le formulaire U1.",
  allocationEstimate: true,
};

const R_RCC: WizardResult = {
  dossierSlug: "prepension",
  dossierTitle: "Régime de chômage avec complément d'entreprise (RCC)",
  rationale:
    "Licencié en fin de carrière, tu peux cumuler allocations de chômage et complément payé par ton ex-employeur.",
  allocationEstimate: true,
};

export const WIZARD_SITUATIONS: WizardSituation[] = [
  // ── 1. Contrat suspendu temporairement → CT (TEM/INT/GRE/VAC) ──────────────
  {
    value: "contrat-suspendu",
    icon: "Briefcase",
    label: "Mon travail est à l'arrêt temporairement",
    subQuestion: {
      question: "Ton employeur t'a mis en chômage temporaire ?",
      helpText:
        "Chômage temporaire = ton contrat continue mais le travail est suspendu un moment (manque de travail, intempéries, force majeure, grève, fermeture collective…). Tu reprendras chez le même employeur.",
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
    subQuestion: {
      question: "Quel est ton parcours ?",
      helpText:
        "On veut savoir si tu as déjà travaillé assez longtemps pour ouvrir un droit, ou si tu sors juste des études.",
      options: [
        {
          value: "passe-travail-be",
          label: "J'ai travaillé un bon moment en Belgique",
          helpText:
            "Tu as un passé professionnel salarié en Belgique (plusieurs mois à plusieurs années).",
          // TPV (1ère demande, art. 33) vs NCO/NPE/ORD (redemande)
          refineQuestion: {
            question: "Est-ce ta toute première demande de chômage ?",
            helpText:
              "« Première fois » = tu n'as jamais touché d'allocations de chômage avant. Si tu en as déjà reçu un jour, même il y a longtemps, c'est une redemande.",
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
            "Tu n'as pas (assez) travaillé pour ouvrir un droit classique — c'est la voie de l'insertion.",
          result: R_INSERTION,
        },
        {
          value: "travail-etranger",
          label: "J'ai travaillé à l'étranger (UE/EEE)",
          helpText:
            "Tu as travaillé dans un pays de l'Union européenne / EEE et tu reviens en Belgique.",
          // Agrégation UE : DE3/E303/U1. Retravailler en BE ouvre le droit complet.
          refineQuestion: {
            question: "As-tu retravaillé en Belgique depuis ton retour ?",
            helpText:
              "Reprendre un travail en Belgique (en pratique au moins 3 mois selon la règle en vigueur) permet d'ouvrir un droit belge complet. Sinon, ton dossier passe par le régime frontalier avec le formulaire U1.",
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
    subQuestion: {
      question: "Quel âge as-tu ?",
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
            "Au-delà de 25 ans, l'insertion n'est en principe plus ouverte — tout dépend de si tu as déjà travaillé.",
          refineQuestion: {
            question: "As-tu déjà travaillé (salarié) ?",
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
                    "Au-delà de 25 ans, le droit aux allocations d'insertion n'est généralement plus ouvert (sauf exceptions). On t'oriente vers ce dossier pour vérifier ta situation précise.",
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
    subQuestion: {
      question: "Ta situation transfrontalière ?",
      helpText:
        "Frontalier = tu habites un pays et travailles dans un autre, en rentrant chez toi régulièrement.",
      options: [
        {
          value: "frontalier-classique",
          label: "Je rentre chez moi chaque semaine",
          helpText:
            "Tu habites en Belgique (ou pays voisin) et tu travailles de l'autre côté de la frontière, en rentrant au moins 1 fois par semaine.",
          result: R_FRONTALIER,
        },
        {
          value: "retour-ue",
          label: "Je rentre d'une occupation à l'étranger (UE/EEE)",
          // Même refine que perte-emploi → cohérence sur l'agrégation
          refineQuestion: {
            question: "As-tu retravaillé en Belgique depuis ton retour ?",
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
    subQuestion: {
      question: "As-tu été licencié·e par ton employeur ?",
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
    subQuestion: {
      question: "Tu travailles actuellement ?",
      options: [
        {
          value: "handicap-travaille",
          label: "Oui",
          result: {
            dossierSlug: "chomage-temporaire",
            dossierTitle: "Chômage temporaire (force majeure médicale)",
            rationale:
              "Si ton incapacité de travail est temporaire, c'est la voie standard.",
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
    result: {
      dossierSlug: null,
      dossierTitle: "Décris ta situation",
      rationale:
        "Décris ta situation via le formulaire de contact — on t'orientera vers la bonne démarche.",
    },
  },
];
