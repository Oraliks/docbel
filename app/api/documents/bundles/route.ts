import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { getUserLocale } from "@/i18n/locale";
import { localizeRecords } from "@/lib/i18n/content";
import { scheduleAutoTranslate } from "@/lib/i18n/auto-translate";
import { createBundleSchema } from "@/lib/bundles/admin-schema";
import { apiError, apiOk } from "@/lib/api/response";

export async function GET() {
  // Lecture publique des bundles actifs (utilisé pour la page publique aussi)
  const locale = await getUserLocale();
  const bundles = await prisma.documentBundle.findMany({
    where: { active: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      items: {
        orderBy: { order: "asc" },
        include: {
          pdfForm: {
            select: { id: true, slug: true, title: true, issuer: true, status: true },
          },
        },
      },
    },
  });
  // Traductions contenu DB (NL/EN…), fallback FR, no-op si locale=fr.
  const localized = await localizeRecords(
    "DocumentBundle",
    bundles,
    ["name", "description", "organism"],
    locale,
  );
  return apiOk(localized);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const parsed = createBundleSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return apiError(400, "Données invalides", {
      code: "validation_error",
      details: parsed.error.flatten(),
    });
  }

  const body = parsed.data;
  const dup = await prisma.documentBundle.findUnique({
    where: { slug: body.slug },
  });
  if (dup) {
    return apiError(409, `slug "${body.slug}" déjà utilisé`, {
      code: "slug_conflict",
    });
  }

  const created = await prisma.documentBundle.create({
    data: {
      slug: body.slug,
      name: body.name,
      description: body.description,
      icon: body.icon,
      color: body.color,
      order: body.order,
      lifeEventCategory: body.lifeEventCategory,
      showOnOnboarding: body.showOnOnboarding,
      vocabularyTags: body.vocabularyTags as unknown as Prisma.InputJsonValue,
      eligibilityQuestions:
        body.eligibilityQuestions as unknown as Prisma.InputJsonValue,
      warnings: body.warnings as unknown as Prisma.InputJsonValue,
      createdBy: auth.user.id,
    },
  });

  // Auto-traduction NL/EN en arrière-plan (name + description, statut "ia").
  scheduleAutoTranslate("DocumentBundle", created.id);

  return apiOk(created, { status: 201 });
}
