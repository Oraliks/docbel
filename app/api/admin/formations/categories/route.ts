import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { logActivity } from "@/lib/activity-logger";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/formations/schemas";

export const runtime = "nodejs";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/** Slug a-z0-9 + tirets, dérivé du nom si non fourni. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les diacritiques combinants
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** POST /api/admin/formations/categories — création d'une catégorie. */
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const parsed = categorySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body invalide", issues: parsed.error.flatten() },
      { status: 400, headers: jsonHeaders },
    );
  }
  const d = parsed.data;
  const slug = d.slug?.trim() || slugify(d.name);
  if (!slug) {
    return NextResponse.json(
      { error: "Slug invalide" },
      { status: 400, headers: jsonHeaders },
    );
  }

  try {
    const existing = await prisma.trainingCategory.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "Une catégorie avec ce slug existe déjà." },
        { status: 409, headers: jsonHeaders },
      );
    }

    const category = await prisma.trainingCategory.create({
      data: {
        slug,
        name: d.name,
        description: d.description ?? null,
        icon: d.icon ?? null,
        ...(d.color ? { color: d.color } : {}),
        parentId: d.parentId ?? null,
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        ...(d.order !== undefined ? { order: d.order } : {}),
      },
    });

    await logActivity(
      auth.user.id,
      "created",
      "category",
      category.name,
      category.id,
      "catégorie de formation",
    );

    return NextResponse.json({ ok: true, category }, { headers: jsonHeaders });
  } catch (err) {
    console.error("[admin/formations/categories POST] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
