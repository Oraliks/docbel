import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { logActivity } from "@/lib/activity-logger";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * POST /api/admin/formations/[id]/badges — attribution / retrait des
 * distinctions PILOTÉES PAR L'ADMIN.
 *   - `flag` : flag officiel (isVerifiedByDocbel / isDocbelRecommended /
 *     isFeatured) ⇒ set booléen `grant`.
 *   - `badgeSlug` : attribution / retrait d'un TrainingBadge contrôlé par
 *     l'admin (upsert / delete de la relation, avec grantedById).
 */
const bodySchema = z
  .object({
    flag: z
      .enum(["isVerifiedByDocbel", "isDocbelRecommended", "isFeatured"])
      .optional(),
    badgeSlug: z.string().trim().min(1).optional(),
    grant: z.boolean(),
  })
  .refine((d) => !!d.flag || !!d.badgeSlug, {
    message: "flag ou badgeSlug requis",
  });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body invalide", issues: parsed.error.flatten() },
      { status: 400, headers: jsonHeaders },
    );
  }
  const { flag, badgeSlug, grant } = parsed.data;

  const training = await prisma.training.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!training) {
    return NextResponse.json(
      { error: "Formation introuvable" },
      { status: 404, headers: jsonHeaders },
    );
  }

  try {
    if (flag) {
      await prisma.training.update({
        where: { id },
        data: { [flag]: grant },
      });
      await logActivity(
        auth.user.id,
        "updated",
        "formation",
        training.title,
        training.id,
        `${flag}=${grant}`,
      );
      return NextResponse.json({ ok: true }, { headers: jsonHeaders });
    }

    // Badge contrôlé : seul l'admin peut l'attribuer (controlledByAdmin).
    const badge = await prisma.trainingBadge.findUnique({
      where: { slug: badgeSlug! },
      select: { id: true, name: true, controlledByAdmin: true },
    });
    if (!badge) {
      return NextResponse.json(
        { error: "Badge introuvable" },
        { status: 404, headers: jsonHeaders },
      );
    }

    if (grant) {
      await prisma.trainingBadgeOnTraining.upsert({
        where: { trainingId_badgeId: { trainingId: id, badgeId: badge.id } },
        create: { trainingId: id, badgeId: badge.id, grantedById: auth.user.id },
        update: { grantedById: auth.user.id, grantedAt: new Date() },
      });
    } else {
      await prisma.trainingBadgeOnTraining
        .delete({
          where: { trainingId_badgeId: { trainingId: id, badgeId: badge.id } },
        })
        .catch(() => null);
    }

    await logActivity(
      auth.user.id,
      "updated",
      "formation",
      training.title,
      training.id,
      `badge ${badge.name} ${grant ? "attribué" : "retiré"}`,
    );

    return NextResponse.json({ ok: true }, { headers: jsonHeaders });
  } catch (err) {
    console.error("[admin/formations/badges] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
