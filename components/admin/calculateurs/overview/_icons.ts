import type { LucideIcon } from "lucide-react";
import {
  Calculator,
  Briefcase,
  Wallet,
  Sun,
  HandCoins,
  PiggyBank,
  Baby,
  Receipt,
  Zap,
  Car,
} from "lucide-react";

/**
 * Mapping slug calculateur → icône lucide-react pour la liste compacte
 * de la page admin /admin/chomage/outils/calculateurs.
 *
 * Une icône par slug, choisie pour évoquer immédiatement le domaine —
 * cohérente avec l'usage public quand possible (cf. catalogue d'icônes
 * Outils), mais ici uniquement pour la vue d'ensemble admin.
 *
 * Fallback : icône Calculator générique.
 */
const OVERVIEW_ICON_BY_SLUG: Record<string, LucideIcon> = {
  preavis: Briefcase,
  "brut-net": Wallet,
  "pecule-vacances": Sun,
  "allocations-chomage": HandCoins,
  "indemnite-rupture": Briefcase,
  "pension-estimation": PiggyBank,
  "allocations-familiales": Baby,
  "ipp-simulateur": Receipt,
  "tarif-social-energie": Zap,
  "frais-kilometriques": Car,
};

/** Renvoie l'icône d'overview d'un calculateur (par défaut Calculator). */
export function getOverviewIcon(slug: string): LucideIcon {
  return OVERVIEW_ICON_BY_SLUG[slug] ?? Calculator;
}
