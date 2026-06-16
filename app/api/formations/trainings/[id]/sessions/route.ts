import { NextResponse } from "next/server";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { guardFormationOrg, forbidden } from "@/lib/formations/guard";
import { sessionUpsertSchema } from "@/lib/formations/schemas";
import { toDate } from "@/lib/formations/org-mutations";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Ajoute une session à une formation. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) return auth.error;
  const block = await ensureWriteAllowed();
  if (block) return block;

  const { id } = await params;
  const training = await prisma.training.findUnique({ where: { id }, select: { id: true, organizationId: true, title: true } });
  if (!training) return NextResponse.json({ error: "Formation introuvable" }, { status: 404, headers: json });
  const guard = await guardFormationOrg(training.organizationId);
  if (!guard.ok) return guard.response;
  if (!guard.can.manageSessions) return forbidden("Gestion des sessions non autorisée.");

  const body = await req.json().catch(() => null);
  const parsed = sessionUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400, headers: json },
    );
  }
  const s = parsed.data;

  const session = await prisma.trainingSession.create({
    data: {
      trainingId: training.id,
      organizationId: training.organizationId,
      title: s.title ?? null,
      status: s.status ?? "scheduled",
      mode: s.mode ?? "online",
      startsAt: toDate(s.startsAt),
      endsAt: toDate(s.endsAt),
      timezone: s.timezone ?? "Europe/Brussels",
      locationName: s.locationName ?? null,
      address: s.address ?? null,
      city: s.city ?? null,
      region: s.region ?? null,
      onlineUrl: s.onlineUrl || null,
      capacity: s.capacity ?? null,
      waitlistEnabled: s.waitlistEnabled ?? false,
      registrationDeadline: toDate(s.registrationDeadline),
      requiresManualApproval: s.requiresManualApproval ?? true,
      instructions: s.instructions ?? null,
      contactEmail: s.contactEmail || null,
    },
  });

  await logActivity(auth.user.id, "created", "training_session", training.title, session.id);
  return NextResponse.json({ id: session.id }, { status: 201, headers: json });
}
