/**
 * Docbel Formations — schémas Zod (validation isomorphe client + serveur).
 * Les ensembles bornés viennent de constants.ts (single source of truth).
 */
import { z } from "zod";
import {
  TRAINING_VISIBILITIES,
  TRAINING_LEVELS,
  TRAINING_FORMATS,
  PRICE_TYPES,
  CERTIFICATE_TYPES,
  SESSION_MODES,
  SESSION_STATUSES,
  ORG_MEMBER_ROLES,
  ORG_TYPES,
  ACCESS_RULE_TYPES,
  REPORT_REASONS,
  TRAINING_STATUSES,
} from "./constants";

/** z.enum tolérant aux tableaux `as const` readonly. */
const zEnum = <T extends string>(arr: readonly T[]) =>
  z.enum([...arr] as [T, ...T[]]);

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide (a-z, 0-9, tirets)");

const optionalUrl = z.string().trim().url().max(2048).optional().or(z.literal(""));
const optionalEmail = z
  .string()
  .trim()
  .email()
  .max(320)
  .optional()
  .or(z.literal(""));

// --- Formation : brouillon (création) -------------------------------------
export const trainingDraftSchema = z.object({
  organizationId: z.string().min(1, "Organisation requise"),
  title: z.string().trim().min(3, "Titre requis").max(200),
});
export type TrainingDraftInput = z.infer<typeof trainingDraftSchema>;

// --- Formation : mise à jour (édition par étapes, tout optionnel) ----------
export const trainingUpdateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  slug: slugSchema.optional(),
  shortDescription: z.string().trim().max(400).optional(),
  description: z.string().trim().max(20000).optional(),
  objectives: z.array(z.string().trim().max(300)).max(20).optional(),
  targetAudience: z.string().trim().max(2000).optional(),
  prerequisites: z.string().trim().max(2000).optional(),
  level: zEnum(TRAINING_LEVELS).optional(),
  language: z.string().trim().max(10).optional(),
  categoryId: z.string().nullable().optional(),
  secondaryCategoryIds: z.array(z.string()).max(10).optional(),
  skills: z.array(z.string().trim().max(120)).max(40).optional(),
  keywords: z.array(z.string().trim().max(60)).max(40).optional(),
  tagSlugs: z.array(z.string().trim().max(80)).max(40).optional(),
  format: zEnum(TRAINING_FORMATS).optional(),
  durationHours: z.number().min(0).max(10000).nullable().optional(),
  durationDays: z.number().min(0).max(2000).nullable().optional(),
  totalDurationLabel: z.string().trim().max(120).optional(),
  rhythm: z.string().trim().max(200).optional(),
  hasSessions: z.boolean().optional(),
  priceType: zEnum(PRICE_TYPES).optional(),
  priceAmount: z.number().min(0).max(1_000_000).nullable().optional(),
  currency: z.string().trim().max(6).optional(),
  priceVatIncluded: z.boolean().nullable().optional(),
  externalPaymentUrl: optionalUrl,
  paymentInfo: z.string().trim().max(2000).optional(),
  cancellationPolicy: z.string().trim().max(2000).optional(),
  refundPolicy: z.string().trim().max(2000).optional(),
  certificateType: zEnum(CERTIFICATE_TYPES).optional(),
  certificateDescription: z.string().trim().max(2000).optional(),
  coverImageUrl: optionalUrl,
  logoUrl: optionalUrl,
  programPdfUrl: optionalUrl,
  attachmentUrl: optionalUrl,
  externalUrl: optionalUrl,
  contactName: z.string().trim().max(160).optional(),
  contactEmail: optionalEmail,
  contactPhone: z.string().trim().max(40).optional(),
  contactWebsite: optionalUrl,
  visibility: zEnum(TRAINING_VISIBILITIES).optional(),
});
export type TrainingUpdateInput = z.infer<typeof trainingUpdateSchema>;

/**
 * Validation stricte avant SOUMISSION (status → pending_review). Renvoie les
 * champs requis manquants. Utilisée côté serveur dans l'action submit.
 */
