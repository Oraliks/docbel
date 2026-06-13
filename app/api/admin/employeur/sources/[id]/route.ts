import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await context.params;

  const existing = await prisma.employerLegalSource.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: jsonHeaders });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: jsonHeaders });
  }
  const b = body as {
    title?: string;
    institution?: string;
    url?: string;
    contentSummary?: string;
    reliability?: string;
    active?: boolean;
    markVerified?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (b.title !== undefined) data.title = b.title.trim();
  if (b.institution !== undefined) data.institution = b.institution.trim();
  if (b.url !== undefined) data.url = b.url.trim();
  if (b.contentSummary !== undefined) data.contentSummary = b.contentSummary.trim() || null;
  if (b.reliability !== undefined) data.reliability = b.reliability || null;
  if (b.active !== undefined) data.active = b.active;
  if (b.markVerified) data.lastCheckedAt = new Date();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400, headers: jsonHeaders });
  }

  await prisma.employerLegalSource.update({ where: { id }, data });
  await logActivity(
    auth.user.email,
    "updated",
    "employer",
    `Source ${existing.code}`,
    id,
    b.markVerified ? "vérifiée" : undefined
  );
  return NextResponse.json({ ok: true }, { headers: jsonHeaders });
}
