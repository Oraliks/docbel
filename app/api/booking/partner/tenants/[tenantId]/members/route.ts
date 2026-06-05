import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { guardTenant } from "@/lib/booking/partner-guard";
import { memberCreateSchema } from "@/lib/booking/schemas";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Liste les membres de l'équipe (avec nom/email) — owner uniquement. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await ctx.params;
  const guard = await guardTenant(tenantId, "team");
  if (!guard.ok) return guard.response;

  const members = await prisma.bookingTenantMember.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: members.map((m) => m.userId) } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json(
    {
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        name: userMap.get(m.userId)?.name ?? "—",
        email: userMap.get(m.userId)?.email ?? "—",
      })),
      partnerOrganization: guard.tenant.partnerOrganization,
    },
    { headers: json },
  );
}

/** Ajoute un membre par email — owner uniquement. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await ctx.params;
  const guard = await guardTenant(tenantId, "team");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: json });
  }
  const parsed = memberCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide" },
      { status: 400, headers: json },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: "Aucun compte avec cet email — la personne doit d'abord créer un compte" },
      { status: 404, headers: json },
    );
  }

  try {
    await prisma.bookingTenantMember.create({
      data: { tenantId, userId: user.id, role: parsed.data.role },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Déjà membre de l'équipe" }, { status: 409, headers: json });
    }
    throw e;
  }

  await logActivity(guard.userName, "updated", "booking", guard.tenant.name, tenantId, `Membre ajouté: ${parsed.data.email}`);
  return NextResponse.json({ ok: true }, { status: 201, headers: json });
}
