import {
  Building2Icon,
  HandshakeIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";

export type AudienceId = "citoyen" | "employeur" | "partenaire";

export interface Audience {
  id: AudienceId;
  label: string;
  description: string;
  Icon: LucideIcon;
  path: string;
  dotClass: string;
  iconBgClass: string;
  logoMarkClass: string;
}

export const AUDIENCES: readonly Audience[] = [
  {
    id: "citoyen",
    label: "Espace Citoyen",
    description: "Outils publics et demarches",
    Icon: UserIcon,
    path: "/",
    dotClass: "bg-violet-400",
    iconBgClass:
      "bg-violet-100 text-violet-500 dark:bg-violet-500/10 dark:text-violet-300",
    logoMarkClass: "bg-violet-400 text-white",
  },
  {
    id: "employeur",
    label: "Espace Employeur",
    description: "Gestion RH et attestations",
    Icon: Building2Icon,
    path: "/employeur",
    dotClass: "bg-violet-800",
    iconBgClass:
      "bg-violet-200 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
    logoMarkClass: "bg-violet-800 text-white",
  },
  {
    id: "partenaire",
    label: "Espace Partenaire",
    description: "CPAS, syndicats, mutuelles",
    Icon: HandshakeIcon,
    path: "/partenaire",
    dotClass: "bg-violet-600",
    iconBgClass:
      "bg-gradient-to-br from-violet-200 to-violet-500 text-white dark:from-violet-500/30 dark:to-violet-800/40 dark:text-violet-100",
    logoMarkClass:
      "bg-gradient-to-br from-violet-300 via-violet-500 to-violet-900 text-white shadow-[0_0_0_1px_rgba(124,58,237,0.15)]",
  },
] as const;

export function getAudienceFromPath(pathname: string): AudienceId {
  if (pathname.startsWith("/employeur")) return "employeur";
  if (pathname.startsWith("/partenaire")) return "partenaire";
  return "citoyen";
}

export function getAudience(id: AudienceId): Audience {
  return AUDIENCES.find((aud) => aud.id === id) ?? AUDIENCES[0];
}
