import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployerOrAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/** Charge un brouillon SI l'utilisateur en est propriétaire (ou admin), sinon null. */
async function loadOwned(id: string, userId: string, isAdmin: boolean) {
  const draft = await prisma.documentDraft.findUnique({ where: { id } });
  if (!draft) return null;
  if (!isAdmin && draft.userId !== userId) return null;
  return draft;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireEmployerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await context.params;

  const draft = await loadOwned(id, auth.user.id, auth.user.isAdmin);
  if (!draft) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: jsonHeaders });
  }

  return NextResponse.json({ draft }, { status: 200, headers: jsonHeaders });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireEmployerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await context.params;

  const draft = await loadOwned(id, auth.user.id, auth.user.isAdmin);
  if (!draft) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: jsonHeaders });
  }

  await prisma.documentDraft.delete({ where: { id } });
  await logActivity(auth.user.id, "deleted", "employer", draft.title || "Document", id, "Document supprimé");
  return NextResponse.json({ ok: true }, { status: 200, headers: jsonHeaders });
}
