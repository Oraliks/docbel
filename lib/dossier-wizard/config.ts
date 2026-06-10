// Configuration de l'orientation wizard de `/mon-dossier`.
//
// On modélise le parcours sous forme d'un arbre à 1 ou 2 niveaux :
//
//   Situation (step 1) ──► [SubQuestion (step 2)] ──► Result (step 4)
//                       └─ ou Result direct si pas de sub-question
//
// La step 3 ("Affinons") du stepper visuel reste affichée comme étape future,
// mais inactive pour l'instant (clair gris). Elle sera utilisée lorsqu'un même
// couple (situation, sous-option) pourra mener à plusieurs dossiers — par
// exemple pour départager chômage temporaire « force majeure » vs
// « économique » selon le secteur.
//
// `dossierSlug` = `null` signifie « dossier bientôt disponible » : le wizard
// affichera alors une carte d'attente avec un lien vers `/aidez-moi`.

export interface WizardResult {
  /// Slug du dossier cible. `null` = pas encore disponible.
  dossierSlug: string | null;
  /// Titre du dossier (pour l'affichage du résultat).
  dossierTitle: string;
  /// Phrase qui explique pourquoi ce choix.
  rationale: string;
}

export interface WizardSubOption {
  value: string;
  label: string;
  helpText?: string;
  result: WizardResult;
}

export interface WizardSituation {
  value: string;
  /// Nom d'icône lucide-react (ex. "Briefcase"). Le mapping vers le composant
  /// est fait localement dans `components/docbel/onboarding/dossier-wizard.tsx`
  /// pour garder la config sérialisable et éviter d'importer React ici.
  icon: string;
  /// Libellé affiché sur la carte de step 1 (ex. "Je travaille").
  label: string;
  /// Sous-question de step 2. Absente = la situation résout directement
  /// vers `result`.
  subQuestion?: {
    question: string;
    helpText?: string;
    options: WizardSubOption[];
  };
  /// Résultat direct (pas de sub-question).
  result?: WizardResult;
}

export const WIZARD_SITUATIONS: WizardSituation[] = [
  {
    value: "je-travaille",
    icon: "Briefcase",
    label: "Je travaille",
    subQuestion: {
      question: "Quelle est ta situation ?",
      options: [
        {
          value: "contrat-suspendu",
          label: "Mon contrat est suspendu",
          result: {
            dossierSlug: "chomage-temporaire",
            dossierTitle: "Chômage temporaire",
            rationale:
              "Tu as droit à des allocations pendant cette suspension.",
          },
        },
        {
          value: "perte-emploi",
          label: "J'ai perdu mon emploi",
          result: {
            dossierSlug: "chomage-complet",
            dossierTitle: "Chômage complet",
            rationale: "Tu dois t'inscrire au chômage complet.",
          },
        },
        {
          value: "frontalier",
          label: "Je suis frontalier",
          result: {
            dossierSlug: "chomage-frontalier",
            dossierTitle: "Chômage frontalier",
            rationale: "Tu relèves du régime frontalier.",
          },
        },
        {
          value: "fin-carriere-rcc",
          label: "Bientôt fin de carrière (RCC)",
          result: {
            dossierSlug: "prepension",
            dossierTitle: "Prépension (RCC)",
            rationale:
              "Tu peux prétendre au régime de chômage avec complément d'entreprise.",
          },
        },
      ],
    },
  },
  {
    value: "recherche-emploi",
    icon: "Search",
    label: "Je recherche un emploi",
    subQuestion: {
      question: "As-tu déjà travaillé en Belgique ?",
      options: [
        {
          value: "deja-travaille",
          label: "Oui",
          result: {
            dossierSlug: "chomage-complet",
            dossierTitle: "Chômage complet",
            rationale:
              "Avec un passé professionnel belge, tu peux ouvrir un droit au chômage complet.",
          },
        },
        {
          value: "jamais-travaille",
          label: "Non, jamais travaillé",
          result: {
            dossierSlug: null,
            dossierTitle: "Allocations d'insertion",
            rationale:
              "Sans expérience professionnelle, c'est la voie des allocations d'insertion qui s'applique — ce dossier arrive bientôt sur beldoc.",
          },
        },
      ],
    },
  },
  {
    value: "etudiant",
    icon: "GraduationCap",
    label: "Je suis étudiant ou apprenti",
    result: {
      dossierSlug: null,
      dossierTitle: "Allocations d'insertion / formation",
      rationale:
        "Le parcours étudiant / apprenti arrive bientôt sur beldoc (allocations d'insertion après stage d'insertion, aides à la formation).",
    },
  },
  {
    value: "retraite",
    icon: "Hourglass",
    label: "Je suis retraité",
    result: {
      dossierSlug: null,
      dossierTitle: "Pension et aide aux aînés",
      rationale:
        "Le parcours pension / GRAPA arrive bientôt sur beldoc. Tu peux nous contacter en attendant.",
    },
  },
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
            dossierTitle: "Allocations spéciales (DG Personnes handicapées)",
            rationale:
              "Le parcours allocations de remplacement / d'intégration arrive bientôt sur beldoc.",
          },
        },
      ],
    },
  },
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
