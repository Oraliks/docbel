import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { logActivity } from "@/lib/activity-logger";
import { prisma } from "@/lib/prisma";
import { tagSchema } from "@/lib/formations/schemas";
import { slugify } from "../../categories/route";

export const runtime = "nodejs";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/** PATCH /api/admin/formations/tags/[id] — mise à jour partielle. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const { id } = await params;
  const parsed = tagSchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body invalide", issues: parsed.error.flatten() },
      { status: 400, headers: jsonHeaders },
    );
  }
  const d = parsed.data;

  const existing = await prisma.trainingTag.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Tag introuvable" },
      { status: 404, headers: jsonHeaders },
    );
  }

  const data: Record<string, unknown> = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.slug !== undefined) data.slug = d.slug.trim() || slugify(d.name ?? existing.name);
  if (d.type !== undefined) data.type = d.type || null;
  if (d.isOrientationTag !== undefined) data.isOrientationTag = d.isOrientationTag;

  try {
    const tag = await prisma.trainingTag.update({ where: { id }, data });
    await logActivity(
      auth.user.id,
      "updated",
      "category",
      tag.name,
      tag.id,
      "tag de formation",
    );
    return NextResponse.json({ ok: true, tag }, { headers: jsonHeaders });
  } catch (err) {
    console.error("[admin/formations/tags PATCH] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}

/** DELETE /api/admin/formations/tags/[id]. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const { id } = await params;
  const existing = await prisma.trainingTag.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Tag introuvable" },
      { status: 404, headers: jsonHeaders },
    );
  }

  try {
    await prisma.trainingTag.delete({ where: { id } });
    await logActivity(
      auth.user.id,
      "deleted",
      "category",
      existing.name,
      existing.id,
      "tag de formation",
    );
    return NextResponse.json({ ok: true }, { headers: jsonHeaders });
  } catch (err) {
    console.error("[admin/formations/tags DELETE] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
