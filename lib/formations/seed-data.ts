/**
 * Données de référence V1 du module Formations : catégories (15), tags (~25),
 * badges (officiels + dérivés) et la table de correspondance branche Boussole →
 * catégories/tags (pour recommander des formations après le test). Isomorphe :
 * source de vérité pour le seed ET pour les recommandations côté queries.
 */
import type { BranchKey } from "./boussole/branches";

export interface CategorySeed {
  slug: string;
  name: string;
  icon: string;
  color: string;
  order: number;
}

export const CATEGORIES: CategorySeed[] = [
  { slug: "administratif", name: "Administratif", icon: "FileText", color: "#7C3AED", order: 1 },
  { slug: "social", name: "Social", icon: "HeartHandshake", color: "#2563EB", order: 2 },
  { slug: "numerique", name: "Numérique", icon: "MonitorSmartphone", color: "#0EA5E9", order: 3 },
  { slug: "technique", name: "Technique", icon: "Wrench", color: "#F97316", order: 4 },
  { slug: "logistique", name: "Logistique", icon: "Truck", color: "#16A34A", order: 5 },
  { slug: "commerce", name: "Commerce", icon: "ShoppingBag", color: "#DB2777", order: 6 },
  { slug: "sante", name: "Santé", icon: "Stethoscope", color: "#DC2626", order: 7 },
  { slug: "entrepreneuriat", name: "Entrepreneuriat", icon: "Rocket", color: "#9333EA", order: 8 },
  { slug: "langues", name: "Langues", icon: "Languages", color: "#0891B2", order: 9 },
  { slug: "bureautique", name: "Bureautique", icon: "Keyboard", color: "#6366F1", order: 10 },
  { slug: "droit-social", name: "Droit social", icon: "Scale", color: "#7C3AED", order: 11 },
  { slug: "emploi", name: "Emploi", icon: "Briefcase", color: "#2563EB", order: 12 },
  { slug: "rh", name: "RH", icon: "Users", color: "#DB2777", order: 13 },
  { slug: "comptabilite", name: "Comptabilité", icon: "Calculator", color: "#16A34A", order: 14 },
  { slug: "securite-travail", name: "Sécurité au travail", icon: "HardHat", color: "#F59E0B", order: 15 },
];

export interface TagSeed {
  slug: string;
  name: string;
  type: string;
  isOrientationTag: boolean;
}

export const TAGS: TagSeed[] = [
  { slug: "gratuit", name: "Gratuit", type: "prix", isOrientationTag: false },
  { slug: "payant", name: "Payant", type: "prix", isOrientationTag: false },
  { slug: "debutant-accepte", name: "Débutant accepté", type: "niveau", isOrientationTag: true },
  { slug: "sans-prerequis", name: "Sans prérequis", type: "niveau", isOrientationTag: false },
  { slug: "formation-courte", name: "Formation courte", type: "duree", isOrientationTag: true },
  { slug: "formation-longue", name: "Formation longue", type: "duree", isOrientationTag: true },
  { slug: "en-ligne", name: "En ligne", type: "format", isOrientationTag: false },
  { slug: "presentiel", name: "Présentiel", type: "format", isOrientationTag: false },
  { slug: "hybride", name: "Hybride", type: "format", isOrientationTag: false },
  { slug: "certifiant", name: "Certifiant", type: "certification", isOrientationTag: false },
  { slug: "attestation", name: "Attestation", type: "certification", isOrientationTag: false },
  { slug: "reconversion", name: "Reconversion", type: "public", isOrientationTag: true },
  { slug: "demandeur-emploi", name: "Demandeur d'emploi", type: "public", isOrientationTag: false },
  { slug: "travailleur", name: "Travailleur", type: "public", isOrientationTag: false },
  { slug: "employeur", name: "Employeur", type: "public", isOrientationTag: false },
  { slug: "partenaire", name: "Partenaire", type: "public", isOrientationTag: false },
  { slug: "independant", name: "Indépendant", type: "public", isOrientationTag: true },
  { slug: "soft-skills", name: "Soft skills", type: "thematique", isOrientationTag: false },
  { slug: "metier-manuel", name: "Métier manuel", type: "orientation", isOrientationTag: true },
  { slug: "metier-de-bureau", name: "Métier de bureau", type: "orientation", isOrientationTag: true },
  { slug: "contact-humain", name: "Contact humain", type: "orientation", isOrientationTag: true },
  { slug: "travail-autonome", name: "Travail autonome", type: "orientation", isOrientationTag: true },
  { slug: "ordinateur-requis", name: "Ordinateur requis", type: "orientation", isOrientationTag: true },
  { slug: "remise-a-niveau", name: "Remise à niveau", type: "orientation", isOrientationTag: true },
  { slug: "stabilite-professionnelle", name: "Stabilité professionnelle", type: "orientation", isOrientationTag: true },
];

