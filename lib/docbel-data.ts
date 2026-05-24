export interface NewsItem {
  id: number | string;
  slug?: string;
  tag: string;
  title: string;
  desc: string;
  date: string;
  color: string;
  readingTime?: number;
  popular?: boolean;
  image?: string;
  content?: string;
}

import type { AudienceId } from "@/lib/audience";

export interface Tool {
  id: number;
  cat: string;
  icon: string;
  title: string;
  desc: string;
  popular: boolean;
  time: string;
  type: string;
  audiences: AudienceId[];
  /**
   * URL slug optionnel. Si absent, slug auto-dérivé depuis `title`
   * (cf. `toolSlug`). À utiliser pour fixer une URL stable, ex :
   * `/outils/bureaux` plutôt que `/outils/trouver-un-bureau-onem`.
   */
  slug?: string;
  /**
   * URL absolue/relative qui override le routage par slug `/outils/{slug}`.
   * Utile pour les outils hors de l'arborescence /outils (ex: page dédiée
   * dans /partenaire/...).
   */
  href?: string;
}

/**
 * Catalogue statique — sert à 2 usages :
 *
 * 1. Rendu de /outils/[slug] via LegacyToolView quand l'outil n'a pas de
 *    DocumentTemplate publié (calc, locator…). Doit donc contenir preavis,
 *    bureaux, et les outils statiques externes (lookup-onem partenaire).
 *
 * 2. Synthétiques pour la page /outils : entrées avec `href` absolu sont
 *    mergées avec les Tool DB actifs sur la page catalogue (cf.
 *    app/outils/page.tsx). Les entrées sans `href` qui correspondent à un
 *    slug DB sont dédupliquées (la version DB gagne).
 *
 * Si tu construis un nouvel outil "normal" routé via /outils/{slug}, crée-le
 * côté admin (table Tool) — pas ici. N'ajoute ici que les outils vraiment
 * statiques (sans backend) ou les pointeurs externes.
 */
export const TOOLS_DATA: Tool[] = [
  {
    id: 6,
    cat: "Calculs",
    icon: "Calendar",
    title: "Calculateur de préavis",
    desc:
      "Calculez votre délai de préavis légal en fonction de votre ancienneté, statut et date d'entrée en service.",
    popular: true,
    time: "2 min",
    type: "calc_preavis",
    slug: "preavis",
    audiences: ["citoyen", "employeur"],
  },
  {
    id: 12,
    cat: "Organismes",
    icon: "MapPin",
    title: "Trouver un bureau",
    desc:
      "CPAS, Commune, ONEM, organismes de paiement, syndicats : trouvez d'un coup le bureau compétent pour votre situation, partout en Belgique.",
    popular: true,
    time: "1 min",
    type: "locator",
    slug: "bureaux",
    audiences: ["citoyen", "employeur", "partenaire"],
  },
  {
    id: 30,
    cat: "Référentiels",
    icon: "Search",
    title: "Lookup ONEM",
    desc:
      "Décodage de tous les codes officiels ONEM (S01, S04, S38, Dispo, BCSS…). Recherche fuzzy multilingue FR/NL/DE/EN dans 11 000+ entrées.",
    popular: true,
    time: "instant",
    type: "lookup",
    slug: "lookup-onem",
    // Pas de `href` : on suit le pattern standard `/outils/{slug}` —
    // l'URL doit être neutre, l'auth interne à la page filtre les
    // visiteurs non autorisés (partenaire ou admin requis).
    audiences: ["partenaire"],
  },

  /* ------------------------------------------------------------------ */
  /*  Calculateurs citoyens — batch 2026-05                              */
  /*  Sans backend : logique pure dans lib/calculators/, vue dans        */
  /*  components/docbel/calculators/. Slug stable explicite.             */
  /* ------------------------------------------------------------------ */
  {
    id: 101,
    cat: "Calculs",
    icon: "Wallet",
    title: "Brut ↔ Net",
    desc:
      "Convertissez votre salaire brut en net (ou inversement) selon votre statut familial, votre région et vos avantages.",
    popular: true,
    time: "2 min",
    type: "calc_brut_net",
    slug: "brut-net",
    audiences: ["citoyen", "employeur"],
  },
  {
    id: 102,
    cat: "Calculs",
    icon: "Plane",
    title: "Pécule de vacances",
    desc:
      "Estimez votre pécule simple et double (employé ou ouvrier) en fonction de votre salaire et de votre ancienneté.",
    popular: true,
    time: "2 min",
    type: "calc_pecule",
    slug: "pecule-vacances",
    audiences: ["citoyen"],
  },
  {
    id: 103,
    cat: "Calculs",
    icon: "Coins",
    title: "Allocations de chômage",
    desc:
      "Calculez votre allocation mensuelle de chômage selon votre situation familiale, votre salaire et votre durée de chômage.",
    popular: true,
    time: "3 min",
    type: "calc_chomage",
    slug: "allocations-chomage",
    audiences: ["citoyen"],
  },
  {
    id: 104,
    cat: "Calculs",
    icon: "FileSignature",
    title: "Indemnité de rupture",
    desc:
      "Convertissez votre préavis non presté en indemnité compensatoire (€). Complément du calculateur de préavis.",
    popular: false,
    time: "2 min",
    type: "calc_indemnite",
    slug: "indemnite-rupture",
    audiences: ["citoyen", "employeur"],
  },
  {
    id: 105,
    cat: "Calculs",
    icon: "Hourglass",
    title: "Pension légale estimée",
    desc:
      "Estimation simplifiée de votre pension légale salarié selon votre carrière, votre salaire moyen et votre âge de départ.",
    popular: false,
    time: "3 min",
    type: "calc_pension",
    slug: "pension-estimation",
    audiences: ["citoyen"],
  },
  {
    id: 106,
    cat: "Calculs",
    icon: "Baby",
    title: "Allocations familiales",
    desc:
      "Calculez vos allocations familiales selon votre région (FAMIWAL, FAMIRIS, Groeipakket, Kindergeld DG) et le rang de l'enfant.",
    popular: true,
    time: "2 min",
    type: "calc_allocs_fam",
    slug: "allocations-familiales",
    audiences: ["citoyen"],
  },
  {
    id: 107,
    cat: "Calculs",
    icon: "Calculator",
    title: "Impôt des personnes physiques",
    desc:
      "Simulateur IPP simplifié : tranches d'imposition, quotité exemptée, enfants à charge et additionnels communaux.",
    popular: true,
    time: "3 min",
    type: "calc_ipp",
    slug: "ipp-simulateur",
    audiences: ["citoyen"],
  },
  {
    id: 108,
    cat: "Calculs",
    icon: "Zap",
    title: "Tarif social énergie",
    desc:
      "Vérifiez votre éligibilité au tarif social électricité/gaz et estimez votre gain par rapport au tarif standard.",
    popular: true,
    time: "2 min",
    type: "calc_tarif_social",
    slug: "tarif-social-energie",
    audiences: ["citoyen"],
  },
  {
    id: 109,
    cat: "Calculs",
    icon: "Car",
    title: "Frais kilométriques",
    desc:
      "Calculez la déduction fiscale de vos frais domicile-travail selon votre mode de transport (voiture, vélo, transports en commun).",
    popular: false,
    time: "2 min",
    type: "calc_km",
    slug: "frais-kilometriques",
    audiences: ["citoyen"],
  },
];

