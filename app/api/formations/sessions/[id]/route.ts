import { NextResponse } from "next/server";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { guardFormationOrg, forbidden } from "@/lib/formations/guard";
import { sessionUpsertSchema } from "@/lib/formations/schemas";
import { toDate } from "@/lib/formations/org-mutations";

const json = { "Content-Type": "application/json; charset=utf-8" };

async function loadOwnedSession(id: string) {
  const session = await prisma.trainingSession.findUnique({ where: { id } });
  if (!session) return { error: NextResponse.json({ error: "Session introuvable" }, { status: 404, headers: json }) };
  const guard = await guardFormationOrg(session.organizationId);
  if (!guard.ok) return { error: guard.response };
  return { session, guard };
}

/** Met à jour / annule une session. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) return auth.error;
  const block = await ensureWriteAllowed();
  if (block) return block;

  const { id } = await params;
  const owned = await loadOwnedSession(id);
  if ("error" in owned) return owned.error;
  if (!owned.guard.can.manageSessions) return forbidden("Gestion des sessions non autorisée.");

  const body = await req.json().catch(() => null);
  const parsed = sessionUpsertSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400, headers: json },
    );
  }
  const s = parsed.data;
  const has = (k: string) => Object.prototype.hasOwnProperty.call(s, k);

  const data: Record<string, unknown> = {};
  if (has("title")) data.title = s.title ?? null;
  if (has("status")) data.status = s.status;
  if (has("mode")) data.mode = s.mode;
  if (has("startsAt")) data.startsAt = toDate(s.startsAt);
  if (has("endsAt")) data.endsAt = toDate(s.endsAt);
  if (has("timezone")) data.timezone = s.timezone;
  if (has("locationName")) data.locationName = s.locationName ?? null;
  if (has("address")) data.address = s.address ?? null;
  if (has("city")) data.city = s.city ?? null;
  if (has("region")) data.region = s.region ?? null;
  if (has("onlineUrl")) data.onlineUrl = s.onlineUrl || null;
  if (has("capacity")) data.capacity = s.capacity ?? null;
  if (has("waitlistEnabled")) data.waitlistEnabled = s.waitlistEnabled;
  if (has("registrationDeadline")) data.registrationDeadline = toDate(s.registrationDeadline);
  if (has("requiresManualApproval")) data.requiresManualApproval = s.requiresManualApproval;
  if (has("instructions")) data.instructions = s.instructions ?? null;
  if (has("contactEmail")) data.contactEmail = s.contactEmail || null;

  await prisma.trainingSession.update({ where: { id }, data });
  await logActivity(auth.user.id, "updated", "training_session", id, id);
  return NextResponse.json({ ok: true }, { headers: json });
}

/** Supprime une session (uniquement si aucune inscription). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) return auth.error;
  const block = await ensureWriteAllowed();
  if (block) return block;

  const { id } = await params;
  const owned = await loadOwnedSession(id);
  if ("error" in owned) return owned.error;
  if (!owned.guard.can.manageSessions) return forbidden();

  const count = await prisma.trainingEnrollment.count({ where: { sessionId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: "Impossible de supprimer une session avec des inscriptions. Annulez-la plutôt." },
      { status: 409, headers: json },
    );
  }

  await prisma.trainingSession.delete({ where: { id } });
  await logActivity(auth.user.id, "deleted", "training_session", id, id);
  return NextResponse.json({ ok: true }, { headers: json });
}
