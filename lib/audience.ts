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

/**
 * Niveau hiérarchique d'une audience (plus bas = plus permissif).
 *
 * Les outils marqués "citoyen" sont visibles par tout le monde (niveau 0).
 * "employeur" (niveau 1) restreint aux employeurs et partenaires.
 * "partenaire" (niveau 2) restreint aux seuls partenaires.
 */
const AUDIENCE_LEVEL: Record<AudienceId, number> = {
  citoyen: 0,
  employeur: 1,
  partenaire: 2,
};

/**
 * Détermine si un viewer (espace courant) peut voir un outil marqué
 * comme étant pour `toolAudience`. Règle : viewer.level >= tool.level.
 *
 * Exemple : un partenaire (level 2) peut voir un outil citoyen (level 0).
 * Un citoyen (level 0) NE peut PAS voir un outil partenaire (level 2).
 */
export function canViewAudience(
  toolAudience: AudienceId,
  viewerAudience: AudienceId,
): boolean {
  return AUDIENCE_LEVEL[viewerAudience] >= AUDIENCE_LEVEL[toolAudience];
}

/**
 * Convertit l'audience minimale d'un outil (champ DB `Tool.audience`) en
 * liste des audiences qui peuvent le voir. Compat avec `Tool.audiences`
 * (pluriel) côté `lib/docbel-data.ts`.
 *
 * citoyen → ["citoyen", "employeur", "partenaire"]
 * employeur → ["employeur", "partenaire"]
 * partenaire → ["partenaire"]
 */
export function deriveAudiences(toolAudience: AudienceId): AudienceId[] {
  const minLevel = AUDIENCE_LEVEL[toolAudience];
  return (Object.keys(AUDIENCE_LEVEL) as AudienceId[]).filter(
    (id) => AUDIENCE_LEVEL[id] >= minLevel,
  );
}

/** Garde-fou : valide qu'une string arbitraire est bien une AudienceId. */
export function isAudienceId(value: unknown): value is AudienceId {
  return value === "citoyen" || value === "employeur" || value === "partenaire";
}
