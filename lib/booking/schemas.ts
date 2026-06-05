// Schémas Zod — source de vérité pour les payloads d'API (config équipe +
// réservation publique). Réutilise la validation des champs de formulaire.

import { z } from "zod";
import { bookingFormFieldsSchema } from "./form-fields";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide (HH:MM)");
const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)");
const CATEGORY = z.enum([
  "unemployment",
  "social_aid",
  "municipal",
  "private",
  "other",
]);

// --- Configuration tenant ----------------------------------------------------

export const tenantCreateSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug invalide (minuscules, chiffres, tirets)"),
  name: z.string().min(1).max(120),
  category: CATEGORY.optional(),
  partnerOrganization: z.string().max(120).nullable().optional(),
  organismeId: z.string().max(40).nullable().optional(),
});

export const tenantSettingsSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  category: CATEGORY.optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur hex invalide")
    .nullable()
    .optional(),
  emailFromName: z.string().max(80).nullable().optional(),
  formFields: bookingFormFieldsSchema.optional(),
  requireApproval: z.boolean().optional(),
  autoApproveAfterHours: z.number().int().min(1).max(720).optional(),
  dedupeField: z.enum(["email", "name", "nrn", "none"]).optional(),
  dedupeWindowDays: z.number().int().min(0).max(365).optional(),
  active: z.boolean().optional(),
});

// --- Antennes ----------------------------------------------------------------

export const locationSchema = z.object({
  name: z.string().min(1).max(120),
  bureauId: z.string().max(40).nullable().optional(),
  street: z.string().max(160).nullable().optional(),
  postalCode: z.string().regex(/^\d{4}$/, "Code postal invalide").nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  active: z.boolean().optional(),
});

// --- Règles de créneaux ------------------------------------------------------

export const slotDefSchema = z.object({
  startTime: HM,
  endTime: HM,
  capacity: z.number().int().min(1).max(500),
});

export const ruleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: HM,
  endTime: HM,
  capacity: z.number().int().min(1).max(500),
  serviceCode: z.string().max(60).nullable().optional(),
  validFrom: YMD.nullable().optional(),
  validUntil: YMD.nullable().optional(),
  active: z.boolean().optional(),
});

// --- Exceptions --------------------------------------------------------------

export const exceptionSchema = z.object({
  date: YMD,
  kind: z.enum(["closed", "extra"]),
  slots: z.array(slotDefSchema).max(50).optional(),
  reason: z.string().max(160).nullable().optional(),
});

// --- Équipe ------------------------------------------------------------------

export const memberCreateSchema = z.object({
  email: z.string().regex(EMAIL_RE, "Email invalide"),
  role: z.enum(["owner", "manager", "agent"]),
});

export const memberUpdateSchema = z.object({
  role: z.enum(["owner", "manager", "agent"]),
});

// --- Actions sur une réservation (équipe) ------------------------------------

export const bookingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().min(1).max(300) }),
  z.object({ action: z.literal("cancel"), reason: z.string().min(1).max(300) }),
  z.object({ action: z.literal("no_show") }),
  z.object({ action: z.literal("complete") }),
]);

// --- Public ------------------------------------------------------------------

export const publicBookSchema = z.object({
  locationId: z.string().min(1).max(40),
  date: YMD,
  startTime: HM,
  formData: z.record(z.string(), z.unknown()),
});

export const dedupeCheckSchema = z.object({
  email: z.string().max(160).optional(),
  name: z.string().max(160).optional(),
  nrn: z.string().max(20).optional(),
});
