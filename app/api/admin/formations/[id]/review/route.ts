import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { logActivity } from "@/lib/activity-logger";
import { prisma } from "@/lib/prisma";
import { reviewActionSchema } from "@/lib/formations/schemas";

export const runtime = "nodejs";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * POST /api/admin/formations/[id]/review — décision de validation admin.
 * Transitions de statut + horodatage + traçabilité (reviewedById + activity).
 * Les actions reject / request_changes exigent une note en production.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const { id } = await params;
  const parsed = reviewActionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body invalide", issues: parsed.error.flatten() },
      { status: 400, headers: jsonHeaders },
    );
  }
  const { action, note } = parsed.data;

  // Note obligatoire en prod pour un refus / une demande de correction.
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && (action === "reject" || action === "request_changes") && !note?.trim()) {
    return NextResponse.json(
      { error: "Une note est requise pour cette action." },
      { status: 400, headers: jsonHeaders },
    );
  }

  const training = await prisma.training.findUnique({
    where: { id },
    select: { id: true, title: true, approvedAt: true },
  });
  if (!training) {
    return NextResponse.json(
      { error: "Formation introuvable" },
      { status: 404, headers: jsonHeaders },
    );
  }

  const now = new Date();
  const data: Record<string, unknown> = { reviewedById: auth.user.id };
  let logAction:
    | "approved"
    | "published"
    | "changes_requested"
    | "rejected"
    | "suspended"
    | "archived"
    | "updated" = "updated";

  switch (action) {
    case "approve":
      data.status = "approved";
      data.approvedAt = now;
      logAction = "approved";
      break;
    case "publish":
      data.status = "published";
      data.publishedAt = now;
      if (!training.approvedAt) data.approvedAt = now;
      logAction = "published";
      break;
    case "request_changes":
      data.status = "changes_requested";
      data.adminReviewNote = note ?? null;
      logAction = "changes_requested";
      break;
    case "reject":
      data.status = "rejected";
      data.rejectedReason = note ?? null;
      logAction = "rejected";
      break;
    case "suspend":
      data.status = "suspended";
      data.suspendedAt = now;
      logAction = "suspended";
      break;
    case "unsuspend":
      data.status = "published";
      logAction = "published";
      break;
    case "archive":
      data.status = "archived";
      data.archivedAt = now;
      logAction = "archived";
      break;
  }

  try {
    const updated = await prisma.training.update({
      where: { id },
      data,
      select: { id: true, status: true, visibility: true },
    });

    await logActivity(
      auth.user.id,
      logAction,
      "formation",
      training.title,
      training.id,
      note?.trim() ? note.trim() : `action=${action}`,
    );

    return NextResponse.json({ ok: true, training: updated }, { headers: jsonHeaders });
  } catch (err) {
    console.error("[admin/formations/review] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
