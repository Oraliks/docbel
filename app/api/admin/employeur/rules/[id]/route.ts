import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await context.params;

  const existing = await prisma.employerRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: jsonHeaders });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: jsonHeaders });
  }
  const b = body as {
    active?: boolean;
    severity?: string;
    sourceCode?: string;
    internalNote?: string;
  };

  // Valeurs effectives après fusion (corps > existant).
  const effectiveSource = b.sourceCode !== undefined ? b.sourceCode : existing.sourceCode;
  const effectiveNote = b.internalNote !== undefined ? b.internalNote : existing.internalNote;
  const willBeActive = b.active !== undefined ? b.active : existing.active;

  // Critère 8 : pas de publication (activation) sans source ni justification interne.
  if (willBeActive && !effectiveSource?.trim() && !effectiveNote?.trim()) {
    return NextResponse.json(
      {
        error:
          "RULE_SOURCE_MISSING : cette règle n'a pas de source officielle liée. Elle ne peut pas être publiée sans source ou justification interne.",
      },
      { status: 422, headers: jsonHeaders }
    );
  }

  const data: Record<string, unknown> = {};
  if (b.active !== undefined) data.active = b.active;
  if (b.severity !== undefined) data.severity = b.severity;
  if (b.sourceCode !== undefined) data.sourceCode = b.sourceCode.trim() || null;
  if (b.internalNote !== undefined) data.internalNote = b.internalNote.trim() || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400, headers: jsonHeaders });
  }

  await prisma.employerRule.update({ where: { id }, data });
  await logActivity(
    auth.user.email,
    b.active === true ? "published" : b.active === false ? "unpublished" : "updated",
    "employer",
    `Règle ${existing.code}`,
    id
  );
  return NextResponse.json({ ok: true }, { headers: jsonHeaders });
}