export const trainingSubmitSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    shortDescription: z.string().trim().min(10, "Résumé requis").max(400),
    description: z.string().trim().min(30, "Description requise").max(20000),
    categoryId: z.string().min(1, "Catégorie requise"),
    level: zEnum(TRAINING_LEVELS),
    format: zEnum(TRAINING_FORMATS),
    visibility: zEnum(TRAINING_VISIBILITIES),
    priceType: zEnum(PRICE_TYPES),
    priceAmount: z.number().min(0).nullable().optional(),
    currency: z.string().trim().max(6).optional(),
    contactEmail: z.string().trim().email().optional().or(z.literal("")),
  })
  .refine((d) => d.priceType !== "paid" || (d.priceAmount != null && d.priceAmount > 0), {
    message: "Prix requis pour une formation payante",
    path: ["priceAmount"],
  })
  .refine((d) => d.priceType !== "paid" || !!d.currency, {
    message: "Devise requise pour une formation payante",
    path: ["currency"],
  });
export type TrainingSubmitInput = z.infer<typeof trainingSubmitSchema>;

// --- Session ---------------------------------------------------------------
export const sessionSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    status: zEnum(SESSION_STATUSES).optional(),
    mode: zEnum(SESSION_MODES).optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    timezone: z.string().trim().max(60).optional(),
    locationName: z.string().trim().max(200).optional(),
    address: z.string().trim().max(300).optional(),
    city: z.string().trim().max(120).optional(),
    region: z.string().trim().max(60).optional(),
    onlineUrl: optionalUrl,
    capacity: z.number().int().min(1).max(100000).nullable().optional(),
    waitlistEnabled: z.boolean().optional(),
    registrationDeadline: z.string().datetime().nullable().optional(),
    requiresManualApproval: z.boolean().optional(),
    instructions: z.string().trim().max(2000).optional(),
    contactEmail: optionalEmail,
  })
  .refine(
    (d) => !d.startsAt || !d.endsAt || new Date(d.endsAt) >= new Date(d.startsAt),
    { message: "La date de fin doit suivre la date de début", path: ["endsAt"] },
  );
export type SessionInput = z.infer<typeof sessionSchema>;

// --- Inscription (publique) ------------------------------------------------
export const enrollmentSchema = z.object({
  sessionId: z.string().min(1),
  citizenName: z.string().trim().min(2, "Nom requis").max(160),
  citizenEmail: z.string().trim().email("Email invalide").max(320),
  citizenPhone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(1000).optional(),
  motivation: z.string().trim().max(2000).optional(),
  acceptTerms: z.literal(true, { message: "Veuillez accepter les conditions" }),
  locale: z.string().trim().max(8).optional(),
});
export type EnrollmentInput = z.infer<typeof enrollmentSchema>;

// --- Signalement -----------------------------------------------------------
export const reportSchema = z.object({
  trainingId: z.string().min(1),
  reason: zEnum(REPORT_REASONS),
  message: z.string().trim().max(2000).optional(),
  reporterEmail: optionalEmail,
});
export type ReportInput = z.infer<typeof reportSchema>;

// --- Boussole (passation) --------------------------------------------------
export const boussoleSubmitSchema = z.object({
  /** { [questionKey]: optionValue } */
  answers: z.record(z.string(), z.string()),
  sessionId: z.string().trim().min(8).max(120),
  save: z.boolean().optional(),
});
export type BoussoleSubmitInput = z.infer<typeof boussoleSubmitSchema>;

// --- Admin : décision de validation ----------------------------------------
export const reviewActionSchema = z.object({
  action: z.enum(["approve", "publish", "request_changes", "reject", "suspend", "archive", "unsuspend"]),
  note: z.string().trim().max(2000).optional(),
});
export type ReviewActionInput = z.infer<typeof reviewActionSchema>;

