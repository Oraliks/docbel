import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { logActivity } from "@/lib/activity-logger";
import { updateReport } from "@/lib/reports/engine";

const json = { "Content-Type": "application/json; charset=utf-8" };

const bodySchema = z.object({
  status: z.enum(["pending", "in_progress", "resolved", "dismissed"]).optional(),
  adminNote: z.string().trim().max(2000).optional(),
  actionTaken: z.string().trim().max(2000).optional(),
});

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
      { status: 400, headers: json },
    );
  }

  const result = await updateReport({
    id,
    status: parsed.data.status,
    adminNote: parsed.data.adminNote,
    actionTaken: parsed.data.actionTaken,
    resolvedBy: auth.user.email || auth.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: json });
  }

  await logActivity(
    auth.user.name,
    parsed.data.status === "resolved" ? "approved" : parsed.data.status === "dismissed" ? "rejected" : "updated",
    "report",
    `Signalement ${result.report.type} ${id.slice(0, 8)}`,
    id,
    parsed.data.status ? `statut=${parsed.data.status}` : undefined,
  );

  return NextResponse.json({ ok: true, report: result.report }, { headers: json });
}
