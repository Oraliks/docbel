/**
 * Docbel Formations — ensembles bornés (String + union, pas d'enum Postgres) et
 * libellés FR. Isomorphe (importable client + serveur). Single source of truth
 * pour les statuts/visibilités/rôles utilisés partout dans le module.
 */

// --- Visibilité ------------------------------------------------------------
export const TRAINING_VISIBILITIES = [
  "public",
  "unlisted",
  "private",
  "internal",
  "draft",
] as const;
export type TrainingVisibility = (typeof TRAINING_VISIBILITIES)[number];

export const VISIBILITY_LABELS: Record<TrainingVisibility, string> = {
  public: "Publique",
  unlisted: "Non listée",
  private: "Privée",
  internal: "Interne",
  draft: "Brouillon",
};

// --- Statut formation ------------------------------------------------------
export const TRAINING_STATUSES = [
  "draft",
  "pending_review",
  "changes_requested",
  "approved",
  "published",
  "suspended",
  "rejected",
  "archived",
] as const;
export type TrainingStatus = (typeof TRAINING_STATUSES)[number];

export const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  draft: "Brouillon",
  pending_review: "En validation",
  changes_requested: "Correction demandée",
  approved: "Validée",
  published: "Publiée",
  suspended: "Suspendue",
  rejected: "Refusée",
  archived: "Archivée",
};

/** Statuts visibles publiquement (si la visibilité le permet). */
export const PUBLIC_TRAINING_STATUSES: TrainingStatus[] = ["published"];

// --- Statut session --------------------------------------------------------
export const SESSION_STATUSES = [
  "draft",
  "scheduled",
  "open",
  "full",
  "cancelled",
  "ongoing",
  "completed",
  "archived",
] as const;
export type TrainingSessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_STATUS_LABELS: Record<TrainingSessionStatus, string> = {
  draft: "Brouillon",
  scheduled: "Programmée",
  open: "Inscriptions ouvertes",
  full: "Complète",
  cancelled: "Annulée",
  ongoing: "En cours",
  completed: "Terminée",
  archived: "Archivée",
};

/** Sessions sur lesquelles une inscription publique est possible. */
export const OPEN_SESSION_STATUSES: TrainingSessionStatus[] = [
  "scheduled",
  "open",
];

// --- Statut inscription ----------------------------------------------------
export const ENROLLMENT_STATUSES = [
  "requested",
  "pending_review",
  "accepted",
  "refused",
  "waitlisted",
  "cancelled_user",
  "cancelled_org",
  "present",
  "absent",
  "completed",
  "certificate_available",
] as const;
export type TrainingEnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const ENROLLMENT_STATUS_LABELS: Record<TrainingEnrollmentStatus, string> =
  {
    requested: "Demande envoyée",
    pending_review: "En attente de validation",
    accepted: "Acceptée",
    refused: "Refusée",
    waitlisted: "Liste d'attente",
    cancelled_user: "Annulée (par vous)",
    cancelled_org: "Annulée (par l'organisateur)",
    present: "Présent",
    absent: "Absent",
    completed: "Terminée",
    certificate_available: "Attestation disponible",
  };

/** Statuts d'inscription qui occupent une place dans la capacité. */
export const ACTIVE_ENROLLMENT_STATUSES: TrainingEnrollmentStatus[] = [
  "requested",
  "pending_review",
  "accepted",
  "present",
  "completed",
  "certificate_available",
];

// --- Format ----------------------------------------------------------------
export const TRAINING_FORMATS = [
  "online",
  "onsite",
  "hybrid",
  "autoformation",
  "accompagnement",
] as const;
export type TrainingFormat = (typeof TRAINING_FORMATS)[number];

export const FORMAT_LABELS: Record<TrainingFormat, string> = {
  online: "En ligne",
  onsite: "Présentiel",
  hybrid: "Hybride",
  autoformation: "Autoformation",
  accompagnement: "Accompagnement individuel",
};

export const SESSION_MODES = ["online", "onsite", "hybrid"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];
export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  online: "En ligne",
  onsite: "Présentiel",
  hybrid: "Hybride",
};

