/**
 * Types pour la page d'overview admin /admin/partenaires (refonte 2026-05).
 *
 * On garde le shape `OrganizationGroup` aligné sur celui retourné par
 * `lib/partner-domains.ts → listOrganizations()`, mais sérialisé (dates →
 * string) pour pouvoir traverser la frontière server/client.
 */

/** "domain" = autorisation par domaine entier ; "email" = adresse exacte. */
export type PartnerDomainKind = "domain" | "email";

/** Segment d'accès d'une entrée d'allowlist. */
export type PartnerSegment = "partenaire" | "employeur";

export interface PartnerDomain {
  id: string;
  kind: PartnerDomainKind;
  domain: string | null;
  email: string | null;
  segment: PartnerSegment;
  partnerType: string | null;
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

/* ------------------------------------------------------------------ */
/*  Libellés FR partagés (dialogs + listes + détails)                  */
/* ------------------------------------------------------------------ */

export const SEGMENT_LABELS: Record<PartnerSegment, string> = {
  partenaire: "Partenaire",
  employeur: "Employeur",
};

/**
 * Sous-types partenaire — l'ordre/les clés suivent PARTNER_TYPES de
 * lib/entitlements.ts. (Ré-énoncés ici pour éviter d'importer du code serveur
 * dans des composants client.)
 */
export const PARTNER_TYPE_LABELS: Record<string, string> = {
  onem: "ONEM",
  organisme_paiement: "Organisme de paiement",
  service_public: "Service public",
  prive_asbl: "Privé-ASBL",
};

export const PARTNER_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "onem", label: "ONEM" },
  { value: "organisme_paiement", label: "Organisme de paiement" },
  { value: "service_public", label: "Service public" },
  { value: "prive_asbl", label: "Privé-ASBL" },
];
