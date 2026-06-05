import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { guardTenant } from "@/lib/booking/partner-guard";
import { ruleSchema } from "@/lib/booking/schemas";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

async function ownsRule(tenantId: string, ruleId: string): Promise<boolean> {
  const rule = await prisma.bookingSlotRule.findFirst({
    where: { id: ruleId, location: { tenantId } },
    select: { id: true },
  });
  return !!rule;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string; ruleId: string }> },
) {
  const { tenantId, ruleId } = await ctx.params;
  const guard = await guardTenant(tenantId, "config");
  if (!guard.ok) return guard.response;
  if (!(await ownsRule(tenantId, ruleId))) {
    return NextResponse.json({ error: "Règle introuvable" }, { status: 404, headers: json });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: json });
  }
  const parsed = ruleSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide" },
      { status: 400, headers: json },
    );
  }
  const { validFrom, validUntil, ...rest } = parsed.data;

  await prisma.bookingSlotRule.update({
    where: { id: ruleId },
    data: {
      ...rest,
      ...(validFrom !== undefined ? { validFrom: validFrom ? new Date(validFrom) : null } : {}),
      ...(validUntil !== undefined ? { validUntil: validUntil ? new Date(validUntil) : null } : {}),
    },
  });
  return NextResponse.json({ ok: true }, { headers: json });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ tenantId: string; ruleId: string }> },
) {
  const { tenantId, ruleId } = await ctx.params;
  const guard = await guardTenant(tenantId, "config");
  if (!guard.ok) return guard.response;
  if (!(await ownsRule(tenantId, ruleId))) {
    return NextResponse.json({ error: "Règle introuvable" }, { status: 404, headers: json });
  }
  await prisma.bookingSlotRule.delete({ where: { id: ruleId } });
  return NextResponse.json({ ok: true }, { headers: json });
}
