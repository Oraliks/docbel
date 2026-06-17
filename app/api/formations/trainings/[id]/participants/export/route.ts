import { NextResponse } from "next/server";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { guardFormationOrg, forbidden } from "@/lib/formations/guard";
import { ENROLLMENT_STATUS_LABELS, type TrainingEnrollmentStatus } from "@/lib/formations/constants";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Cellule CSV protégée contre l'injection de formules (=, +, -, @). */
function cell(v: string | null | undefined): string {
  const s = (v ?? "").toString();
  const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** Export CSV des participants d'une formation (permission canExportParticipants). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const training = await prisma.training.findUnique({
    where: { id },
    select: { organizationId: true, title: true },
  });
  if (!training) return NextResponse.json({ error: "Formation introuvable" }, { status: 404, headers: json });

  const guard = await guardFormationOrg(training.organizationId);
  if (!guard.ok) return guard.response;
  if (!guard.can.exportParticipants) return forbidden("Export non autorisé pour votre organisation.");

  const enrollments = await prisma.trainingEnrollment.findMany({
    where: { trainingId: id },
    include: { session: { select: { startsAt: true, city: true, mode: true } } },
    orderBy: { requestedAt: "asc" },
  });

  const header = [
    "Formation",
    "Session",
    "Nom",
    "Email",
    "Téléphone",
    "Statut",
    "Date inscription",
    "Présence",
    "Attestation",
    "Note organisation",
  ];
  const rows = enrollments.map((e) =>
    [
      training.title,
      e.session.startsAt ? e.session.startsAt.toISOString().slice(0, 10) : (e.session.mode ?? ""),
      e.citizenName,
      e.citizenEmail,
      e.citizenPhone,
      ENROLLMENT_STATUS_LABELS[e.status as TrainingEnrollmentStatus] ?? e.status,
      e.requestedAt.toISOString().slice(0, 10),
      e.status === "present" ? "Présent" : e.status === "absent" ? "Absent" : "",
      e.certificateId ? "Oui" : "",
      e.organizationNote,
    ]
      .map(cell)
      .join(";"),
  );
  const csv = "﻿" + [header.map(cell).join(";"), ...rows].join("\r\n");

  await logActivity(auth.user.id, "updated", "enrollment", training.title, id, "export_participants");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="participants-${id}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
