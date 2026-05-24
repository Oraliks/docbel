import type { LucideIcon } from "lucide-react";
import {
  // Icônes communes aux sections methodology
  FileCode2,
  Calendar,
  Calculator,
  Clock,
  Users,
  Euro,
  Baby,
  Gift,
  MapPin,
  ListChecks,
  AlertTriangle,
  Sparkles,
  Wrench,
  FileText,
  Image as ImageIcon,
  Link2,
  Info,
  CheckCircle2,
  ExternalLink,
  ArrowLeft,
  Building2,
  Tag,
  Hash,
  HelpCircle,
  Settings,
  Activity,
} from "lucide-react";

/**
 * Mapping interne nom → composant lucide-react pour les sections methodology.
 * Étendre ici quand un nouveau briefMeta/inputsDetailed.icon est utilisé.
 *
 * Volontairement séparé du `lib/lucide-icons-catalog.ts` (qui gère les icônes
 * « outils publics » du picker admin). Ici on n'expose pas de keywords —
 * c'est juste un dictionnaire interne pour les nouvelles sections.
 */
const SECTION_ICONS: Record<string, LucideIcon> = {
  FileCode2,
  Calendar,
  Calculator,
  Clock,
  Users,
  Euro,
  Baby,
  Gift,
  MapPin,
  ListChecks,
  AlertTriangle,
  Sparkles,
  Wrench,
  FileText,
  Image: ImageIcon,
  Link2,
  Info,
  CheckCircle2,
  ExternalLink,
  ArrowLeft,
  Building2,
  Tag,
  Hash,
  HelpCircle,
  Settings,
  Activity,
};

/**
 * Renvoie le composant lucide-react pour un nom donné, ou `null` si non trouvé.
 * Permet aux composants de section d'afficher une icône en fallback (souvent
 * `Info` ou rien) si l'icône n'est pas reconnue.
 */
export function getSectionIcon(name: string | undefined): LucideIcon | null {
  if (!name) return null;
  return SECTION_ICONS[name] ?? null;
}
