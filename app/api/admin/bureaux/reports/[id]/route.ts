import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const VALID = ["pending", "resolved", "dismissed"] as const;

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: jsonHeaders });
  }
  const raw = body as Record<string, unknown>;
  const status = (raw.status as string) ?? "";
  const adminNotes = (raw.adminNotes as string) ?? null;

  if (!VALID.includes(status as (typeof VALID)[number])) {
    return NextResponse.json(
      { error: `status invalide (${VALID.join(", ")})` },
      { status: 400, headers: jsonHeaders }
    );
  }

  const updated = await withDbRetry(() =>
    prisma.bureauReport.update({
      where: { id },
      data: {
        status,
        adminNotes,
        resolvedBy: status === "pending" ? null : auth.user.id,
        resolvedAt: status === "pending" ? null : new Date(),
      },
    })
  );

  await logActivity(
    auth.user.name,
    "updated",
    "setting",
    `Report bureau ${updated.bureauId}`,
    updated.id,
    `status: ${status}`
  );

  return NextResponse.json({ ok: true }, { headers: jsonHeaders });
}
