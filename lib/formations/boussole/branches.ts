/**
 * Boussole d'orientation — les 8 branches (domaines). Source de vérité pour le
 * seed (table OrientationBranch) ET pour l'affichage du résultat. Isomorphe.
 */

export const BRANCH_KEYS = [
  "ADMINISTRATIVE_OFFICE",
  "SOCIAL_CARE",
  "DIGITAL_IT",
  "TECHNICAL_MANUAL",
  "LOGISTICS_TRANSPORT",
  "SALES_CUSTOMER",
  "HEALTH_WELLBEING",
  "ENTREPRENEURSHIP",
] as const;

export type BranchKey = (typeof BRANCH_KEYS)[number];

export interface BranchDef {
  key: BranchKey;
  slug: string;
  name: string;
  description: string;
  possibleJobs: string[];
  /** Nom d'icône lucide-react. */
  icon: string;
  color: string;
  order: number;
}

export const BRANCHES: BranchDef[] = [
  {
    key: "ADMINISTRATIVE_OFFICE",
    slug: "administratif-bureau",
    name: "Administratif & bureau",
    description:
      "Pour les personnes organisées, qui aiment les démarches, les documents, la gestion de dossiers et les environnements structurés.",
    possibleJobs: [
      "Assistant administratif",
      "Secrétaire",
      "Assistant RH",
      "Employé de bureau",
      "Gestionnaire de dossiers",
      "Support administratif",
    ],
    icon: "FileText",
    color: "#7C3AED",
    order: 1,
  },
  {
    key: "SOCIAL_CARE",
    slug: "social-aide",
    name: "Social & aide aux personnes",
    description:
      "Pour les personnes qui veulent accompagner, écouter, aider ou orienter d'autres personnes.",
    possibleJobs: [
      "Aide familial",
      "Accompagnateur social",
      "Agent d'accueil social",
      "Médiateur",
      "Aide aux personnes",
      "Éducateur",
    ],
    icon: "HeartHandshake",
    color: "#2563EB",
    order: 2,
  },
  {
    key: "DIGITAL_IT",
    slug: "numerique-informatique",
    name: "Numérique & informatique",
    description:
      "Pour les personnes attirées par l'ordinateur, les outils numériques, le web, le support technique ou la data.",
    possibleJobs: [
      "Support IT",
      "Développeur débutant",
      "Assistant digital",
      "Web designer",
      "Data assistant",
      "Community manager",
    ],
    icon: "MonitorSmartphone",
    color: "#0EA5E9",
    order: 3,
  },
  {
    key: "TECHNICAL_MANUAL",
    slug: "technique-manuel",
    name: "Technique & manuel",
    description:
      "Pour les personnes qui aiment réparer, construire, manipuler, produire ou travailler avec des outils.",
    possibleJobs: [
      "Technicien",
      "Électricien",
      "Maintenance",
      "Bâtiment",
      "Mécanique",
      "Ouvrier qualifié",
    ],
    icon: "Wrench",
    color: "#F97316",
    order: 4,
  },
  {
    key: "LOGISTICS_TRANSPORT",
    slug: "logistique-transport",
    name: "Logistique & transport",
    description:
      "Pour les personnes qui aiment bouger, organiser, préparer, livrer ou gérer des flux.",
    possibleJobs: [
      "Magasinier",
      "Préparateur de commandes",
      "Chauffeur",
      "Dispatcher",
      "Gestionnaire logistique",
    ],
    icon: "Truck",
    color: "#16A34A",
    order: 5,
  },
  {
    key: "SALES_CUSTOMER",
    slug: "commerce-relation-client",
    name: "Commerce & relation client",
    description:
      "Pour les personnes à l'aise avec les échanges, la vente, l'accueil ou le conseil.",
    possibleJobs: [
      "Vendeur",
      "Conseiller client",
      "Commercial",
      "Chargé d'accueil",
      "Téléconseiller",
    ],
    icon: "ShoppingBag",
    color: "#DB2777",
    order: 6,
  },
  {
    key: "HEALTH_WELLBEING",
    slug: "sante-bien-etre",
    name: "Santé & bien-être",
    description:
      "Pour les personnes qui veulent prendre soin des autres, travailler dans l'aide, la santé ou le bien-être.",
    possibleJobs: [
      "Aide-soignant",
      "Aide à domicile",
      "Assistant médical",
      "Accueil médical",
      "Métiers du bien-être",
    ],
    icon: "Stethoscope",
    color: "#DC2626",
    order: 7,
  },
  {
    key: "ENTREPRENEURSHIP",
    slug: "entrepreneuriat",
    name: "Entrepreneuriat",
    description:
      "Pour les personnes qui veulent créer leur activité, devenir indépendant ou construire un projet personnel.",
    possibleJobs: [
      "Indépendant",
      "Activité complémentaire",
      "E-commerce",
      "Prestation de service",
      "Création de SRL",
      "Projet entrepreneurial",
    ],
    icon: "Rocket",
    color: "#9333EA",
    order: 8,
  },
];

export const BRANCH_BY_KEY: Record<BranchKey, BranchDef> = Object.fromEntries(
  BRANCHES.map((b) => [b.key, b]),
) as Record<BranchKey, BranchDef>;

export function isBranchKey(v: unknown): v is BranchKey {
  return typeof v === "string" && (BRANCH_KEYS as readonly string[]).includes(v);
}
