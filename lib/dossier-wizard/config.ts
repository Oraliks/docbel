// Configuration de l'orientation wizard de `/mon-dossier`.
//
// ⚠️ EN COURS DE DÉPRÉCIATION (Decision Builder, migration 54).
// Cet arbre codé en dur est désormais éditable visuellement dans l'admin
// (/admin/decision-trees) et importé en DB par le seed `chomage-orientation`.
// Tant que le flag `DECISION_TREE_RUNTIME_ENABLED` est OFF (ou qu'aucun arbre
// publié n'existe), ce fichier reste le FALLBACK de `/mon-dossier` — d'où sa
// conservation. Suppression effective prévue dans un PR séparé, après ≥ 2
// semaines de validation en prod du runtime DB. La parité 1:1 est garantie par
// `lib/decision-builder/__tests__/seed-parity.test.ts`.
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
  /// Clé i18n du titre (préférée si fournie). Namespace : `public.dossierContent.*`.
  dossierTitleKey?: string;
  /// Phrase qui explique pourquoi ce choix.
  rationale: string;
  /// Clé i18n de l'explication (préférée si fournie).
  rationaleKey?: string;
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
  /// Niveau de correspondance du dossier principal (par défaut "recommande").
  /// Le wizard reste un PRÉ-GUIDE : pas de score numérique, juste un niveau.
  matchLevel?: "recommande" | "pertinent" | "a_verifier";
  /// Slugs de dossiers proches à proposer en complément du principal.
  /// Fusionnés avec `DocumentBundle.relatedBundles` à la résolution.
  related?: string[];
  /// Disponibilité (modèle ONEM 2026, optionnel). Absent ⇒ déduit de
  /// `dossierSlug` (null = indisponible). Pilote le rendu : "disponible"
  /// (Démarrer), "a_creer" (bientôt), "orientation_externe" (carte contact).
  availability?: "disponible" | "a_creer" | "orientation_externe";
  /// Étape suivante non engageante affichée sous le résultat.
  nextStep?: string;
  /// Clé i18n de l'étape suivante (préférée si fournie).
  nextStepKey?: string;
}

/// Option de la 3ᵉ étape (« Affinons »). Résout toujours vers un résultat.
export interface WizardRefineOption {
  value: string;
  label: string;
  /// Clé i18n du libellé (préférée si fournie). Namespace : `public.dossierContent.*`.
  labelKey?: string;
  helpText?: string;
  /// Clé i18n du helpText (préférée si fournie).
  helpTextKey?: string;
  result: WizardResult;
}

