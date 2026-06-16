import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { guardFormationOrg, forbidden } from "@/lib/formations/guard";
import { trainingSubmitSchema } from "@/lib/formations/schemas";

const json = { "Content-Type": "application/json; charset=utf-8" };

const schema = z.object({ action: z.enum(["submit", "withdraw", "archive"]) });

/** Transitions de statut pilotées par l'organisation. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) return auth.error;
  const block = await ensureWriteAllowed();
  if (block) return block;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400, headers: json });
  }

  const training = await prisma.training.findUnique({ where: { id } });
  if (!training) return NextResponse.json({ error: "Formation introuvable" }, { status: 404, headers: json });
  const guard = await guardFormationOrg(training.organizationId);
  if (!guard.ok) return guard.response;
  if (!guard.can.create) return forbidden();

  const now = new Date();

  if (parsed.data.action === "submit") {
    if (!guard.can.submit) return forbidden("Soumission non autorisée.");
    const check = trainingSubmitSchema.safeParse({
      title: training.title,
      shortDescription: training.shortDescription ?? "",
      description: training.description ?? "",
      categoryId: training.categoryId ?? "",
      level: training.level,
      format: training.format,
      visibility: training.visibility,
      priceType: training.priceType,
      priceAmount: training.priceAmount,
      currency: training.currency,
      contactEmail: training.contactEmail ?? "",
    });
    if (!check.success) {
      return NextResponse.json(
        { error: check.error.issues[0]?.message ?? "Formation incomplète", incomplete: true },
        { status: 400, headers: json },
      );
    }
    const published = guard.can.publishDirectly;
    await prisma.training.update({
      where: { id },
      data: published
        ? { status: "published", publishedAt: now, approvedAt: training.approvedAt ?? now }
        : { status: "pending_review", submittedAt: now },
    });
    await logActivity(auth.user.id, "submitted", "formation", training.title, id);
    return NextResponse.json({ ok: true, status: published ? "published" : "pending_review" }, { headers: json });
  }

  if (parsed.data.action === "withdraw") {
    await prisma.training.update({ where: { id }, data: { status: "draft" } });
    await logActivity(auth.user.id, "updated", "formation", training.title, id, "withdraw");
    return NextResponse.json({ ok: true, status: "draft" }, { headers: json });
  }

  // archive
  await prisma.training.update({ where: { id }, data: { status: "archived", archivedAt: now } });
  await logActivity(auth.user.id, "archived", "formation", training.title, id);
  return NextResponse.json({ ok: true, status: "archived" }, { headers: json });
}
