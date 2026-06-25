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
  keyTakeaway?: string;
  summary?: string[];
  linkedDocs?: { title: string; url: string }[];
  faqs?: { q: string; a: string }[];
  heroIllustration?: string;
}

import type { AudienceId } from "@/lib/audience";

export interface Tool {
  id: number;
  cat: string;
  /** Clé i18n optionnelle pour `cat` (namespace `public.docbelData.tools.{KEY}.cat` ou `public.docbelData.categories.{CAT}`). */
  catKey?: string;
  icon: string;
  title: string;
  /** Clé i18n optionnelle pour `title` (namespace `public.docbelData.tools.{KEY}.title`). */
  titleKey?: string;
  desc: string;
  /** Clé i18n optionnelle pour `desc` (namespace `public.docbelData.tools.{KEY}.desc`). */
  descKey?: string;
  popular: boolean;
  time: string;
  /** Clé i18n optionnelle pour `time` (namespace `public.docbelData.tools.{KEY}.time`). */
  timeKey?: string;
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
  /**
   * Date de création ISO — présente pour les outils issus de la DB uniquement
   * (les entrées statiques n'en ont pas). Sert au tri "récemment ajoutés".
   */
  createdAt?: string;
}

/**
 * Catalogue statique — sert à 2 usages :
 *
 * 1. Rendu de /outils/[slug] via LegacyToolView pour les calculateurs et
 *    outils statiques (calc, locator, bureaux, lookup-onem partenaire).
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
    catKey: "public.docbelData.tools.tool6.cat",
    icon: "Calendar",
    title: "Calculateur de préavis",
    titleKey: "public.docbelData.tools.tool6.title",
    desc:
      "Calculez votre délai de préavis légal en fonction de votre ancienneté, statut et date d'entrée en service.",
    descKey: "public.docbelData.tools.tool6.desc",
    popular: true,
    time: "2 min",
    timeKey: "public.docbelData.tools.tool6.time",
    type: "calc_preavis",
    slug: "preavis",
    audiences: ["citoyen", "employeur"],
  },
  {
    id: 12,
    cat: "Organismes",
    catKey: "public.docbelData.tools.tool12.cat",
    icon: "MapPin",
    title: "Trouver un bureau",
    titleKey: "public.docbelData.tools.tool12.title",
    desc:
      "CPAS, Commune, ONEM, organismes de paiement, syndicats : trouvez d'un coup le bureau compétent pour votre situation, partout en Belgique.",
    descKey: "public.docbelData.tools.tool12.desc",
    popular: true,
    time: "1 min",
    timeKey: "public.docbelData.tools.tool12.time",
    type: "locator",
    slug: "bureaux",
    audiences: ["citoyen", "employeur", "partenaire"],
  },
  {
    id: 30,
    cat: "Référentiels",
    catKey: "public.docbelData.tools.tool30.cat",
    icon: "Search",
    title: "Lookup ONEM",
    titleKey: "public.docbelData.tools.tool30.title",
    desc:
      "Décodage de tous les codes officiels ONEM (S01, S04, S38, Dispo, BCSS…). Recherche fuzzy multilingue FR/NL/DE/EN dans 11 000+ entrées.",
    descKey: "public.docbelData.tools.tool30.desc",
    popular: true,
    time: "instant",
    timeKey: "public.docbelData.tools.tool30.time",
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
    catKey: "public.docbelData.tools.tool101.cat",
    icon: "Wallet",
    title: "Brut ↔ Net",
    titleKey: "public.docbelData.tools.tool101.title",
    desc:
      "Convertissez votre salaire brut en net (ou inversement) selon votre statut familial, votre région et vos avantages.",
    descKey: "public.docbelData.tools.tool101.desc",
    popular: true,
    time: "2 min",
    timeKey: "public.docbelData.tools.tool101.time",
    type: "calc_brut_net",
    slug: "brut-net",
    audiences: ["citoyen", "employeur"],
  },
  {
    id: 102,
    cat: "Calculs",
    catKey: "public.docbelData.tools.tool102.cat",
    icon: "Plane",
    title: "Pécule de vacances",
    titleKey: "public.docbelData.tools.tool102.title",
    desc:
      "Estimez votre pécule simple et double (employé ou ouvrier) en fonction de votre salaire et de votre ancienneté.",
    descKey: "public.docbelData.tools.tool102.desc",
    popular: true,
    time: "2 min",
    timeKey: "public.docbelData.tools.tool102.time",
    type: "calc_pecule",
    slug: "pecule-vacances",
    audiences: ["citoyen"],
  },
  {
    id: 103,
    cat: "Calculs",
    catKey: "public.docbelData.tools.tool103.cat",
    icon: "Coins",
    title: "Allocations de chômage",
    titleKey: "public.docbelData.tools.tool103.title",
    desc:
      "Calculez votre allocation mensuelle de chômage selon votre situation familiale, votre salaire et votre durée de chômage.",
    descKey: "public.docbelData.tools.tool103.desc",
    popular: true,
    time: "3 min",
    timeKey: "public.docbelData.tools.tool103.time",
    type: "calc_chomage",
    slug: "allocations-chomage",
    audiences: ["citoyen"],
  },
  {
    id: 104,
    cat: "Calculs",
    catKey: "public.docbelData.tools.tool104.cat",
    icon: "FileSignature",
    title: "Indemnité de rupture",
    titleKey: "public.docbelData.tools.tool104.title",
    desc:
      "Convertissez votre préavis non presté en indemnité compensatoire (€). Complément du calculateur de préavis.",
    descKey: "public.docbelData.tools.tool104.desc",
    popular: false,
    time: "2 min",
    timeKey: "public.docbelData.tools.tool104.time",
    type: "calc_indemnite",
    slug: "indemnite-rupture",
    audiences: ["citoyen", "employeur"],
  },
  {
    id: 105,
    cat: "Calculs",
    catKey: "public.docbelData.tools.tool105.cat",
    icon: "Hourglass",
    title: "Pension légale estimée",
    titleKey: "public.docbelData.tools.tool105.title",
    desc:
      "Estimation simplifiée de votre pension légale salarié selon votre carrière, votre salaire moyen et votre âge de départ.",
    descKey: "public.docbelData.tools.tool105.desc",
    popular: false,
    time: "3 min",
    timeKey: "public.docbelData.tools.tool105.time",
    type: "calc_pension",
    slug: "pension-estimation",
    audiences: ["citoyen"],
  },
  {
    id: 106,
    cat: "Calculs",
    catKey: "public.docbelData.tools.tool106.cat",
    icon: "Baby",
    title: "Allocations familiales",
    titleKey: "public.docbelData.tools.tool106.title",
    desc:
      "Calculez vos allocations familiales selon votre région (FAMIWAL, FAMIRIS, Groeipakket, Kindergeld DG) et le rang de l'enfant.",
    descKey: "public.docbelData.tools.tool106.desc",
    popular: true,
    time: "2 min",
    timeKey: "public.docbelData.tools.tool106.time",
    type: "calc_allocs_fam",
    slug: "allocations-familiales",
    audiences: ["citoyen"],
  },
  {
    id: 107,
    cat: "Calculs",
    catKey: "public.docbelData.tools.tool107.cat",
    icon: "Calculator",
    title: "Impôt des personnes physiques",
    titleKey: "public.docbelData.tools.tool107.title",
    desc:
      "Simulateur IPP simplifié : tranches d'imposition, quotité exemptée, enfants à charge et additionnels communaux.",
    descKey: "public.docbelData.tools.tool107.desc",
    popular: true,
    time: "3 min",
    timeKey: "public.docbelData.tools.tool107.time",
    type: "calc_ipp",
    slug: "ipp-simulateur",
    audiences: ["citoyen"],
  },
  {
    id: 108,
    cat: "Calculs",
    catKey: "public.docbelData.tools.tool108.cat",
    icon: "Zap",
    title: "Tarif social énergie",
    titleKey: "public.docbelData.tools.tool108.title",
    desc:
      "Vérifiez votre éligibilité au tarif social électricité/gaz et estimez votre gain par rapport au tarif standard.",
    descKey: "public.docbelData.tools.tool108.desc",
    popular: true,
    time: "2 min",
    timeKey: "public.docbelData.tools.tool108.time",
    type: "calc_tarif_social",
    slug: "tarif-social-energie",
    audiences: ["citoyen"],
  },
  {
    id: 109,
    cat: "Calculs",
    catKey: "public.docbelData.tools.tool109.cat",
    icon: "Car",
    title: "Frais kilométriques",
    titleKey: "public.docbelData.tools.tool109.title",
    desc:
      "Calculez la déduction fiscale de vos frais domicile-travail selon votre mode de transport (voiture, vélo, transports en commun).",
    descKey: "public.docbelData.tools.tool109.desc",
    popular: false,
    time: "2 min",
    timeKey: "public.docbelData.tools.tool109.time",
    type: "calc_km",
    slug: "frais-kilometriques",
    audiences: ["citoyen"],
  },
];

export function getToolsByAudience(audience: AudienceId): Tool[] {
  return TOOLS_DATA.filter((tool) => tool.audiences.includes(audience));
}

export const CATEGORIES = ["Tous", "Documents", "Calculs", "Organismes", "CPAS", "Tutoriels", "Référentiels"];

/**
 * Mapping des libellés `CATEGORIES` (FR) vers leurs clés i18n
 * (`public.docbelData.categories.*`). Les consommateurs qui veulent
 * afficher les catégories localisées résolvent `CATEGORY_KEYS[label]`
 * via `useTranslations` ; FR reste le fallback par défaut.
 */
export const CATEGORY_KEYS: Readonly<Record<string, string>> = {
  Tous: "public.docbelData.categories.Tous",
  Documents: "public.docbelData.categories.Documents",
  Calculs: "public.docbelData.categories.Calculs",
  Organismes: "public.docbelData.categories.Organismes",
  CPAS: "public.docbelData.categories.CPAS",
  Tutoriels: "public.docbelData.categories.Tutoriels",
  "Référentiels": "public.docbelData.categories.Referentiels",
};

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
