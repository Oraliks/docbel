import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { guardTenant } from "@/lib/booking/partner-guard";
import { memberUpdateSchema } from "@/lib/booking/schemas";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string; memberId: string }> },
) {
  const { tenantId, memberId } = await ctx.params;
  const guard = await guardTenant(tenantId, "team");
  if (!guard.ok) return guard.response;

  const member = await prisma.bookingTenantMember.findFirst({
    where: { id: memberId, tenantId },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Membre introuvable" }, { status: 404, headers: json });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: json });
  }
  const parsed = memberUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide" },
      { status: 400, headers: json },
    );
  }

  await prisma.bookingTenantMember.update({
    where: { id: memberId },
    data: { role: parsed.data.role },
  });
  return NextResponse.json({ ok: true }, { headers: json });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ tenantId: string; memberId: string }> },
) {
  const { tenantId, memberId } = await ctx.params;
  const guard = await guardTenant(tenantId, "team");
  if (!guard.ok) return guard.response;

  const member = await prisma.bookingTenantMember.findFirst({
    where: { id: memberId, tenantId },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Membre introuvable" }, { status: 404, headers: json });
  }

  await prisma.bookingTenantMember.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true }, { headers: json });
}
