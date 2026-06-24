/**
 * Boussole d'orientation — les 8 branches (domaines). Source de vérité pour le
 * seed (table OrientationBranch) ET pour l'affichage du résultat. Isomorphe.
 *
 * --- i18n ----------------------------------------------------------------
 * Ce module est PUR (importable client + serveur). Les champs `name`,
 * `description` et `possibleJobs` restent la source FR fonctionnelle
 * (seed DB, fallback serveur). Les champs `nameKey`, `descriptionKey`,
 * `possibleJobsKeys` exposent les chemins de clés i18n (sous
 * `public.formationsLib.boussole.branches.*`) à résoudre côté composant via
 * `t(labelKey as Parameters<typeof t>[0])`.
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
  /** Clé i18n du nom (sous `public.formationsLib`). */
  nameKey: string;
  description: string;
  /** Clé i18n de la description (sous `public.formationsLib`). */
  descriptionKey: string;
  possibleJobs: string[];
  /** Clés i18n des métiers possibles (sous `public.formationsLib`). */
  possibleJobsKeys: string[];
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
    nameKey: "boussole.branches.ADMINISTRATIVE_OFFICE.name",
    description:
      "Pour les personnes organisées, qui aiment les démarches, les documents, la gestion de dossiers et les environnements structurés.",
    descriptionKey: "boussole.branches.ADMINISTRATIVE_OFFICE.description",
    possibleJobs: [
      "Assistant administratif",
      "Secrétaire",
      "Assistant RH",
      "Employé de bureau",
      "Gestionnaire de dossiers",
      "Support administratif",
    ],
    possibleJobsKeys: [
      "boussole.branches.ADMINISTRATIVE_OFFICE.jobs.0",
      "boussole.branches.ADMINISTRATIVE_OFFICE.jobs.1",
      "boussole.branches.ADMINISTRATIVE_OFFICE.jobs.2",
      "boussole.branches.ADMINISTRATIVE_OFFICE.jobs.3",
      "boussole.branches.ADMINISTRATIVE_OFFICE.jobs.4",
      "boussole.branches.ADMINISTRATIVE_OFFICE.jobs.5",
    ],
    icon: "FileText",
    color: "#7C3AED",
    order: 1,
  },
  {
    key: "SOCIAL_CARE",
    slug: "social-aide",
    name: "Social & aide aux personnes",
    nameKey: "boussole.branches.SOCIAL_CARE.name",
    description:
      "Pour les personnes qui veulent accompagner, écouter, aider ou orienter d'autres personnes.",
    descriptionKey: "boussole.branches.SOCIAL_CARE.description",
    possibleJobs: [
      "Aide familial",
      "Accompagnateur social",
      "Agent d'accueil social",
      "Médiateur",
      "Aide aux personnes",
      "Éducateur",
    ],
    possibleJobsKeys: [
      "boussole.branches.SOCIAL_CARE.jobs.0",
      "boussole.branches.SOCIAL_CARE.jobs.1",
      "boussole.branches.SOCIAL_CARE.jobs.2",
      "boussole.branches.SOCIAL_CARE.jobs.3",
      "boussole.branches.SOCIAL_CARE.jobs.4",
      "boussole.branches.SOCIAL_CARE.jobs.5",
    ],
    icon: "HeartHandshake",
    color: "#2563EB",
    order: 2,
  },
  {
    key: "DIGITAL_IT",
    slug: "numerique-informatique",
    name: "Numérique & informatique",
    nameKey: "boussole.branches.DIGITAL_IT.name",
    description:
      "Pour les personnes attirées par l'ordinateur, les outils numériques, le web, le support technique ou la data.",
    descriptionKey: "boussole.branches.DIGITAL_IT.description",
    possibleJobs: [
      "Support IT",
      "Développeur débutant",
      "Assistant digital",
      "Web designer",
      "Data assistant",
      "Community manager",
    ],
    possibleJobsKeys: [
      "boussole.branches.DIGITAL_IT.jobs.0",
      "boussole.branches.DIGITAL_IT.jobs.1",
      "boussole.branches.DIGITAL_IT.jobs.2",
      "boussole.branches.DIGITAL_IT.jobs.3",
      "boussole.branches.DIGITAL_IT.jobs.4",
      "boussole.branches.DIGITAL_IT.jobs.5",
    ],
    icon: "MonitorSmartphone",
    color: "#0EA5E9",
    order: 3,
  },
  {
    key: "TECHNICAL_MANUAL",
    slug: "technique-manuel",
    name: "Technique & manuel",
    nameKey: "boussole.branches.TECHNICAL_MANUAL.name",
    description:
      "Pour les personnes qui aiment réparer, construire, manipuler, produire ou travailler avec des outils.",
    descriptionKey: "boussole.branches.TECHNICAL_MANUAL.description",
    possibleJobs: [
      "Technicien",
      "Électricien",
      "Maintenance",
      "Bâtiment",
      "Mécanique",
      "Ouvrier qualifié",
    ],
    possibleJobsKeys: [
      "boussole.branches.TECHNICAL_MANUAL.jobs.0",
      "boussole.branches.TECHNICAL_MANUAL.jobs.1",
      "boussole.branches.TECHNICAL_MANUAL.jobs.2",
      "boussole.branches.TECHNICAL_MANUAL.jobs.3",
      "boussole.branches.TECHNICAL_MANUAL.jobs.4",
      "boussole.branches.TECHNICAL_MANUAL.jobs.5",
    ],
    icon: "Wrench",
    color: "#F97316",
    order: 4,
  },
  {
    key: "LOGISTICS_TRANSPORT",
    slug: "logistique-transport",
    name: "Logistique & transport",
    nameKey: "boussole.branches.LOGISTICS_TRANSPORT.name",
    description:
      "Pour les personnes qui aiment bouger, organiser, préparer, livrer ou gérer des flux.",
    descriptionKey: "boussole.branches.LOGISTICS_TRANSPORT.description",
    possibleJobs: [
      "Magasinier",
      "Préparateur de commandes",
      "Chauffeur",
      "Dispatcher",
      "Gestionnaire logistique",
    ],
    possibleJobsKeys: [
      "boussole.branches.LOGISTICS_TRANSPORT.jobs.0",
      "boussole.branches.LOGISTICS_TRANSPORT.jobs.1",
      "boussole.branches.LOGISTICS_TRANSPORT.jobs.2",
      "boussole.branches.LOGISTICS_TRANSPORT.jobs.3",
      "boussole.branches.LOGISTICS_TRANSPORT.jobs.4",
    ],
    icon: "Truck",
    color: "#16A34A",
    order: 5,
  },
  {
    key: "SALES_CUSTOMER",
    slug: "commerce-relation-client",
    name: "Commerce & relation client",
    nameKey: "boussole.branches.SALES_CUSTOMER.name",
    description:
      "Pour les personnes à l'aise avec les échanges, la vente, l'accueil ou le conseil.",
    descriptionKey: "boussole.branches.SALES_CUSTOMER.description",
    possibleJobs: [
      "Vendeur",
      "Conseiller client",
      "Commercial",
      "Chargé d'accueil",
      "Téléconseiller",
    ],
    possibleJobsKeys: [
      "boussole.branches.SALES_CUSTOMER.jobs.0",
      "boussole.branches.SALES_CUSTOMER.jobs.1",
      "boussole.branches.SALES_CUSTOMER.jobs.2",
      "boussole.branches.SALES_CUSTOMER.jobs.3",
      "boussole.branches.SALES_CUSTOMER.jobs.4",
    ],
    icon: "ShoppingBag",
    color: "#DB2777",
    order: 6,
  },
  {
    key: "HEALTH_WELLBEING",
    slug: "sante-bien-etre",
    name: "Santé & bien-être",
    nameKey: "boussole.branches.HEALTH_WELLBEING.name",
    description:
      "Pour les personnes qui veulent prendre soin des autres, travailler dans l'aide, la santé ou le bien-être.",
    descriptionKey: "boussole.branches.HEALTH_WELLBEING.description",
    possibleJobs: [
      "Aide-soignant",
      "Aide à domicile",
      "Assistant médical",
      "Accueil médical",
      "Métiers du bien-être",
    ],
    possibleJobsKeys: [
      "boussole.branches.HEALTH_WELLBEING.jobs.0",
      "boussole.branches.HEALTH_WELLBEING.jobs.1",
      "boussole.branches.HEALTH_WELLBEING.jobs.2",
      "boussole.branches.HEALTH_WELLBEING.jobs.3",
      "boussole.branches.HEALTH_WELLBEING.jobs.4",
    ],
    icon: "Stethoscope",
    color: "#DC2626",
    order: 7,
  },
  {
    key: "ENTREPRENEURSHIP",
    slug: "entrepreneuriat",
    name: "Entrepreneuriat",
    nameKey: "boussole.branches.ENTREPRENEURSHIP.name",
    description:
      "Pour les personnes qui veulent créer leur activité, devenir indépendant ou construire un projet personnel.",
    descriptionKey: "boussole.branches.ENTREPRENEURSHIP.description",
    possibleJobs: [
      "Indépendant",
      "Activité complémentaire",
      "E-commerce",
      "Prestation de service",
      "Création de SRL",
      "Projet entrepreneurial",
    ],
    possibleJobsKeys: [
      "boussole.branches.ENTREPRENEURSHIP.jobs.0",
      "boussole.branches.ENTREPRENEURSHIP.jobs.1",
      "boussole.branches.ENTREPRENEURSHIP.jobs.2",
      "boussole.branches.ENTREPRENEURSHIP.jobs.3",
      "boussole.branches.ENTREPRENEURSHIP.jobs.4",
      "boussole.branches.ENTREPRENEURSHIP.jobs.5",
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
