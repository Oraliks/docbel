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
  | "file"
  | "plus"
  | "folder"
  | "calculator"
  | "shield"
  | "book"
  | "graduate"
  | "document";

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
      label: "Rendez-vous",
      items: [
        { title: "Agenda & demandes", url: "/partenaire/booking", icon: "calendar" },
      ],
    },
    {
      label: "Outils",
      items: [
        { title: "Lookup ONEM", url: "/outils/lookup-onem", icon: "search" },
        { title: "Calcul AGR", url: "/partenaire/outils/calcul-agr", icon: "file" },
        { title: "Réglementation chômage", url: "/partenaire/reglementation", icon: "book" },
      ],
    },
    {
      label: "Formations",
      items: [
        { title: "Mes formations", url: "/partenaire/formations", icon: "graduate" },
        { title: "Créer une formation", url: "/partenaire/formations/nouvelle", icon: "plus" },
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
      label: "Engagements",
      items: [
        { title: "Nouveau dossier", url: "/employeur/nouveau-dossier", icon: "plus" },
        { title: "Mes dossiers", url: "/employeur/dossiers", icon: "folder" },
        { title: "Générer un contrat", url: "/employeur/contrats", icon: "document" },
      ],
    },
    {
      label: "Agenda",
      items: [
        { title: "Calendrier social", url: "/employeur/calendrier", icon: "calendar" },
      ],
    },
    {
      label: "Outils",
      items: [
        { title: "Simulateur de coût", url: "/employeur/simulateur-cout", icon: "calculator" },
        { title: "Vérifier une fiche", url: "/employeur/controle", icon: "shield" },
      ],
    },
    {
      label: "Formations",
      items: [
        { title: "Mes formations", url: "/employeur/formations", icon: "graduate" },
        { title: "Créer une formation", url: "/employeur/formations/nouvelle", icon: "plus" },
      ],
    },
    {
      label: "Ressources",
      items: [
        { title: "Bibliothèque", url: "/employeur/bibliotheque", icon: "book" },
        { title: "Documents", url: "/employeur/documents", icon: "document" },
      ],
    },
  ],
};

export function getProSpace(segment: ProSegment): ProSpace {
  return segment === "partenaire" ? PARTNER_SPACE : EMPLOYER_SPACE;
}
