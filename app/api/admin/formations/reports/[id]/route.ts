import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { logActivity } from "@/lib/activity-logger";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const bodySchema = z.object({
  status: z.enum(["new", "in_progress", "resolved", "rejected"]).optional(),
  adminNote: z.string().trim().max(2000).optional(),
  actionTaken: z.string().trim().max(2000).optional(),
});

/**
 * PATCH /api/admin/formations/reports/[id] — traitement d'un signalement.
 * Passe resolvedById / resolvedAt quand le statut devient resolved | rejected.
 */
export async function PATCH(
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
  const { status, adminNote, actionTaken } = parsed.data;

  const report = await prisma.trainingReport.findUnique({
    where: { id },
    select: { id: true, trainingId: true },
  });
  if (!report) {
    return NextResponse.json(
      { error: "Signalement introuvable" },
      { status: 404, headers: jsonHeaders },
    );
  }

  const data: Record<string, unknown> = {};
  if (status !== undefined) data.status = status;
  if (adminNote !== undefined) data.adminNote = adminNote;
  if (actionTaken !== undefined) data.actionTaken = actionTaken;

  if (status === "resolved" || status === "rejected") {
    data.resolvedById = auth.user.id;
    data.resolvedAt = new Date();
  } else if (status === "new" || status === "in_progress") {
    // Réouverture : on efface la résolution.
    data.resolvedById = null;
    data.resolvedAt = null;
  }

  try {
    const updated = await prisma.trainingReport.update({
      where: { id },
      data,
      select: { id: true, status: true },
    });

    await logActivity(
      auth.user.id,
      status === "rejected" ? "rejected" : status === "resolved" ? "approved" : "updated",
      "formation_report",
      `Signalement ${report.id.slice(0, 8)}`,
      report.id,
      [status ? `statut=${status}` : null, actionTaken ? `action=${actionTaken}` : null]
        .filter(Boolean)
        .join(" · ") || undefined,
    );

    return NextResponse.json({ ok: true, report: updated }, { headers: jsonHeaders });
  } catch (err) {
    console.error("[admin/formations/reports] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
