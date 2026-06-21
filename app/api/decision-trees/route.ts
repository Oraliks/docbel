/// Decision Builder — collection : liste + création d'arbres.
/// Toutes les routes admin-only (requireAdminAuth).

import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { slugify } from "@/lib/news/slug";
import { logActivity } from "@/lib/activity-logger";
import { emptyTreeContent } from "@/lib/decision-builder/schema";
import { jsonError, jsonOk } from "@/lib/decision-builder/api-helpers";

/// GET — liste des arbres (métadonnées seulement, pas le contenu volumineux).
export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const trees = await withDbRetry(() =>
    prisma.decisionTree.findMany({
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        segment: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { revisions: true } },
      },
    }),
  );
  return jsonOk(trees);
}

/// POST — crée un nouvel arbre vide (draft). Body : { title, slug?, segment?, description? }.
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return jsonError(400, "Le titre est requis.");

  const rawSlug = typeof body.slug === "string" && body.slug.trim() ? body.slug : title;
  const slug = slugify(rawSlug);
  if (!slug) return jsonError(400, "Slug invalide.");

  const segment =
    typeof body.segment === "string" && body.segment.trim()
      ? body.segment.trim()
      : "chomage";
  const description =
    typeof body.description === "string" ? body.description.trim() : null;

  // Unicité du slug.
  const existing = await withDbRetry(() =>
    prisma.decisionTree.findUnique({ where: { slug }, select: { id: true } }),
  );
  if (existing) {
    return jsonError(409, `Un arbre avec le slug "${slug}" existe déjà.`, {
      code: "slug_conflict",
    });
  }

  const created = await withDbRetry(() =>
    prisma.decisionTree.create({
      data: {
        slug,
        title,
        description,
        segment,
        status: "draft",
        draftContent: emptyTreeContent() as unknown as Prisma.InputJsonValue,
        createdBy: auth.user.id,
        updatedBy: auth.user.id,
      },
      select: { id: true, slug: true, title: true, status: true },
    }),
  );

  await logActivity(auth.user.id, "created", "decision_tree", title, created.id);

  return jsonOk(created, 201);
}
