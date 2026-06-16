import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { logActivity } from "@/lib/activity-logger";
import { prisma } from "@/lib/prisma";
import { tagSchema } from "@/lib/formations/schemas";
import { slugify } from "../categories/route";

export const runtime = "nodejs";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/** POST /api/admin/formations/tags — création d'un tag. */
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const parsed = tagSchema.safeParse(await req.json().catch(() => ({})));
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
    const existing = await prisma.trainingTag.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "Un tag avec ce slug existe déjà." },
        { status: 409, headers: jsonHeaders },
      );
    }

    const tag = await prisma.trainingTag.create({
      data: {
        slug,
        name: d.name,
        type: d.type ?? null,
        ...(d.isOrientationTag !== undefined
          ? { isOrientationTag: d.isOrientationTag }
          : {}),
      },
    });

    await logActivity(
      auth.user.id,
      "created",
      "category",
      tag.name,
      tag.id,
      "tag de formation",
    );

    return NextResponse.json({ ok: true, tag }, { headers: jsonHeaders });
  } catch (err) {
    console.error("[admin/formations/tags POST] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
