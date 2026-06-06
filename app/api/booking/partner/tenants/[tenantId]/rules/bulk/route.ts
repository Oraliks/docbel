import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { guardTenant } from "@/lib/booking/partner-guard";
import { ruleBulkSchema } from "@/lib/booking/schemas";
import { generateTimeSlots } from "@/lib/booking/dates";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Génère en masse des règles de créneaux (plage horaire × durée × jours). */
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
  const parsed = ruleBulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide" },
      { status: 400, headers: json },
    );
  }
  const d = parsed.data;

  const loc = await prisma.bookingLocation.findFirst({
    where: { id: d.locationId, tenantId },
    select: { id: true },
  });
  if (!loc) {
    return NextResponse.json({ error: "Antenne introuvable" }, { status: 404, headers: json });
  }

  const slots = generateTimeSlots(d.startTime, d.endTime, d.slotDuration);
  if (slots.length === 0) {
    return NextResponse.json(
      { error: "Plage horaire ou durée invalide" },
      { status: 400, headers: json },
    );
  }

  const data = d.weekdays.flatMap((weekday) =>
    slots.map((s) => ({
      locationId: d.locationId,
      weekday,
      startTime: s.startTime,
      endTime: s.endTime,
      capacity: d.capacity,
      serviceCode: d.serviceCode ?? null,
      createdById: guard.userId,
    })),
  );

  await prisma.bookingSlotRule.createMany({ data });

  return NextResponse.json({ ok: true, count: data.length }, { status: 201, headers: json });
}
