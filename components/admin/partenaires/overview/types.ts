/**
 * Types pour la page d'overview admin /admin/partenaires (refonte 2026-05).
 *
 * On garde le shape `OrganizationGroup` aligné sur celui retourné par
 * `lib/partner-domains.ts → listOrganizations()`, mais sérialisé (dates →
 * string) pour pouvoir traverser la frontière server/client.
 */

export interface PartnerDomain {
  id: string;
  domain: string;
  notes: string | null;
  isTest: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface PartnerUser {
  id: string;
  name: string;
  email: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface OrganizationGroup {
  organizationName: string;
  domains: PartnerDomain[];
  users: PartnerUser[];
  isActive: boolean;
  hasTestDomain: boolean;
  domainCount: number;
  userCount: number;
}

/**
 * Filtre principal de la barre de tabs.
 *
 *   - all      : tout
 *   - active   : org avec au moins un domaine actif
 *   - inactive : org sans domaine actif (tous désactivés)
 *   - pending  : org avec au moins un utilisateur en attente (status !== active OR !emailVerified)
 *   - test     : org avec au moins un domaine de test
 */
export type PartnerStatusFilter =
  | "all"
  | "active"
  | "inactive"
  | "pending"
  | "test";

/**
 * Compteurs globaux calculés sur la liste totale (non filtrée).
 */
export interface PartnerCounts {
  total: number;
  active: number;
  pending: number;
  inactive: number;
}
