import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { enrollmentSchema } from "@/lib/formations/schemas";
import { ACTIVE_ENROLLMENT_STATUSES, OPEN_SESSION_STATUSES } from "@/lib/formations/constants";
import { sendEnrollmentEmail } from "@/lib/formations/emails";

const json = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Inscription publique à une session. Vérifie la publication/visibilité, la
 * capacité (liste d'attente si activée), déduplique par email. La validation
 * équipe + emails sont gérés côté organisation (Phase 5).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = enrollmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400, headers: json },
    );
  }
  const data = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: data.sessionId },
    include: { training: { select: { id: true, slug: true, status: true, visibility: true, title: true } } },
  });
  if (!session || !session.training) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404, headers: json });
  }
  if (session.training.status !== "published") {
    return NextResponse.json({ error: "Formation non disponible" }, { status: 403, headers: json });
  }
  if (!OPEN_SESSION_STATUSES.includes(session.status as (typeof OPEN_SESSION_STATUSES)[number])) {
    return NextResponse.json(
      { error: "Les inscriptions pour cette session ne sont pas ouvertes." },
      { status: 409, headers: json },
    );
  }
  if (session.registrationDeadline && session.registrationDeadline < new Date()) {
    return NextResponse.json(
      { error: "La date limite d'inscription est dépassée." },
      { status: 409, headers: json },
    );
  }

  const email = data.citizenEmail.trim().toLowerCase();

  // Doublon ?
  const dup = await prisma.trainingEnrollment.findFirst({
    where: {
      sessionId: session.id,
      citizenEmailNormalized: email,
      status: { in: ACTIVE_ENROLLMENT_STATUSES },
    },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json(
      { error: "Une inscription existe déjà pour cet email sur cette session." },
      { status: 409, headers: json },
    );
  }

  // Capacité → liste d'attente ou refus.
  let status: string = session.requiresManualApproval ? "requested" : "accepted";
  if (session.capacity != null) {
    const active = await prisma.trainingEnrollment.count({
      where: { sessionId: session.id, status: { in: ACTIVE_ENROLLMENT_STATUSES } },
    });
    if (active >= session.capacity) {
      if (session.waitlistEnabled) {
        status = "waitlisted";
      } else {
        return NextResponse.json(
          { error: "Cette session est complète." },
          { status: 409, headers: json },
        );
      }
    }
  }

  const authSession = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const userId = authSession?.user?.id ?? null;

  try {
    const enrollment = await prisma.trainingEnrollment.create({
      data: {
        sessionId: session.id,
        trainingId: session.training.id,
        organizationId: session.organizationId,
        userId,
        citizenName: data.citizenName,
        citizenEmail: data.citizenEmail,
        citizenEmailNormalized: email,
        citizenPhone: data.citizenPhone,
        message: data.message,
        motivation: data.motivation,
        status,
        confirmationToken: nanoid(32),
        locale: data.locale ?? "fr",
        acceptedAt: status === "accepted" ? new Date() : null,
      },
    });

    if (userId) {
      await logActivity(userId, "enrolled", "enrollment", session.training.title, enrollment.id);
    }

    const org = await prisma.formationOrganization.findUnique({
      where: { id: session.organizationId },
      select: { name: true },
    });
    await sendEnrollmentEmail({
      to: email,
      citizenName: data.citizenName,
      trainingTitle: session.training.title,
      trainingSlug: session.training.slug,
      orgName: org?.name ?? "Docbel",
      status,
      sessionLabel: session.startsAt ? session.startsAt.toLocaleDateString("fr-BE") : null,
    });

    return NextResponse.json(
      { ok: true, status, enrollmentId: enrollment.id },
      { status: 201, headers: json },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "Une inscription existe déjà pour cet email sur cette session." },
        { status: 409, headers: json },
      );
    }
    console.error("enroll error", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500, headers: json });
  }
}
