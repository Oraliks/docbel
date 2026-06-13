/**
 * Modèles de base des checklists par catégorie (items inconditionnels).
 * Les items CONDITIONNELS (WIDE, Dimona, temps partiel, étudiant, flexi…) sont
 * émis par le moteur de règles, pas ici. MVP : deux catégories complètes.
 */
import type { ChecklistCategory, ItemPriority } from "../constants";

export interface TemplateItem {
  title: string;
  description?: string;
  priority: ItemPriority;
  sourceCode?: string;
  tooltip?: string;
}

const PREMIER_ENGAGEMENT: TemplateItem[] = [
  {
    title: "Vérifier le numéro BCE de l'entreprise",
    description: "Confirmer l'identification de l'entreprise à la Banque-Carrefour des Entreprises.",
    priority: "recommande",
    sourceCode: "S4",
  },
  {
    title: "Identifier la commission paritaire probable",
    description: "La commission paritaire détermine le salaire minimum et de nombreuses obligations.",
    priority: "obligatoire",
    sourceCode: "S8",
  },
  {
    title: "Vérifier le salaire minimum applicable",
    description: "Le salaire doit respecter le minimum de la commission paritaire compétente.",
    priority: "obligatoire",
    sourceCode: "S8",
  },
  {
    title: "Choisir et préparer le type de contrat",
    description: "CDI, CDD, temps partiel, étudiant, flexi-job… selon la situation.",
    priority: "obligatoire",
    sourceCode: "S6",
  },
  {
    title: "Vérifier ou établir le règlement de travail",
    description: "Le règlement de travail est en principe obligatoire dès le premier travailleur.",
    priority: "obligatoire",
    sourceCode: "S7",
  },
  {
    title: "Souscrire une assurance accidents du travail",
    description: "L'assurance accidents du travail est obligatoire pour tout employeur.",
    priority: "obligatoire",
    sourceCode: "S4",
  },
  {
    title: "Vérifier l'affiliation à un service externe de prévention et de protection",
    priority: "recommande",
    sourceCode: "S4",
  },
  {
    title: "Préparer le dossier / la fiche du travailleur",
    description: "Rassembler les données nécessaires au payroll et au dossier personnel.",
    priority: "recommande",
    sourceCode: "S4",
  },
  {
    title: "Prévoir l'accès e-Box Enterprise (communications officielles)",
    priority: "optionnel",
    sourceCode: "S13",
  },
];

const ENGAGEMENT_CLASSIQUE: TemplateItem[] = [
  {
    title: "Valider le type de contrat",
    priority: "obligatoire",
    sourceCode: "S6",
  },
  {
    title: "Vérifier la commission paritaire",
    priority: "obligatoire",
    sourceCode: "S8",
  },
  {
    title: "Vérifier le barème salarial applicable",
    priority: "obligatoire",
    sourceCode: "S8",
  },
  {
    title: "Préparer le contrat",
    priority: "obligatoire",
    sourceCode: "S6",
  },
  {
    title: "Encoder les données pour le payroll",
    priority: "recommande",
  },
  {
    title: "Préparer les documents internes et l'onboarding",
    priority: "recommande",
  },
];

const TEMPLATES: Partial<Record<ChecklistCategory, TemplateItem[]>> = {
  premier_engagement: PREMIER_ENGAGEMENT,
  engagement_classique: ENGAGEMENT_CLASSIQUE,
};

export function getTemplateItems(category: ChecklistCategory): TemplateItem[] {
  return TEMPLATES[category] ?? ENGAGEMENT_CLASSIQUE;
}