export function getToolsByAudience(audience: AudienceId): Tool[] {
  return TOOLS_DATA.filter((tool) => tool.audiences.includes(audience));
}

export const CATEGORIES = ["Tous", "Documents", "Calculs", "Organismes", "CPAS", "Tutoriels", "Référentiels"];

// Helper to generate URL-friendly slugs
export function toolSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function getToolBySlug(slug: string): Tool | undefined {
  return TOOLS_DATA.find((t) => (t.slug ?? toolSlug(t.title)) === slug);
}

export function getToolSlug(tool: Tool): string {
  return tool.slug ?? toolSlug(tool.title);
}

export interface ColorPalette {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  navBg: string;
  navBorder: string;
  inputBg: string;
}

// Notice Period Regimes
export const REGIMES = {
  APRES_2014: "après2014",
  AVANT_2014: "avant2014",
} as const;

// Après 2014 - Régime unifié (en semaines)
export const NOTICE_PERIODS_APRES_2014 = [
  { anMin: 0, anMax: 0.25, semaines: 2 },
  { anMin: 0.25, anMax: 0.5, semaines: 4 },
  { anMin: 0.5, anMax: 1, semaines: 4 },
  { anMin: 1, anMax: 2, semaines: 8 },
  { anMin: 2, anMax: 3, semaines: 8 },
  { anMin: 3, anMax: 4, semaines: 12 },
  { anMin: 4, anMax: 5, semaines: 12 },
  { anMin: 5, anMax: 10, semaines: 26 },
  { anMin: 10, anMax: 15, semaines: 39 },
  { anMin: 15, anMax: 20, semaines: 52 },
  { anMin: 20, anMax: Infinity, semaines: 62 },
];

// Avant 2014 - Ouvrier (en jours) - CCT 75 / Régime général
export const NOTICE_PERIODS_OUVRIER_AVANT_2014 = {
  employeur: [
    { anMin: 0, anMax: 0.5, jours: 28 },
    { anMin: 0.5, anMax: 5, jours: 40 },
    { anMin: 5, anMax: 10, jours: 48 },
    { anMin: 10, anMax: 15, jours: 64 },
    { anMin: 15, anMax: 20, jours: 97 },
    { anMin: 20, anMax: Infinity, jours: 129 },
  ],
  travailleur: [
    { anMin: 0, anMax: 0.5, jours: 14 },
    { anMin: 0.5, anMax: 5, jours: 14 },
    { anMin: 5, anMax: 10, jours: 14 },
    { anMin: 10, anMax: 15, jours: 14 },
    { anMin: 15, anMax: 20, jours: 14 },
    { anMin: 20, anMax: Infinity, jours: 28 },
  ],
};

// Avant 2014 - Employé (par salaire annuel brut en €)
export const NOTICE_PERIODS_EMPLOYE_AVANT_2014 = {
  employeur: {
    salaireMax32254: { moisMin: 0.25, moisPerAn: 0.25 },
    salaire32254a64508: { moisMin: 1, moisPerAn: 1 },
    salaireMax64508: { moisMin: 1, moisPerAn: 1 },
  },
  travailleur: {
    salaireMax32254: { moisMin: 0.5, moisPerAn: 0.5 },
    salaire32254a64508: { moisMin: 2, moisPerAn: 2 },
    salaireMax64508: { moisMin: 2, moisPerAn: 2 },
  },
};
