import { NextResponse } from "next/server";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { guardFormationOrg, forbidden } from "@/lib/formations/guard";
import {
  buildTrainingWriteData,
  syncTrainingTags,
  visibilityError,
} from "@/lib/formations/org-mutations";
import { trainingUpdatePayloadSchema, trainingSubmitSchema } from "@/lib/formations/schemas";

const json = { "Content-Type": "application/json; charset=utf-8" };

async function loadOwned(id: string) {
  const training = await prisma.training.findUnique({ where: { id } });
  if (!training) return { error: NextResponse.json({ error: "Formation introuvable" }, { status: 404, headers: json }) };
  const guard = await guardFormationOrg(training.organizationId);
  if (!guard.ok) return { error: guard.response };
  return { training, guard };
}

/** Met à jour une formation (champs + tags + visibilité, soumission optionnelle). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) return auth.error;
  const block = await ensureWriteAllowed();
  if (block) return block;

  const { id } = await params;
  const owned = await loadOwned(id);
  if ("error" in owned) return owned.error;
  const { training, guard } = owned;
  if (!guard.can.create) return forbidden("Modification non autorisée.");

  const body = await req.json().catch(() => null);
  const parsed = trainingUpdatePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400, headers: json },
    );
  }
  const { training: input, submit } = parsed.data;

  const visErr = visibilityError(input.visibility, guard.can);
  if (visErr) return NextResponse.json({ error: visErr }, { status: 403, headers: json });

  const data = buildTrainingWriteData(input);
  if (input.visibility) data.visibility = input.visibility;

  const now = new Date();
  if (submit) {
    if (!guard.can.submit) return forbidden("Soumission non autorisée.");
    // Validation de complétude sur l'état fusionné.
    const merged = {
      title: input.title ?? training.title,
      shortDescription: input.shortDescription ?? training.shortDescription ?? "",
      description: input.description ?? training.description ?? "",
      categoryId: input.categoryId ?? training.categoryId ?? "",
      level: input.level ?? training.level,
      format: input.format ?? training.format,
      visibility: input.visibility ?? training.visibility,
      priceType: input.priceType ?? training.priceType,
      priceAmount: input.priceAmount ?? training.priceAmount ?? null,
      currency: input.currency ?? training.currency,
      contactEmail: input.contactEmail ?? training.contactEmail ?? "",
    };
    const check = trainingSubmitSchema.safeParse(merged);
    if (!check.success) {
      return NextResponse.json(
        { error: check.error.issues[0]?.message ?? "Formation incomplète", incomplete: true },
        { status: 400, headers: json },
      );
    }
    if (guard.can.publishDirectly) {
      data.status = "published";
      data.publishedAt = now;
      if (!training.approvedAt) data.approvedAt = now;
    } else {
      data.status = "pending_review";
      data.submittedAt = now;
    }
  }

  const updated = await prisma.training.update({ where: { id }, data });
  if (input.tagSlugs) await syncTrainingTags(id, input.tagSlugs);

  await logActivity(auth.user.id, submit ? "submitted" : "updated", "formation", updated.title, updated.id);

  return NextResponse.json({ id: updated.id, slug: updated.slug, status: updated.status }, { headers: json });
}

/** Supprime une formation (brouillon uniquement). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) return auth.error;
  const block = await ensureWriteAllowed();
  if (block) return block;

  const { id } = await params;
  const owned = await loadOwned(id);
  if ("error" in owned) return owned.error;
  const { training, guard } = owned;
  if (!guard.can.create) return forbidden();
  if (training.status !== "draft") {
    return NextResponse.json(
      { error: "Seuls les brouillons peuvent être supprimés." },
      { status: 409, headers: json },
    );
  }

  await prisma.training.delete({ where: { id } });
  await logActivity(auth.user.id, "deleted", "formation", training.title, id);
  return NextResponse.json({ ok: true }, { headers: json });
}
