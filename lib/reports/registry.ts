import { z } from "zod";
import { prisma } from "@/lib/prisma";

export interface ReportTypeConfig {
  label: string;
  payloadSchema: z.ZodType;
  messageSchema: z.ZodType<string | undefined>;
  categories?: readonly { value: string; label: string }[];
  /// Vérification globale avant toute création (ex. feature flag). Le
  /// moteur propage status/error tels quels — pas de NextResponse ici pour
  /// que lib/reports/engine.ts reste indépendant de next/server.
  guard?: () => Promise<{ blocked: false } | { blocked: true; status: number; error: string }>;
  /// Résolution best-effort du libellé/lien affichés en admin. `ok: false`
  /// signifie "cible obligatoire introuvable" → l'appelant renvoie 404.
  /// Les types qui n'ont jamais besoin de bloquer renvoient toujours `ok: true`.
  resolveTarget: (
    targetId: string | undefined,
    payload: unknown,
  ) => Promise<
    | { ok: true; targetLabel: string | null; targetUrl: string | null }
    | { ok: false }
  >;
  /// Effet de bord optionnel exécuté quand le statut passe à "resolved".
  onResolve?: (
    report: { id: string; targetId: string | null; payload: unknown },
    resolvedBy: string,
  ) => Promise<void>;
}

const emailOptional = z.string().trim().email().max(320).optional();

export const BUREAU_CATEGORIES = [
  { value: "hours", label: "Horaires incorrects" },
  { value: "address", label: "Adresse incorrecte" },
  { value: "phone", label: "Téléphone incorrect" },
  { value: "closed", label: "Bureau fermé / déplacé" },
  { value: "other", label: "Autre" },
] as const;

export const TRAINING_REASONS = [
  { value: "prix_trompeur", label: "Prix trompeur" },
  { value: "info_fausse", label: "Information fausse" },
  { value: "non_serieuse", label: "Formation non sérieuse" },
  { value: "probleme_partenaire", label: "Problème avec le partenaire" },
  { value: "contenu_inadapte", label: "Contenu inadapté" },
  { value: "lien_casse", label: "Lien cassé" },
  { value: "expiree", label: "Formation expirée" },
  { value: "probleme_inscription", label: "Problème d'inscription" },
  { value: "autre", label: "Autre" },
] as const;

