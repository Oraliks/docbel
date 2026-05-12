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
}

export const TOOLS_DATA: Tool[] = [
  { id: 1, cat: "Documents", icon: "📄", title: "Formulaire C4", desc: "Générez votre certificat de chômage C4 (attestation de fin de contrat délivrée par l'employeur).", popular: true, time: "5 min", type: "form", audiences: ["citoyen", "employeur"] },
  { id: 2, cat: "Documents", icon: "📝", title: "Formulaire C1", desc: "Demande d'allocations de chômage à introduire auprès de votre organisme de paiement.", popular: true, time: "8 min", type: "form", audiences: ["citoyen"] },
  { id: 3, cat: "Documents", icon: "⏸️", title: "Chômage temporaire", desc: "Déclaration de chômage temporaire pour force majeure ou raisons économiques (formulaire C3.2).", popular: false, time: "4 min", type: "form", audiences: ["citoyen", "employeur"] },
  { id: 6, cat: "Calculs", icon: "🧮", title: "Calculateur de préavis", desc: "Calculez votre délai de préavis légal en fonction de votre ancienneté, statut et date d'entrée en service.", popular: true, time: "2 min", type: "calc_preavis", audiences: ["citoyen", "employeur"] },
  { id: 7, cat: "Calculs", icon: "💶", title: "Calcul AGR", desc: "Estimez votre Allocation de Garantie de Revenu (AGR) pour les travailleurs à temps partiel involontaire.", popular: true, time: "3 min", type: "calc_agr", audiences: ["citoyen"] },
  { id: 8, cat: "Calculs", icon: "💼", title: "Salaire minimum par CP", desc: "Consultez le salaire minimum garanti par commission paritaire (CP) pour votre secteur d'activité.", popular: false, time: "1 min", type: "calc_cp", audiences: ["citoyen", "employeur", "partenaire"] },
  { id: 12, cat: "Organismes", icon: "🗺️", title: "Trouver un bureau", desc: "CPAS, Commune, ONEM, organismes de paiement, syndicats : trouvez d'un coup le bureau compétent pour votre situation, partout en Belgique.", popular: true, time: "1 min", type: "locator", slug: "bureaux", audiences: ["citoyen", "employeur", "partenaire"] },
  { id: 19, cat: "CPAS", icon: "🏠", title: "Demande d'aide sociale", desc: "Formulaire de demande d'aide sociale (revenu d'intégration sociale) auprès du CPAS de votre commune.", popular: true, time: "10 min", type: "form", audiences: ["citoyen", "partenaire"] },
  { id: 23, cat: "Tutoriels", icon: "🃏", title: "Envoyer sa carte électronique C", desc: "Guide pas à pas pour envoyer votre carte de contrôle C via MyONEM ou chez votre organisme de paiement.", popular: true, time: "3 min", type: "tutorial", audiences: ["citoyen"] },
];

export function getToolsByAudience(audience: AudienceId): Tool[] {
  return TOOLS_DATA.filter((tool) => tool.audiences.includes(audience));
}

export const CATEGORIES = ["Tous", "Documents", "Calculs", "Organismes", "CPAS", "Tutoriels"];

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
