import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { logActivity } from "@/lib/activity-logger";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/formations/schemas";
import { slugify } from "../route";

export const runtime = "nodejs";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/** PATCH /api/admin/formations/categories/[id] — mise à jour partielle. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const { id } = await params;
  const parsed = categorySchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body invalide", issues: parsed.error.flatten() },
      { status: 400, headers: jsonHeaders },
    );
  }
  const d = parsed.data;

  const existing = await prisma.trainingCategory.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Catégorie introuvable" },
      { status: 404, headers: jsonHeaders },
    );
  }

  const data: Record<string, unknown> = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.slug !== undefined) data.slug = d.slug.trim() || slugify(d.name ?? existing.name);
  if (d.description !== undefined) data.description = d.description || null;
  if (d.icon !== undefined) data.icon = d.icon || null;
  if (d.color !== undefined) data.color = d.color;
  if (d.parentId !== undefined) data.parentId = d.parentId;
  if (d.isActive !== undefined) data.isActive = d.isActive;
  if (d.order !== undefined) data.order = d.order;

  try {
    const category = await prisma.trainingCategory.update({ where: { id }, data });
    await logActivity(
      auth.user.id,
      "updated",
      "category",
      category.name,
      category.id,
      "catégorie de formation",
    );
    return NextResponse.json({ ok: true, category }, { headers: jsonHeaders });
  } catch (err) {
    console.error("[admin/formations/categories PATCH] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}

/** DELETE /api/admin/formations/categories/[id]. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const { id } = await params;
  const existing = await prisma.trainingCategory.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Catégorie introuvable" },
      { status: 404, headers: jsonHeaders },
    );
  }

  try {
    // Les formations rattachées passent categoryId=null (onDelete: SetNull).
    await prisma.trainingCategory.delete({ where: { id } });
    await logActivity(
      auth.user.id,
      "deleted",
      "category",
      existing.name,
      existing.id,
      "catégorie de formation",
    );
    return NextResponse.json({ ok: true }, { headers: jsonHeaders });
  } catch (err) {
    console.error("[admin/formations/categories DELETE] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