export const REPORT_TYPES: Record<string, ReportTypeConfig> = {
  bureau: {
    label: "Bureaux",
    payloadSchema: z.object({
      category: z.enum(["hours", "address", "phone", "closed", "other"]),
    }),
    messageSchema: z.string().trim().min(5).max(1000),
    categories: BUREAU_CATEGORIES,
    resolveTarget: async (targetId) => {
      if (!targetId) return { ok: false };
      const bureau = await prisma.bureau.findUnique({
        where: { id: targetId },
        select: { name: true, postalCode: true, city: true },
      });
      if (!bureau) return { ok: false };
      return {
        ok: true,
        targetLabel: `${bureau.name} (${bureau.postalCode} ${bureau.city})`,
        targetUrl: "/outils/bureaux",
      };
    },
  },

  form_validation: {
    label: "Validation formulaire",
    payloadSchema: z.object({
      fieldId: z.string().trim().min(1).max(100),
      fieldType: z.string().trim().min(1).max(50),
      rejectedValue: z.string().max(500),
      errorMessage: z.string().trim().min(1).max(500),
      formSlug: z.string().max(200).optional(),
      locale: z.enum(["fr", "nl", "de"]).optional(),
    }),
    messageSchema: z.string().trim().max(1000).optional(),
    resolveTarget: async (targetId, payload) => {
      const p = payload as { fieldId: string; formSlug?: string };
      if (targetId) {
        const form = await prisma.pdfForm.findUnique({
          where: { id: targetId },
          select: { title: true, slug: true },
        });
        if (form) {
          return {
            ok: true,
            targetLabel: `${form.title} — champ ${p.fieldId}`,
            targetUrl: `/d/${form.slug}`,
          };
        }
      }
      if (p.formSlug) {
        return {
          ok: true,
          targetLabel: `${p.formSlug} — champ ${p.fieldId}`,
          targetUrl: `/d/${p.formSlug}`,
        };
      }
      // Jamais bloquant : le formulaire d'origine était déjà optionnel.
      return { ok: true, targetLabel: `Champ ${p.fieldId}`, targetUrl: null };
    },
  },

  training: {
    label: "Formations",
    payloadSchema: z.object({
      reason: z.enum([
        "prix_trompeur", "info_fausse", "non_serieuse", "probleme_partenaire",
        "contenu_inadapte", "lien_casse", "expiree", "probleme_inscription", "autre",
      ]),
    }),
    messageSchema: z.string().trim().max(2000).optional(),
    categories: TRAINING_REASONS,
    guard: async () => {
      const { blockIfFlagOff } = await import("@/lib/formations/module-guard");
      const blocked = await blockIfFlagOff("catalog");
      return blocked
        ? { blocked: true, status: 404, error: "Fonctionnalité indisponible" }
        : { blocked: false };
    },
    resolveTarget: async (targetId) => {
      if (!targetId) return { ok: false };
      const training = await prisma.training.findUnique({
        where: { id: targetId },
        select: { title: true, slug: true },
      });
      if (!training) return { ok: false };
      return { ok: true, targetLabel: training.title, targetUrl: `/formations/${training.slug}` };
    },
  },

  translation: {
    label: "Traductions",
    payloadSchema: z
      .object({
        locale: z.string().trim().min(2).max(10),
        model: z.string().trim().min(1).max(80).optional(),
        recordId: z.string().trim().min(1).max(120).optional(),
        field: z.string().trim().min(1).max(80).optional(),
        uiKey: z.string().trim().min(1).max(200).optional(),
        sourceText: z.string().trim().min(1).max(20000),
        currentText: z.string().trim().max(20000).optional(),
        suggestedText: z.string().trim().min(1).max(20000),
      })
      .refine((d) => (!!d.model && !!d.recordId && !!d.field) || !!d.uiKey, {
        message: "Cible requise : (model + recordId + field) OU uiKey.",
        path: ["uiKey"],
      }),
    messageSchema: z.string().trim().max(2000).optional(),
    resolveTarget: async (targetId, payload) => {
      const p = payload as { model?: string; field?: string; uiKey?: string };
      const targetLabel = p.uiKey ? `UI · ${p.uiKey}` : `${p.model}#${targetId}.${p.field}`;
      return { ok: true, targetLabel, targetUrl: null };
    },
    onResolve: async (report, resolvedBy) => {
      const p = report.payload as {
        model?: string; recordId?: string; field?: string;
        suggestedText: string; locale: string;
      };
      if (!p.model || !p.recordId || !p.field) return; // cible UI : reporté manuellement par l'admin
      await prisma.contentTranslation.upsert({
        where: {
          model_recordId_field_locale: {
            model: p.model, recordId: p.recordId, field: p.field, locale: p.locale,
          },
        },
        update: { value: p.suggestedText, status: "reviewed", updatedBy: resolvedBy },
        create: {
          model: p.model, recordId: p.recordId, field: p.field, locale: p.locale,
          value: p.suggestedText, status: "reviewed", updatedBy: resolvedBy,
        },
      });
    },
  },

  riolex_article: {
    label: "Réglementation (RioLex)",
    payloadSchema: z.object({
      loi: z.string().trim().min(1).max(200),
      articleNumber: z.string().trim().min(1).max(50),
    }),
    messageSchema: z.string().trim().min(5).max(1000),
    resolveTarget: async (targetId, payload) => {
      const p = payload as { loi: string; articleNumber: string };
      return {
        ok: true,
        targetLabel: `${p.loi} art. ${p.articleNumber}`,
        targetUrl: targetId ? `/partenaire/reglementation/${targetId}` : null,
      };
    },
  },
};

export function isKnownReportType(type: string): type is keyof typeof REPORT_TYPES {
  return Object.prototype.hasOwnProperty.call(REPORT_TYPES, type);
}

export { emailOptional };
