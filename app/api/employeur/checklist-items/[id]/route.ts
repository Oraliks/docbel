import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployerOrAdminAuth } from "@/lib/auth-check";
import { ITEM_STATUSES } from "@/lib/employeur/constants";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };
const VALID_STATUSES = new Set<string>(ITEM_STATUSES.map((s) => s.value));

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireEmployerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await context.params;

  // Vérifie la propriété en remontant item → checklist → scénario → profil.
  const item = await prisma.checklistItem.findUnique({
    where: { id },
    select: { id: true, checklist: { select: { scenario: { select: { employerProfile: { select: { userId: true } } } } } } },
  });
  if (!item) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: jsonHeaders });
  const ownerId = item.checklist.scenario.employerProfile.userId;
  if (!auth.user.isAdmin && ownerId !== auth.user.id) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: jsonHeaders });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: jsonHeaders });
  }
  const { status, comment } = body as { status?: string; comment?: string };

  const data: { status?: string; comment?: string } = {};
  if (status !== undefined) {
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400, headers: jsonHeaders });
    }
    data.status = status;
  }
  if (comment !== undefined) data.comment = comment.slice(0, 2000);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400, headers: jsonHeaders });
  }

  await prisma.checklistItem.update({ where: { id }, data });
  return NextResponse.json({ ok: true }, { headers: jsonHeaders });
}