// --- Admin : permissions d'organisation ------------------------------------
export const orgPermissionSchema = z.object({
  canCreateTraining: z.boolean().optional(),
  canSubmitTraining: z.boolean().optional(),
  canPublishDirectly: z.boolean().optional(),
  canCreatePublicTraining: z.boolean().optional(),
  canCreatePaidTraining: z.boolean().optional(),
  canCreatePrivateTraining: z.boolean().optional(),
  canCreateInternalTraining: z.boolean().optional(),
  canManageSessions: z.boolean().optional(),
  canManageEnrollments: z.boolean().optional(),
  canViewParticipantData: z.boolean().optional(),
  canExportParticipants: z.boolean().optional(),
  canIssueCertificate: z.boolean().optional(),
  canUseDocbelBadge: z.boolean().optional(),
  canRequestFeaturedPlacement: z.boolean().optional(),
});
export type OrgPermissionInput = z.infer<typeof orgPermissionSchema>;

// --- Admin : organisation --------------------------------------------------
export const orgSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: slugSchema.optional(),
  type: zEnum(ORG_TYPES).optional(),
  organismeId: z.string().nullable().optional(),
  partnerOrganization: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2000).optional(),
  logoUrl: optionalUrl,
  brandColor: z.string().trim().max(20).optional(),
  website: optionalUrl,
  contactEmail: optionalEmail,
  notifyEmail: optionalEmail,
  status: z.enum(["active", "suspended", "pending"]).optional(),
});
export type OrgInput = z.infer<typeof orgSchema>;

// --- Admin : membre d'organisation -----------------------------------------
export const orgMemberSchema = z.object({
  userId: z.string().min(1),
  role: zEnum(ORG_MEMBER_ROLES),
});

// --- Admin : règle d'accès (audience privée/interne) -----------------------
export const accessRuleSchema = z.object({
  type: zEnum(ACCESS_RULE_TYPES),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  email: optionalEmail,
  role: z.string().optional(),
  group: z.string().optional(),
  segment: z.string().optional(),
  partnerType: z.string().optional(),
});

// --- Admin : badge / catégorie / tag / branche / question ------------------
export const badgeAssignSchema = z.object({
  badgeSlug: z.string().min(1),
  grant: z.boolean(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  description: z.string().trim().max(1000).optional(),
  icon: z.string().trim().max(60).optional(),
  color: z.string().trim().max(20).optional(),
  parentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().optional(),
});

export const tagSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  type: z.string().trim().max(60).optional(),
  isOrientationTag: z.boolean().optional(),
});

export const orientationQuestionSchema = z.object({
  text: z.string().trim().min(5).max(400),
  description: z.string().trim().max(400).optional(),
  type: z.enum(["single", "multi"]).optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().optional(),
});

/** Filtre catalogue (lecture depuis searchParams). */
export const catalogueFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  format: zEnum(TRAINING_FORMATS).optional(),
  level: zEnum(TRAINING_LEVELS).optional(),
  price: zEnum(PRICE_TYPES).optional(),
  region: z.string().trim().max(60).optional(),
  certificate: z.enum(["yes", "no"]).optional(),
  tag: z.string().trim().max(80).optional(),
  sort: z.enum(["soon", "new", "free_first", "recommended"]).optional(),
  branch: z.string().trim().max(60).optional(),
});
export type CatalogueFilter = z.infer<typeof catalogueFilterSchema>;

/** Liste blanche des statuts pour la validation admin. */
export const trainingStatusSchema = zEnum(TRAINING_STATUSES);

// --- Org : payloads du wizard de création/édition ---------------------------
export const trainingCreatePayloadSchema = z.object({
  training: trainingUpdateSchema,
  sessions: z.array(sessionSchema).max(30).optional(),
  submit: z.boolean().optional(),
});
export type TrainingCreatePayload = z.infer<typeof trainingCreatePayloadSchema>;

export const trainingUpdatePayloadSchema = z.object({
  training: trainingUpdateSchema,
  submit: z.boolean().optional(),
});
export type TrainingUpdatePayload = z.infer<typeof trainingUpdatePayloadSchema>;

/** Session côté org (création/édition individuelle sur la page de gestion). */
export const sessionUpsertSchema = sessionSchema;
