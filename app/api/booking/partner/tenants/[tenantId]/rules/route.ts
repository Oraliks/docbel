import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { guardTenant } from "@/lib/booking/partner-guard";
import { ruleSchema } from "@/lib/booking/schemas";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

const createSchema = ruleSchema.extend({ locationId: z.string().min(1).max(40) });

/** Règles de créneaux d'une antenne (?locationId=…). */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await ctx.params;
  const guard = await guardTenant(tenantId, "view");
  if (!guard.ok) return guard.response;

  const locationId = new URL(req.url).searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ error: "locationId requis" }, { status: 400, headers: json });
  }
  const loc = await prisma.bookingLocation.findFirst({
    where: { id: locationId, tenantId },
    select: { id: true },
  });
  if (!loc) {
    return NextResponse.json({ error: "Antenne introuvable" }, { status: 404, headers: json });
  }

  const rules = await prisma.bookingSlotRule.findMany({
    where: { locationId },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json({ rules }, { headers: json });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await ctx.params;
  const guard = await guardTenant(tenantId, "config");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: json });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide" },
      { status: 400, headers: json },
    );
  }
  const { locationId, validFrom, validUntil, ...rest } = parsed.data;

  const loc = await prisma.bookingLocation.findFirst({
    where: { id: locationId, tenantId },
    select: { id: true },
  });
  if (!loc) {
    return NextResponse.json({ error: "Antenne introuvable" }, { status: 404, headers: json });
  }

  const rule = await prisma.bookingSlotRule.create({
    data: {
      locationId,
      ...rest,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      createdById: guard.userId,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: rule.id }, { status: 201, headers: json });
}
