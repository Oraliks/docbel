import {
  BanknoteIcon,
  Building2Icon,
  CalculatorIcon,
  CarIcon,
  EuroIcon,
  FileTextIcon,
  type LucideIcon,
  MapPinIcon,
  PercentIcon,
  ScaleIcon,
  SearchIcon,
  ShieldIcon,
  UmbrellaIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { type Tool, getToolSlug } from "@/lib/docbel-data";

export interface ToolGlyph {
  Icon: LucideIcon;
  /** Teinte unique : sert d'icône (pleine) ET de fond (mix translucide). */
  hue: string;
}

/**
 * Icône + teinte par outil, calquées sur les maquettes (home + /outils).
 * Source de vérité PARTAGÉE entre `LandingToolsRow` (home) et le catalogue
 * /outils → un outil garde la même couleur partout. Clé = slug stable ;
 * `FALLBACK_GLYPH` pour tout outil hors liste (le catalogue peut évoluer).
 */
export const TOOL_GLYPHS: Record<string, ToolGlyph> = {
  preavis: { Icon: ScaleIcon, hue: "#F97316" },
  bureaux: { Icon: MapPinIcon, hue: "#8B5CF6" },
  "brut-net": { Icon: CalculatorIcon, hue: "#EC4899" },
  "pecule-vacances": { Icon: UmbrellaIcon, hue: "#FB923C" },
  "indemnite-rupture": { Icon: ShieldIcon, hue: "#7C3AED" },
  "pension-estimation": { Icon: EuroIcon, hue: "#10B981" },
  "allocations-familiales": { Icon: UsersIcon, hue: "#3B82F6" },
  "ipp-simulateur": { Icon: PercentIcon, hue: "#F59E0B" },
  "allocations-chomage": { Icon: BanknoteIcon, hue: "#14B8A6" },
  "tarif-social-energie": { Icon: ZapIcon, hue: "#EAB308" },
  "frais-kilometriques": { Icon: CarIcon, hue: "#06B6D4" },
  "commissions-paritaires": { Icon: Building2Icon, hue: "#6366F1" },
  u1: { Icon: FileTextIcon, hue: "#0EA5E9" },
  "lookup-onem": { Icon: SearchIcon, hue: "#7C3AED" },
};

export const FALLBACK_GLYPH: ToolGlyph = {
  Icon: FileTextIcon,
  hue: "var(--glass-accent-deep)",
};

export function glyphForTool(tool: Tool): ToolGlyph {
  return TOOL_GLYPHS[getToolSlug(tool)] ?? FALLBACK_GLYPH;
}