export interface BadgeSeed {
  slug: string;
  name: string;
  /** Officiel : seul l'admin peut l'attribuer. */
  controlledByAdmin: boolean;
  icon: string;
  color: string;
  order: number;
}

export const BADGES: BadgeSeed[] = [
  { slug: "partenaire-verifie", name: "Partenaire vérifié", controlledByAdmin: true, icon: "BadgeCheck", color: "#2563EB", order: 1 },
  { slug: "validee-docbel", name: "Formation validée par Docbel", controlledByAdmin: true, icon: "ShieldCheck", color: "#7C3AED", order: 2 },
  { slug: "recommandee-docbel", name: "Recommandée Docbel", controlledByAdmin: true, icon: "Sparkles", color: "#9333EA", order: 3 },
  { slug: "gratuit", name: "Gratuit", controlledByAdmin: false, icon: "Gift", color: "#16A34A", order: 4 },
  { slug: "payant", name: "Payant", controlledByAdmin: false, icon: "Euro", color: "#6B7280", order: 5 },
  { slug: "certifiante", name: "Certifiante", controlledByAdmin: false, icon: "Award", color: "#F59E0B", order: 6 },
  { slug: "attestation", name: "Attestation disponible", controlledByAdmin: false, icon: "FileCheck", color: "#0EA5E9", order: 7 },
  { slug: "debutant-accepte", name: "Débutant accepté", controlledByAdmin: false, icon: "Sprout", color: "#16A34A", order: 8 },
  { slug: "places-limitees", name: "Places limitées", controlledByAdmin: false, icon: "Users", color: "#DC2626", order: 9 },
  { slug: "en-ligne", name: "En ligne", controlledByAdmin: false, icon: "Globe", color: "#0EA5E9", order: 10 },
  { slug: "presentiel", name: "Présentiel", controlledByAdmin: false, icon: "MapPin", color: "#F97316", order: 11 },
  { slug: "formation-interne", name: "Formation interne", controlledByAdmin: false, icon: "Lock", color: "#6B7280", order: 12 },
  { slug: "formation-privee", name: "Formation privée", controlledByAdmin: false, icon: "EyeOff", color: "#6B7280", order: 13 },
  { slug: "formation-courte", name: "Formation courte", controlledByAdmin: false, icon: "Clock", color: "#2563EB", order: 14 },
  { slug: "nouvelle-formation", name: "Nouvelle formation", controlledByAdmin: false, icon: "Star", color: "#9333EA", order: 15 },
];

/**
 * Correspondance branche Boussole → catégories + tags d'orientation, pour
 * recommander des formations après le test (cf. lib/formations/queries.ts).
 */
export const BRANCH_RECOMMENDATION: Record<
  BranchKey,
  { categorySlugs: string[]; tagSlugs: string[] }
> = {
  ADMINISTRATIVE_OFFICE: {
    categorySlugs: ["administratif", "bureautique", "rh", "comptabilite"],
    tagSlugs: ["metier-de-bureau", "ordinateur-requis"],
  },
  SOCIAL_CARE: {
    categorySlugs: ["social", "emploi"],
    tagSlugs: ["contact-humain"],
  },
  DIGITAL_IT: {
    categorySlugs: ["numerique", "bureautique"],
    tagSlugs: ["ordinateur-requis", "travail-autonome"],
  },
  TECHNICAL_MANUAL: {
    categorySlugs: ["technique", "securite-travail"],
    tagSlugs: ["metier-manuel"],
  },
  LOGISTICS_TRANSPORT: {
    categorySlugs: ["logistique", "securite-travail"],
    tagSlugs: ["metier-manuel"],
  },
  SALES_CUSTOMER: {
    categorySlugs: ["commerce", "langues"],
    tagSlugs: ["contact-humain"],
  },
  HEALTH_WELLBEING: {
    categorySlugs: ["sante", "social"],
    tagSlugs: ["contact-humain"],
  },
  ENTREPRENEURSHIP: {
    categorySlugs: ["entrepreneuriat", "comptabilite", "droit-social"],
    tagSlugs: ["independant", "travail-autonome"],
  },
};
