/**
 * Configuration de navigation de l'espace Dashboard pro (partenaires +
 * employeurs). Module PUR (pas d'import client) : la sidebar mappe les noms
 * d'icônes vers les composants lucide.
 */

export type ProSegment = "partenaire" | "employeur";

export type ProIcon =
  | "dashboard"
  | "calendar"
  | "search"
  | "building"
  | "users"
  | "file";

export interface ProNavItem {
  title: string;
  url: string;
  icon: ProIcon;
  /** Si vrai, l'item n'est actif que sur un match EXACT du pathname. */
  exact?: boolean;
}

export interface ProNavGroup {
  label: string;
  items: ProNavItem[];
}

export interface ProSpace {
  segment: ProSegment;
  /** Libellé affiché (badge topbar + sidebar). */
  label: string;
  /** Page d'accueil du dashboard. */
  homeUrl: string;
  groups: ProNavGroup[];
}

const PARTNER_SPACE: ProSpace = {
  segment: "partenaire",
  label: "Espace Partenaire",
  homeUrl: "/partenaire",
  groups: [
    {
      label: "Tableau de bord",
      items: [
        { title: "Vue d'ensemble", url: "/partenaire", icon: "dashboard", exact: true },
      ],
    },
    {
      label: "Outils",
      items: [
        { title: "Rendez-vous", url: "/partenaire/booking", icon: "calendar" },
        { title: "Lookup ONEM", url: "/outils/lookup-onem", icon: "search" },
      ],
    },
    {
      label: "Organisation",
      items: [
        { title: "Membres", url: "/partenaire#membres", icon: "users" },
        { title: "Domaines autorisés", url: "/partenaire#domaines", icon: "building" },
      ],
    },
  ],
};

const EMPLOYER_SPACE: ProSpace = {
  segment: "employeur",
  label: "Espace Employeur",
  homeUrl: "/employeur",
  groups: [
    {
      label: "Tableau de bord",
      items: [
        { title: "Vue d'ensemble", url: "/employeur", icon: "dashboard", exact: true },
      ],
    },
    {
      label: "Outils",
      items: [{ title: "Catalogue d'outils", url: "/outils", icon: "file" }],
    },
    {
      label: "Organisation",
      items: [
        { title: "Équipe", url: "/employeur#equipe", icon: "users" },
        { title: "Accès autorisés", url: "/employeur#acces", icon: "building" },
      ],
    },
  ],
};

export function getProSpace(segment: ProSegment): ProSpace {
  return segment === "partenaire" ? PARTNER_SPACE : EMPLOYER_SPACE;
}