export interface WizardSubOption {
  value: string;
  label: string;
  /// Clé i18n du libellé (préférée si fournie).
  labelKey?: string;
  helpText?: string;
  /// Clé i18n du helpText (préférée si fournie).
  helpTextKey?: string;
  /// Soit la sous-option raffine encore (step 3), soit elle résout direct.
  /// Exactement un des deux doit être défini.
  refineQuestion?: {
    question: string;
    /// Clé i18n de la question (préférée si fournie).
    questionKey?: string;
    helpText?: string;
    /// Clé i18n du helpText (préférée si fournie).
    helpTextKey?: string;
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
  /// Clé i18n du libellé (préférée si fournie).
  labelKey?: string;
  /// Sous-titre court affiché sous le label dans la carte de situation
  /// (step 1 du wizard). Purement descriptif, aide l'utilisateur à se situer.
  description?: string;
  /// Clé i18n de la description (préférée si fournie).
  descriptionKey?: string;
  subQuestion?: {
    question: string;
    /// Clé i18n de la question (préférée si fournie).
    questionKey?: string;
    helpText?: string;
    /// Clé i18n du helpText (préférée si fournie).
    helpTextKey?: string;
    options: WizardSubOption[];
  };
  result?: WizardResult;
}

// ── Résultats réutilisés (évite la duplication) ──────────────────────────────

const R_CT: WizardResult = {
  dossierSlug: "chomage-temporaire",
  dossierTitle: "Chômage temporaire",
  dossierTitleKey: "wizard.result.ct.title",
  rationale:
    "Votre contrat est suspendu pour un temps : vous pouvez toucher des allocations pendant cette période, puis reprendre votre travail.",
  rationaleKey: "wizard.result.ct.rationale",
};

const R_COMPLET_PREMIERE: WizardResult = {
  dossierSlug: "chomage-complet",
  dossierTitle: "Chômage complet — première demande",
  dossierTitleKey: "wizard.result.completPremiere.title",
  rationale:
    "Vous avez assez travaillé pour ouvrir un droit au chômage complet pour la première fois.",
  rationaleKey: "wizard.result.completPremiere.rationale",
  allocationEstimate: true,
};

const R_COMPLET_REDEMANDE: WizardResult = {
  dossierSlug: "chomage-complet",
  dossierTitle: "Chômage complet — redemande",
  dossierTitleKey: "wizard.result.completRedemande.title",
  rationale:
    "Vous avez déjà été indemnisé par le passé : on rouvre votre droit au chômage complet.",
  rationaleKey: "wizard.result.completRedemande.rationale",
  allocationEstimate: true,
};

const R_INSERTION: WizardResult = {
  dossierSlug: "allocations-insertion",
  dossierTitle: "Allocations d'insertion (jeunes)",
  dossierTitleKey: "wizard.result.insertion.title",
  rationale:
    "Vous sortez des études sans avoir (assez) travaillé : c'est la voie des allocations d'insertion, après un stage d'insertion de 310 jours.",
  rationaleKey: "wizard.result.insertion.rationale",
};

const R_FRONTALIER: WizardResult = {
  dossierSlug: "chomage-frontalier",
  dossierTitle: "Chômage frontalier",
  dossierTitleKey: "wizard.result.frontalier.title",
  rationale:
    "Vous résidez dans un pays et vous travailliez dans un autre (UE/EEE) : votre dossier passe par le régime frontalier (formulaire U1).",
  rationaleKey: "wizard.result.frontalier.rationale",
  allocationEstimate: true,
};

// Cas d'agrégation européenne : après une occupation à l'étranger (UE/EEE),
// retravailler en Belgique (en pratique ≥ 3 mois selon la règle ONEM en
// vigueur au 01.03.2026) permet d'ouvrir un droit belge complet — l'étranger
// se rattache alors via le formulaire U1.
const R_COMPLET_AGREGATION: WizardResult = {
  dossierSlug: "chomage-complet",
  dossierTitle: "Chômage complet (après travail à l'étranger)",
  dossierTitleKey: "wizard.result.completAgregation.title",
  rationale:
    "Vous avez retravaillé en Belgique après votre occupation à l'étranger : vous pouvez ouvrir un droit belge complet, en rattachant vos périodes étrangères via le formulaire U1.",
  rationaleKey: "wizard.result.completAgregation.rationale",
  allocationEstimate: true,
};

const R_RCC: WizardResult = {
  dossierSlug: "prepension",
  dossierTitle: "Régime de chômage avec complément d'entreprise (RCC)",
  dossierTitleKey: "wizard.result.rcc.title",
  rationale:
    "Licencié en fin de carrière, vous pouvez cumuler allocations de chômage et complément payé par votre ex-employeur.",
  rationaleKey: "wizard.result.rcc.rationale",
  allocationEstimate: true,
};

export const WIZARD_SITUATIONS: WizardSituation[] = [
  // ── 1. Contrat suspendu temporairement → CT (TEM/INT/GRE/VAC) ──────────────
  {
    value: "contrat-suspendu",
    icon: "Briefcase",
    label: "Mon travail est à l'arrêt temporairement",
    labelKey: "wizard.s.contratSuspendu.label",
    description: "Chômage temporaire, contrat suspendu",
    descriptionKey: "wizard.s.contratSuspendu.description",
    subQuestion: {
      question: "Votre employeur vous a mis en chômage temporaire ?",
      questionKey: "wizard.s.contratSuspendu.sub.question",
      helpText:
        "Chômage temporaire = votre contrat continue mais le travail est suspendu un moment (manque de travail, intempéries, force majeure, grève, fermeture collective…). Vous reprendrez chez le même employeur.",
      helpTextKey: "wizard.s.contratSuspendu.sub.help",
      options: [
        {
          value: "oui-ct",
          label: "Oui, je reprendrai chez le même employeur",
          labelKey: "wizard.s.contratSuspendu.sub.opt.ouiCt.label",
          result: R_CT,
        },
        {
          value: "non-fin",
          label: "Non, mon contrat est définitivement terminé",
          labelKey: "wizard.s.contratSuspendu.sub.opt.nonFin.label",
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
    labelKey: "wizard.s.perteEmploi.label",
    description: "Licenciement, fin de contrat ou de CDD",
    descriptionKey: "wizard.s.perteEmploi.description",
    subQuestion: {
      question: "Quel est votre parcours ?",
      questionKey: "wizard.s.perteEmploi.sub.question",
      helpText:
        "On veut savoir si vous avez déjà travaillé assez longtemps pour ouvrir un droit, ou si vous sortez juste des études.",
      helpTextKey: "wizard.s.perteEmploi.sub.help",
      options: [
        {
          value: "passe-travail-be",
          label: "J'ai travaillé un bon moment en Belgique",
          labelKey: "wizard.s.perteEmploi.sub.opt.passeTravailBe.label",
          helpText:
            "Vous avez un passé professionnel salarié en Belgique (plusieurs mois à plusieurs années).",
          helpTextKey: "wizard.s.perteEmploi.sub.opt.passeTravailBe.help",
          // TPV (1ère demande, art. 33) vs NCO/NPE/ORD (redemande)
          refineQuestion: {
            question: "Est-ce votre toute première demande de chômage ?",
            questionKey: "wizard.s.perteEmploi.sub.opt.passeTravailBe.refine.question",
            helpText:
              "« Première fois » = vous n'avez jamais touché d'allocations de chômage avant. Si vous en avez déjà reçu un jour, même il y a longtemps, c'est une redemande.",
            helpTextKey: "wizard.s.perteEmploi.sub.opt.passeTravailBe.refine.help",
            options: [
              {
                value: "premiere",
                label: "Oui, c'est la première fois",
                labelKey: "wizard.s.perteEmploi.sub.opt.passeTravailBe.refine.opt.premiere.label",
                result: R_COMPLET_PREMIERE,
              },
              {
                value: "redemande",
                label: "Non, j'ai déjà été au chômage avant",
                labelKey: "wizard.s.perteEmploi.sub.opt.passeTravailBe.refine.opt.redemande.label",
                result: R_COMPLET_REDEMANDE,
              },
            ],
          },
        },
        {
          value: "sors-etudes",
          label: "Je sors des études, j'ai peu ou pas travaillé",
          labelKey: "wizard.s.perteEmploi.sub.opt.sorsEtudes.label",
          helpText:
            "Vous n'avez pas (assez) travaillé pour ouvrir un droit classique — c'est la voie de l'insertion.",
          helpTextKey: "wizard.s.perteEmploi.sub.opt.sorsEtudes.help",
          result: R_INSERTION,
        },
        {
          value: "travail-etranger",
          label: "J'ai travaillé à l'étranger (UE/EEE)",
          labelKey: "wizard.s.perteEmploi.sub.opt.travailEtranger.label",
          helpText:
            "Vous avez travaillé dans un pays de l'Union européenne / EEE et vous revenez en Belgique.",
          helpTextKey: "wizard.s.perteEmploi.sub.opt.travailEtranger.help",
          // Agrégation UE : DE3/E303/U1. Retravailler en BE ouvre le droit complet.
          refineQuestion: {
            question: "Avez-vous retravaillé en Belgique depuis votre retour ?",
            questionKey: "wizard.s.perteEmploi.sub.opt.travailEtranger.refine.question",
            helpText:
              "Reprendre un travail en Belgique (en pratique au moins 3 mois selon la règle en vigueur) permet d'ouvrir un droit belge complet. Sinon, votre dossier passe par le régime frontalier avec le formulaire U1.",
            helpTextKey: "wizard.s.perteEmploi.sub.opt.travailEtranger.refine.help",
            options: [
              {
                value: "retravaille-be",
                label: "Oui, j'ai retravaillé en Belgique",
                labelKey: "wizard.s.perteEmploi.sub.opt.travailEtranger.refine.opt.retravailleBe.label",
                result: R_COMPLET_AGREGATION,
              },
              {
                value: "pas-retravaille",
                label: "Non, je reviens juste de l'étranger",
                labelKey: "wizard.s.perteEmploi.sub.opt.travailEtranger.refine.opt.pasRetravaille.label",
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
    labelKey: "wizard.s.jeuneEtudes.label",
    description: "Allocations d'insertion, premier emploi",
    descriptionKey: "wizard.s.jeuneEtudes.description",
    subQuestion: {
      question: "Quel âge avez-vous ?",
      questionKey: "wizard.s.jeuneEtudes.sub.question",
      helpText:
        "L'âge est déterminant : les allocations d'insertion doivent en principe être demandées avant 25 ans.",
      helpTextKey: "wizard.s.jeuneEtudes.sub.help",
      options: [
        {
          value: "moins-25",
          label: "Moins de 25 ans",
          labelKey: "wizard.s.jeuneEtudes.sub.opt.moins25.label",
          result: R_INSERTION,
        },
        {
          value: "25-plus",
          label: "25 ans ou plus",
          labelKey: "wizard.s.jeuneEtudes.sub.opt.vingtCinqPlus.label",
          helpText:
            "Au-delà de 25 ans, l'insertion n'est en principe plus ouverte — tout dépend de si vous avez déjà travaillé.",
          helpTextKey: "wizard.s.jeuneEtudes.sub.opt.vingtCinqPlus.help",
          refineQuestion: {
            question: "Avez-vous déjà travaillé (salarié) ?",
            questionKey: "wizard.s.jeuneEtudes.sub.opt.vingtCinqPlus.refine.question",
            options: [
              {
                value: "a-travaille",
                label: "Oui, j'ai un passé de travail",
                labelKey: "wizard.s.jeuneEtudes.sub.opt.vingtCinqPlus.refine.opt.aTravaille.label",
                result: R_COMPLET_PREMIERE,
              },
              {
                value: "jamais",
                label: "Non, jamais (ou presque)",
                labelKey: "wizard.s.jeuneEtudes.sub.opt.vingtCinqPlus.refine.opt.jamais.label",
                result: {
                  dossierSlug: "allocations-insertion",
                  dossierTitle: "Allocations d'insertion — vérifier l'âge",
                  dossierTitleKey: "wizard.result.insertionVerifierAge.title",
                  rationale:
                    "Au-delà de 25 ans, le droit aux allocations d'insertion n'est généralement plus ouvert (sauf exceptions). On vous oriente vers ce dossier pour vérifier votre situation précise.",
                  rationaleKey: "wizard.result.insertionVerifierAge.rationale",
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
    labelKey: "wizard.s.frontalier.label",
    description: "Travail transfrontalier, retour UE/EEE",
    descriptionKey: "wizard.s.frontalier.description",
    subQuestion: {
      question: "Votre situation transfrontalière ?",
      questionKey: "wizard.s.frontalier.sub.question",
      helpText:
        "Frontalier = vous habitez un pays et travaillez dans un autre, en rentrant chez vous régulièrement.",
      helpTextKey: "wizard.s.frontalier.sub.help",
      options: [
        {
          value: "frontalier-classique",
          label: "Je rentre chez moi chaque semaine",
          labelKey: "wizard.s.frontalier.sub.opt.frontalierClassique.label",
          helpText:
            "Vous habitez en Belgique (ou pays voisin) et vous travaillez de l'autre côté de la frontière, en rentrant au moins 1 fois par semaine.",
          helpTextKey: "wizard.s.frontalier.sub.opt.frontalierClassique.help",
          result: R_FRONTALIER,
        },
        {
          value: "retour-ue",
          label: "Je rentre d'une occupation à l'étranger (UE/EEE)",
          labelKey: "wizard.s.frontalier.sub.opt.retourUe.label",
          // Même refine que perte-emploi → cohérence sur l'agrégation
          refineQuestion: {
            question: "Avez-vous retravaillé en Belgique depuis votre retour ?",
            questionKey: "wizard.s.frontalier.sub.opt.retourUe.refine.question",
            helpText:
              "Reprendre un travail en Belgique (≈ 3 mois minimum) permet d'ouvrir un droit belge complet. Sinon, c'est le régime frontalier avec le formulaire U1.",
            helpTextKey: "wizard.s.frontalier.sub.opt.retourUe.refine.help",
            options: [
              {
                value: "retravaille-be",
                label: "Oui, j'ai retravaillé en Belgique",
                labelKey: "wizard.s.frontalier.sub.opt.retourUe.refine.opt.retravailleBe.label",
                result: R_COMPLET_AGREGATION,
              },
              {
                value: "pas-retravaille",
                label: "Non, pas encore",
                labelKey: "wizard.s.frontalier.sub.opt.retourUe.refine.opt.pasRetravaille.label",
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
    labelKey: "wizard.s.finCarriere.label",
    description: "RCC, complément d'entreprise",
    descriptionKey: "wizard.s.finCarriere.description",
    subQuestion: {
      question: "Avez-vous été licencié·e par votre employeur ?",
      questionKey: "wizard.s.finCarriere.sub.question",
      helpText:
        "Le régime de chômage avec complément d'entreprise (RCC, ex-prépension) suppose un LICENCIEMENT — pas une démission.",
      helpTextKey: "wizard.s.finCarriere.sub.help",
      options: [
        {
          value: "licencie",
          label: "Oui, mon employeur m'a licencié·e",
          labelKey: "wizard.s.finCarriere.sub.opt.licencie.label",
          result: R_RCC,
        },
        {
          value: "demission",
          label: "Non, j'ai démissionné / autre",
          labelKey: "wizard.s.finCarriere.sub.opt.demission.label",
          result: {
            dossierSlug: "chomage-complet",
            dossierTitle: "Chômage complet",
            dossierTitleKey: "wizard.result.completSansRcc.title",
            rationale:
              "Sans licenciement, le RCC n'est pas ouvert — c'est la voie du chômage complet classique (attention au délai d'attente possible après une démission).",
            rationaleKey: "wizard.result.completSansRcc.rationale",
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
    labelKey: "wizard.s.handicap.label",
    description: "Incapacité de travail, allocations",
    descriptionKey: "wizard.s.handicap.description",
    subQuestion: {
      question: "Vous travaillez actuellement ?",
      questionKey: "wizard.s.handicap.sub.question",
      options: [
        {
          value: "handicap-travaille",
          label: "Oui",
          labelKey: "wizard.s.handicap.sub.opt.handicapTravaille.label",
          result: {
            dossierSlug: "chomage-temporaire",
            dossierTitle: "Chômage temporaire (force majeure médicale)",
            dossierTitleKey: "wizard.result.ctFmm.title",
            rationale:
              "Si votre incapacité de travail est temporaire, c'est la voie standard.",
            rationaleKey: "wizard.result.ctFmm.rationale",
          },
        },
        {
          value: "handicap-ne-travaille-pas",
          label: "Non",
          labelKey: "wizard.s.handicap.sub.opt.handicapNeTravaillePas.label",
          result: {
            dossierSlug: null,
            dossierTitle: "Allocations (DG Personnes handicapées)",
            dossierTitleKey: "wizard.result.handicapDg.title",
            rationale:
              "Le parcours allocations de remplacement / d'intégration arrive bientôt sur beldoc.",
            rationaleKey: "wizard.result.handicapDg.rationale",
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
    labelKey: "wizard.s.autre.label",
    description: "Décrivez votre besoin, on vous oriente",
    descriptionKey: "wizard.s.autre.description",
    result: {
      dossierSlug: null,
      dossierTitle: "Décrivez votre situation",
      dossierTitleKey: "wizard.result.autre.title",
      rationale:
        "Décrivez votre situation via le formulaire de contact — on vous orientera vers la bonne démarche.",
      rationaleKey: "wizard.result.autre.rationale",
    },
  },
];
