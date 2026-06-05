import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { guardTenant } from "@/lib/booking/partner-guard";
import { locationSchema } from "@/lib/booking/schemas";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

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
  const parsed = locationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide" },
      { status: 400, headers: json },
    );
  }

  const loc = await prisma.bookingLocation.create({
    data: { tenantId, ...parsed.data },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: loc.id }, { status: 201, headers: json });
}
