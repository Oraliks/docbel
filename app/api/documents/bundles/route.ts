import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { parseEligibilityQuestions } from "@/lib/bundles/eligibility";
import { parseVocabularyTags } from "@/lib/bundles/vocabulary";
import { parseBundleWarnings } from "@/lib/bundles/types";

export async function GET() {
  // Lecture publique des bundles actifs (utilisé pour la page publique aussi)
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
  return NextResponse.json(bundles);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    slug,
    name,
    description,
    icon,
    color,
    order,
    lifeEventCategory,
    showOnOnboarding,
    vocabularyTags,
    eligibilityQuestions,
    warnings,
  } = body || {};
  if (!slug) return NextResponse.json({ error: "slug requis" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name requis" }, { status: 400 });

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const dup = await prisma.documentBundle.findUnique({ where: { slug: cleanSlug } });
  if (dup) {
    return NextResponse.json({ error: `slug "${cleanSlug}" déjà utilisé` }, { status: 409 });
  }

  const created = await prisma.documentBundle.create({
    data: {
      slug: cleanSlug,
      name,
      description: description || null,
      icon: icon || null,
      color: color || "#7C3AED",
      order: typeof order === "number" ? order : 0,
      lifeEventCategory: typeof lifeEventCategory === "string" ? lifeEventCategory : null,
      showOnOnboarding: !!showOnOnboarding,
      vocabularyTags: parseVocabularyTags(vocabularyTags) as unknown as Prisma.InputJsonValue,
      eligibilityQuestions: parseEligibilityQuestions(eligibilityQuestions) as unknown as Prisma.InputJsonValue,
      warnings: parseBundleWarnings(warnings) as unknown as Prisma.InputJsonValue,
      createdBy: auth.user.id,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
