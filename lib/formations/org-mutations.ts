/** Helpers de mutation des formations côté organisation (serveur). */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TrainingUpdateInput } from "./schemas";
import type { OrgCapabilities } from "./access";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "formation"
  );
}

/** Slug unique sur Training (exclut l'id en cours d'édition). */
export async function genUniqueTrainingSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base);
  let slug = root;
  for (let i = 0; i < 50; i++) {
    const found = await prisma.training.findUnique({ where: { slug }, select: { id: true } });
    if (!found || found.id === excludeId) return slug;
    slug = `${root}-${i + 2}`;
  }
  return `${root}-${Math.random().toString(36).slice(2, 7)}`;
}

const nz = (v: string | null | undefined): string | null => (v == null || v === "" ? null : v);

/**
 * Mappe le payload validé du wizard vers les champs Prisma à écrire. Ne renvoie
 * que les clés effectivement fournies (le reste est laissé inchangé). La
 * visibilité est traitée séparément (capacités).
 */
export function buildTrainingWriteData(
  input: TrainingUpdateInput,
): Prisma.TrainingUncheckedUpdateInput {
  const d: Prisma.TrainingUncheckedUpdateInput = {};
  const has = (k: keyof TrainingUpdateInput) => Object.prototype.hasOwnProperty.call(input, k);

  if (has("title")) d.title = input.title;
  if (has("shortDescription")) d.shortDescription = nz(input.shortDescription);
  if (has("description")) d.description = nz(input.description);
  if (has("objectives")) d.objectives = input.objectives ?? [];
  if (has("targetAudience")) d.targetAudience = nz(input.targetAudience);
  if (has("prerequisites")) d.prerequisites = nz(input.prerequisites);
  if (has("level")) d.level = input.level;
  if (has("language")) d.language = input.language;
  if (has("categoryId")) d.categoryId = input.categoryId ?? null;
  if (has("secondaryCategoryIds")) d.secondaryCategoryIds = input.secondaryCategoryIds ?? [];
  if (has("skills")) d.skills = input.skills ?? [];
  if (has("keywords")) d.keywords = (input.keywords ?? []).map((k) => k.toLowerCase());
  if (has("format")) d.format = input.format;
  if (has("durationHours")) d.durationHours = input.durationHours ?? null;
  if (has("durationDays")) d.durationDays = input.durationDays ?? null;
  if (has("totalDurationLabel")) d.totalDurationLabel = nz(input.totalDurationLabel);
  if (has("rhythm")) d.rhythm = nz(input.rhythm);
  if (has("hasSessions")) d.hasSessions = input.hasSessions;
  if (has("priceType")) d.priceType = input.priceType;
  if (has("priceAmount")) d.priceAmount = input.priceAmount ?? null;
  if (has("currency")) d.currency = input.currency ?? "EUR";
  if (has("priceVatIncluded")) d.priceVatIncluded = input.priceVatIncluded ?? null;
  if (has("externalPaymentUrl")) d.externalPaymentUrl = nz(input.externalPaymentUrl);
  if (has("paymentInfo")) d.paymentInfo = nz(input.paymentInfo);
  if (has("cancellationPolicy")) d.cancellationPolicy = nz(input.cancellationPolicy);
  if (has("refundPolicy")) d.refundPolicy = nz(input.refundPolicy);
  if (has("certificateType")) d.certificateType = input.certificateType;
  if (has("certificateDescription")) d.certificateDescription = nz(input.certificateDescription);
  if (has("coverImageUrl")) d.coverImageUrl = nz(input.coverImageUrl);
  if (has("logoUrl")) d.logoUrl = nz(input.logoUrl);
  if (has("programPdfUrl")) d.programPdfUrl = nz(input.programPdfUrl);
  if (has("attachmentUrl")) d.attachmentUrl = nz(input.attachmentUrl);
  if (has("externalUrl")) d.externalUrl = nz(input.externalUrl);
  if (has("contactName")) d.contactName = nz(input.contactName);
  if (has("contactEmail")) d.contactEmail = nz(input.contactEmail);
  if (has("contactPhone")) d.contactPhone = nz(input.contactPhone);
  if (has("contactWebsite")) d.contactWebsite = nz(input.contactWebsite);

  return d;
}

/**
 * Vérifie qu'une visibilité demandée est permise par les capacités de l'org.
 * Renvoie un message d'erreur, ou null si OK.
 */
export function visibilityError(
  visibility: string | undefined,
  caps: OrgCapabilities,
): string | null {
  if (!visibility) return null;
  switch (visibility) {
    case "public":
      return caps.createPublic ? null : "Votre organisation ne peut pas publier de formation publique.";
    case "private":
      return caps.createPrivate ? null : "Votre organisation n'est pas autorisée à créer des formations privées.";
    case "internal":
      return caps.createInternal ? null : "Votre organisation n'est pas autorisée à créer des formations internes.";
    case "unlisted":
    case "draft":
      return null;
    default:
      return "Visibilité invalide.";
  }
}

/** Remplace les tags d'une formation par la liste de slugs fournie. */
export async function syncTrainingTags(trainingId: string, tagSlugs: string[]): Promise<void> {
  const tags = await prisma.trainingTag.findMany({
    where: { slug: { in: tagSlugs } },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.trainingTagOnTraining.deleteMany({ where: { trainingId } }),
    ...(tags.length > 0
      ? [
          prisma.trainingTagOnTraining.createMany({
            data: tags.map((t) => ({ trainingId, tagId: t.id })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
}

/** Convertit une date ISO (string) en Date, ou null. */
export function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
