/**
 * Docbel Formations — ensembles bornés (String + union, pas d'enum Postgres) et
 * libellés FR. Isomorphe (importable client + serveur). Single source of truth
 * pour les statuts/visibilités/rôles utilisés partout dans le module.
 *
 * --- i18n -----------------------------------------------------------------
 * Ce fichier est un module `lib/` PUR : pas de hook React, donc on n'y traduit
 * pas. Les `*_LABELS` (FR) restent la source FR fonctionnelle (admin, PDF,
 * exports CSV, fallback serveur). Pour le FRONT multilingue, chaque map de
 * libellés a un jumeau `*_LABEL_KEYS` (valeur d'enum → chemin de clé i18n sous
 * `public.formations.*`). Au point d'affichage (composant) :
 *
 *   const t = useTranslations("public.formations");
 *   const label = t(SESSION_STATUS_LABEL_KEYS[status]);
 *
 * Les clés sont relatives au namespace `public.formations`, donc à utiliser
 * directement avec `t(...)`. Garder les deux maps en phase si on ajoute une
 * valeur d'enum.
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

/** Clés i18n (sous `public.formations`) jumelles de VISIBILITY_LABELS. */
export const VISIBILITY_LABEL_KEYS: Record<TrainingVisibility, string> = {
  public: "visibility.public",
  unlisted: "visibility.unlisted",
  private: "visibility.private",
  internal: "visibility.internal",
  draft: "visibility.draft",
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

/** Clés i18n (sous `public.formations`) jumelles de TRAINING_STATUS_LABELS. */
export const TRAINING_STATUS_LABEL_KEYS: Record<TrainingStatus, string> = {
  draft: "status.draft",
  pending_review: "status.pending_review",
  changes_requested: "status.changes_requested",
  approved: "status.approved",
  published: "status.published",
  suspended: "status.suspended",
  rejected: "status.rejected",
  archived: "status.archived",
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

/** Clés i18n (sous `public.formations`) jumelles de SESSION_STATUS_LABELS. */
export const SESSION_STATUS_LABEL_KEYS: Record<TrainingSessionStatus, string> = {
  draft: "sessionStatus.draft",
  scheduled: "sessionStatus.scheduled",
  open: "sessionStatus.open",
  full: "sessionStatus.full",
  cancelled: "sessionStatus.cancelled",
  ongoing: "sessionStatus.ongoing",
  completed: "sessionStatus.completed",
  archived: "sessionStatus.archived",
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

/** Clés i18n (sous `public.formations`) jumelles de ENROLLMENT_STATUS_LABELS. */
export const ENROLLMENT_STATUS_LABEL_KEYS: Record<
  TrainingEnrollmentStatus,
  string
> = {
  requested: "enrollmentStatus.requested",
  pending_review: "enrollmentStatus.pending_review",
  accepted: "enrollmentStatus.accepted",
  refused: "enrollmentStatus.refused",
  waitlisted: "enrollmentStatus.waitlisted",
  cancelled_user: "enrollmentStatus.cancelled_user",
  cancelled_org: "enrollmentStatus.cancelled_org",
  present: "enrollmentStatus.present",
  absent: "enrollmentStatus.absent",
  completed: "enrollmentStatus.completed",
  certificate_available: "enrollmentStatus.certificate_available",
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

/** Clés i18n (sous `public.formations`) jumelles de FORMAT_LABELS. */
export const FORMAT_LABEL_KEYS: Record<TrainingFormat, string> = {
  online: "format.online",
  onsite: "format.onsite",
  hybrid: "format.hybrid",
  autoformation: "format.autoformation",
  accompagnement: "format.accompagnement",
};

export const SESSION_MODES = ["online", "onsite", "hybrid"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];
export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  online: "En ligne",
  onsite: "Présentiel",
  hybrid: "Hybride",
};

/** Clés i18n (sous `public.formations`) jumelles de SESSION_MODE_LABELS. */
export const SESSION_MODE_LABEL_KEYS: Record<SessionMode, string> = {
  online: "sessionMode.online",
  onsite: "sessionMode.onsite",
  hybrid: "sessionMode.hybrid",
};

// --- Niveau ----------------------------------------------------------------
export const TRAINING_LEVELS = ["debutant", "intermediaire", "avance"] as const;
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];
export const LEVEL_LABELS: Record<TrainingLevel, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

/** Clés i18n (sous `public.formations`) jumelles de LEVEL_LABELS. */
export const LEVEL_LABEL_KEYS: Record<TrainingLevel, string> = {
  debutant: "level.debutant",
  intermediaire: "level.intermediaire",
  avance: "level.avance",
};

// --- Prix ------------------------------------------------------------------
export const PRICE_TYPES = ["free", "paid"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];
export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  free: "Gratuite",
  paid: "Payante",
};

/** Clés i18n (sous `public.formations`) jumelles de PRICE_TYPE_LABELS. */
export const PRICE_TYPE_LABEL_KEYS: Record<PriceType, string> = {
  free: "priceType.free",
  paid: "priceType.paid",
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

/** Clés i18n (sous `public.formations`) jumelles de CERTIFICATE_LABELS. */
export const CERTIFICATE_LABEL_KEYS: Record<CertificateType, string> = {
  none: "certificate.none",
  participation: "certificate.participation",
  partner: "certificate.partner",
  docbel: "certificate.docbel",
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

/** Clés i18n (sous `public.formations`) jumelles de ORG_TYPE_LABELS. */
export const ORG_TYPE_LABEL_KEYS: Record<FormationOrgType, string> = {
  employeur: "orgType.employeur",
  partenaire: "orgType.partenaire",
  asbl: "orgType.asbl",
  organisme_formation: "orgType.organisme_formation",
  administration: "orgType.administration",
  prive: "orgType.prive",
  formateur: "orgType.formateur",
  interne_docbel: "orgType.interne_docbel",
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

/** Clés i18n (sous `public.formations`) jumelles de ORG_ROLE_LABELS. */
export const ORG_ROLE_LABEL_KEYS: Record<FormationOrgRole, string> = {
  owner: "orgRole.owner",
  manager: "orgRole.manager",
  trainer: "orgRole.trainer",
  viewer: "orgRole.viewer",
  admin_contact: "orgRole.admin_contact",
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

/** Clés i18n (sous `public.formations`) jumelles de REPORT_REASON_LABELS. */
export const REPORT_REASON_LABEL_KEYS: Record<ReportReason, string> = {
  prix_trompeur: "reportReason.prix_trompeur",
  info_fausse: "reportReason.info_fausse",
  non_serieuse: "reportReason.non_serieuse",
  probleme_partenaire: "reportReason.probleme_partenaire",
  contenu_inadapte: "reportReason.contenu_inadapte",
  lien_casse: "reportReason.lien_casse",
  expiree: "reportReason.expiree",
  probleme_inscription: "reportReason.probleme_inscription",
  autre: "reportReason.autre",
};

export const REPORT_STATUSES = ["new", "in_progress", "resolved", "rejected"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  resolved: "Traité",
  rejected: "Rejeté",
};

/** Clés i18n (sous `public.formations`) jumelles de REPORT_STATUS_LABELS. */
export const REPORT_STATUS_LABEL_KEYS: Record<ReportStatus, string> = {
  new: "reportStatus.new",
  in_progress: "reportStatus.in_progress",
  resolved: "reportStatus.resolved",
  rejected: "reportStatus.rejected",
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
