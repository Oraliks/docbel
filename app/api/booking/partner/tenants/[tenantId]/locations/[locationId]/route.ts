import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { guardTenant } from "@/lib/booking/partner-guard";
import { locationSchema } from "@/lib/booking/schemas";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string; locationId: string }> },
) {
  const { tenantId, locationId } = await ctx.params;
  const guard = await guardTenant(tenantId, "config");
  if (!guard.ok) return guard.response;

  const exists = await prisma.bookingLocation.findFirst({
    where: { id: locationId, tenantId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Antenne introuvable" }, { status: 404, headers: json });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: json });
  }
  const parsed = locationSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide" },
      { status: 400, headers: json },
    );
  }

  await prisma.bookingLocation.update({ where: { id: locationId }, data: parsed.data });
  return NextResponse.json({ ok: true }, { headers: json });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ tenantId: string; locationId: string }> },
) {
  const { tenantId, locationId } = await ctx.params;
  const guard = await guardTenant(tenantId, "config");
  if (!guard.ok) return guard.response;

  const exists = await prisma.bookingLocation.findFirst({
    where: { id: locationId, tenantId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Antenne introuvable" }, { status: 404, headers: json });
  }

  try {
    await prisma.bookingLocation.delete({ where: { id: locationId } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2003") {
      return NextResponse.json(
        { error: "Cette antenne a des rendez-vous — désactivez-la plutôt" },
        { status: 409, headers: json },
      );
    }
    throw e;
  }
  return NextResponse.json({ ok: true }, { headers: json });
}