// --- Niveau ----------------------------------------------------------------
export const TRAINING_LEVELS = ["debutant", "intermediaire", "avance"] as const;
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];
export const LEVEL_LABELS: Record<TrainingLevel, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

// --- Prix ------------------------------------------------------------------
export const PRICE_TYPES = ["free", "paid"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];
export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  free: "Gratuite",
  paid: "Payante",
};

// --- Certification ---------------------------------------------------------
export const CERTIFICATE_TYPES = [
  "none",
  "participation",
  "partner",
  "docbel",
] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];
export const CERTIFICATE_LABELS: Record<CertificateType, string> = {
  none: "Aucune attestation",
  participation: "Attestation de participation",
  partner: "Certificat partenaire",
  docbel: "Certificat Docbel",
};

// --- Type d'organisation ---------------------------------------------------
export const ORG_TYPES = [
  "employeur",
  "partenaire",
  "asbl",
  "organisme_formation",
  "administration",
  "prive",
  "formateur",
  "interne_docbel",
] as const;
export type FormationOrgType = (typeof ORG_TYPES)[number];
export const ORG_TYPE_LABELS: Record<FormationOrgType, string> = {
  employeur: "Employeur",
  partenaire: "Partenaire",
  asbl: "ASBL",
  organisme_formation: "Organisme de formation",
  administration: "Administration partenaire",
  prive: "Société privée",
  formateur: "Formateur vérifié",
  interne_docbel: "Organisation interne Docbel",
};

// --- Rôle membre d'organisation -------------------------------------------
export const ORG_MEMBER_ROLES = [
  "owner",
  "manager",
  "trainer",
  "viewer",
  "admin_contact",
] as const;
export type FormationOrgRole = (typeof ORG_MEMBER_ROLES)[number];
export const ORG_ROLE_LABELS: Record<FormationOrgRole, string> = {
  owner: "Propriétaire",
  manager: "Gestionnaire",
  trainer: "Formateur",
  viewer: "Lecteur",
  admin_contact: "Contact administratif",
};

// --- Règles d'accès (audience) --------------------------------------------
export const ACCESS_RULE_TYPES = [
  "user",
  "organization",
  "email_invite",
  "role",
  "group",
  "segment",
  "partner",
  "admin_selected",
] as const;
export type AccessRuleType = (typeof ACCESS_RULE_TYPES)[number];

// --- Signalements ----------------------------------------------------------
export const REPORT_REASONS = [
  "prix_trompeur",
  "info_fausse",
  "non_serieuse",
  "probleme_partenaire",
  "contenu_inadapte",
  "lien_casse",
  "expiree",
  "probleme_inscription",
  "autre",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  prix_trompeur: "Prix trompeur",
  info_fausse: "Information fausse",
  non_serieuse: "Formation non sérieuse",
  probleme_partenaire: "Problème avec le partenaire",
  contenu_inadapte: "Contenu inadapté",
  lien_casse: "Lien cassé",
  expiree: "Formation expirée",
  probleme_inscription: "Problème d'inscription",
  autre: "Autre",
};

export const REPORT_STATUSES = ["new", "in_progress", "resolved", "rejected"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  resolved: "Traité",
  rejected: "Rejeté",
};

// --- Type-guards génériques -----------------------------------------------
const inSet =
  <T extends string>(set: readonly T[]) =>
  (v: unknown): v is T =>
    typeof v === "string" && (set as readonly string[]).includes(v);

export const isVisibility = inSet(TRAINING_VISIBILITIES);
export const isTrainingStatus = inSet(TRAINING_STATUSES);
export const isSessionStatus = inSet(SESSION_STATUSES);
export const isEnrollmentStatus = inSet(ENROLLMENT_STATUSES);
export const isFormat = inSet(TRAINING_FORMATS);
export const isLevel = inSet(TRAINING_LEVELS);
export const isOrgType = inSet(ORG_TYPES);
export const isOrgRole = inSet(ORG_MEMBER_ROLES);
export const isReportReason = inSet(REPORT_REASONS);

/** Devise par défaut. */
export const DEFAULT_CURRENCY = "EUR";
export const DEFAULT_TIMEZONE = "Europe/Brussels";
