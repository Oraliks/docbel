import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployerOrAdminAuth } from "@/lib/auth-check";
import { SCENARIO_STATUSES } from "@/lib/employeur/constants";
import { logActivity } from "@/lib/activity-logger";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };
const VALID_STATUSES = new Set<string>(SCENARIO_STATUSES.map((s) => s.value));

async function loadOwned(id: string, userId: string, isAdmin: boolean) {
  const scenario = await prisma.workerScenario.findUnique({
    where: { id },
    include: { employerProfile: { select: { userId: true } } },
  });
  if (!scenario) return null;
  if (!isAdmin && scenario.employerProfile.userId !== userId) return null;
  return scenario;
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireEmployerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await context.params;

  const scenario = await loadOwned(id, auth.user.id, auth.user.isAdmin);
  if (!scenario) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: jsonHeaders });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: jsonHeaders });
  }
  const { status } = body as { status?: string };
  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400, headers: jsonHeaders });
  }

  await prisma.workerScenario.update({ where: { id }, data: { status } });
  await logActivity(auth.user.id, "updated", "employer", "Dossier", id, "Statut mis à jour");
  return NextResponse.json({ ok: true }, { headers: jsonHeaders });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireEmployerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await context.params;

  const scenario = await loadOwned(id, auth.user.id, auth.user.isAdmin);
  if (!scenario) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: jsonHeaders });

  await prisma.workerScenario.delete({ where: { id } }); // cascade checklists + items
  await logActivity(auth.user.id, "deleted", "employer", "Dossier", id, "Dossier supprimé");
  return NextResponse.json({ ok: true }, { headers: jsonHeaders });
}
