import {
  BabyIcon,
  BriefcaseIcon,
  CarIcon,
  HomeIcon,
  LifeBuoyIcon,
  type LucideIcon,
  PercentIcon,
} from "lucide-react";
import { type Tool, getToolSlug } from "@/lib/docbel-data";

export interface ToolDomain {
  id: string;
  label: string;
  Icon: LucideIcon;
  hue: string;
}

/**
 * Taxonomie "domaines de vie" affichée sur /outils (maquette). Elle n'existe
 * PAS en base (aucune colonne/enum `Tool.category` pour ces libellés) : c'est
 * un mapping de PRÉSENTATION calculé en code. Les comptes affichés sont donc
 * RÉELS (dérivés du catalogue effectif), pas les chiffres fictifs de la
 * maquette. Si tu ajoutes un outil, mappe son slug ci-dessous.
 */
export const TOOL_DOMAINS: ToolDomain[] = [
  { id: "travail", label: "Travail & Emploi", Icon: BriefcaseIcon, hue: "#8B5CF6" },
  { id: "famille", label: "Famille & Enfants", Icon: BabyIcon, hue: "#EC4899" },
  { id: "fiscalite", label: "Fiscalité & Impôts", Icon: PercentIcon, hue: "#10B981" },
  { id: "logement", label: "Logement & Énergie", Icon: HomeIcon, hue: "#F59E0B" },
  { id: "social", label: "Social & Aides", Icon: LifeBuoyIcon, hue: "#3B82F6" },
  { id: "mobilite", label: "Mobilité & Transports", Icon: CarIcon, hue: "#06B6D4" },
];

export const DOMAIN_BY_ID: Record<string, ToolDomain> = Object.fromEntries(
  TOOL_DOMAINS.map((d) => [d.id, d]),
);

const DOMAIN_BY_SLUG: Record<string, string> = {
  preavis: "travail",
  "brut-net": "travail",
  "pecule-vacances": "travail",
  "allocations-chomage": "travail",
  "indemnite-rupture": "travail",
  "commissions-paritaires": "travail",
  u1: "travail",
  "allocations-familiales": "famille",
  "ipp-simulateur": "fiscalite",
  "tarif-social-energie": "logement",
  bureaux: "social",
  "pension-estimation": "social",
  "frais-kilometriques": "mobilite",
};

// Repli par `type` si le slug est inconnu (catalogue qui évolue).
const DOMAIN_BY_TYPE: Record<string, string> = {
  calc_ipp: "fiscalite",
  calc_km: "mobilite",
  calc_tarif_social: "logement",
  calc_allocs_fam: "famille",
  locator: "social",
};

/** Domaine de vie d'un outil, ou null si non classé (n'apparaît sous aucune tuile). */
export function domainForTool(tool: Tool): string | null {
  return DOMAIN_BY_SLUG[getToolSlug(tool)] ?? DOMAIN_BY_TYPE[tool.type] ?? null;
}

/** Compte réel d'outils par domaine, dérivé du catalogue passé. */
export function countByDomain(tools: Tool[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tool of tools) {
    const id = domainForTool(tool);
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}
