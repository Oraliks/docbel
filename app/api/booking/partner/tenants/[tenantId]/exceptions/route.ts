import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { guardTenant } from "@/lib/booking/partner-guard";
import { exceptionSchema } from "@/lib/booking/schemas";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

const createSchema = exceptionSchema.extend({ locationId: z.string().min(1).max(40) });

/** Exceptions (fermetures / créneaux ponctuels) d'une antenne (?locationId=…). */
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

  const exceptions = await prisma.bookingException.findMany({
    where: { locationId },
    orderBy: { date: "asc" },
  });
  return NextResponse.json({ exceptions }, { headers: json });
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
  const { locationId, date, kind, slots, reason } = parsed.data;

  const loc = await prisma.bookingLocation.findFirst({
    where: { id: locationId, tenantId },
    select: { id: true },
  });
  if (!loc) {
    return NextResponse.json({ error: "Antenne introuvable" }, { status: 404, headers: json });
  }

  const exception = await prisma.bookingException.create({
    data: {
      locationId,
      date,
      kind,
      slots: kind === "extra" ? (slots ?? []) : [],
      reason: reason ?? null,
      createdById: guard.userId,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: exception.id }, { status: 201, headers: json });
}
