/**
 * Types & constantes du module Formations — CLIENT-SAFE (pas de "server-only",
 * pas de prisma). Importables depuis les composants client. La logique serveur
 * (lecture/écriture des settings, accès) vit dans lib/formations/module.ts.
 */

export type LaunchMode = "HIDDEN" | "COMING_SOON" | "PRIVATE_BETA" | "PUBLIC";

export interface FormationsModuleConfig {
  enabled: boolean;
  publicEnabled: boolean;
  citizenEnabled: boolean;
  employerEnabled: boolean;
  partnerEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  launchMode: LaunchMode;
}

export const FLAG_KEYS = [
  "catalog",
  "orientation",
  "organizationCreation",
  "privateTrainings",
  "internalTrainings",
  "enrollments",
  "certificates",
  "notifications",
  "analytics",
  "lms",
  "quizzes",
  "paths",
  "payments",
  "marketplace",
  "ai",
  "partnerApi",
  "qualityScore",
  "docbelCertified",
  "sponsored",
] as const;
export type FormationsFlag = (typeof FLAG_KEYS)[number];
export type FormationsFlags = Record<FormationsFlag, boolean>;

export const DEFAULT_MODULE: FormationsModuleConfig = {
  enabled: true,
  publicEnabled: true,
  citizenEnabled: true,
  employerEnabled: true,
  partnerEnabled: true,
  maintenanceMode: false,
  maintenanceMessage:
    "Le module Formations est temporairement indisponible. Veuillez réessayer plus tard.",
  launchMode: "PUBLIC",
};

export const DEFAULT_FLAGS: FormationsFlags = {
  catalog: true,
  orientation: true,
  organizationCreation: true,
  privateTrainings: true,
  internalTrainings: true,
  enrollments: true,
  certificates: true,
  notifications: true,
  analytics: true,
  lms: false,
  quizzes: false,
  paths: false,
  payments: false,
  marketplace: false,
  ai: false,
  partnerApi: false,
  qualityScore: false,
  docbelCertified: false,
  sponsored: false,
};
