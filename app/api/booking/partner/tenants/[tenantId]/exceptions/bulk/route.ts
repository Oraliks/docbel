import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { guardTenant } from "@/lib/booking/partner-guard";
import { exceptionBulkSchema } from "@/lib/booking/schemas";
import { addDaysYmd } from "@/lib/booking/dates";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };
const MAX_DAYS = 366;

/** Fermeture en masse d'une antenne sur une plage de dates (congés). */
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
  const parsed = exceptionBulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide" },
      { status: 400, headers: json },
    );
  }
  const { locationId, from, to, reason } = parsed.data;
  if (to < from) {
    return NextResponse.json(
      { error: "La date de fin doit suivre la date de début" },
      { status: 400, headers: json },
    );
  }

  const loc = await prisma.bookingLocation.findFirst({
    where: { id: locationId, tenantId },
    select: { id: true },
  });
  if (!loc) {
    return NextResponse.json({ error: "Antenne introuvable" }, { status: 404, headers: json });
  }

  // Toutes les dates de la plage (bornes incluses), plafonnées.
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDaysYmd(d, 1)) {
    dates.push(d);
    if (dates.length >= MAX_DAYS) break;
  }

  // Ne pas recréer une fermeture déjà existante sur la même date.
  const existing = await prisma.bookingException.findMany({
    where: { locationId, kind: "closed", date: { in: dates } },
    select: { date: true },
  });
  const already = new Set(existing.map((e) => e.date));
  const toCreate = dates.filter((d) => !already.has(d));

  if (toCreate.length > 0) {
    await prisma.bookingException.createMany({
      data: toCreate.map((date) => ({
        locationId,
        date,
        kind: "closed" as const,
        slots: [],
        reason: reason ?? null,
        createdById: guard.userId,
      })),
    });
  }

  return NextResponse.json(
    { ok: true, created: toCreate.length, skipped: already.size },
    { status: 201, headers: json },
  );
}
