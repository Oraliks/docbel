import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { listAccessibleTenants } from "@/lib/booking/access";
import { tenantCreateSchema } from "@/lib/booking/schemas";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Liste les tenants accessibles, avec le nombre de demandes en attente. */
export async function GET() {
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) return auth.error;

  const tenants = await listAccessibleTenants(auth.user.id, auth.user.role);
  const ids = tenants.map((t) => t.id);
  const pending = ids.length
    ? await prisma.booking.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: ids }, status: BookingStatus.pending_approval },
        _count: { _all: true },
      })
    : [];
  const pendingMap = new Map(pending.map((p) => [p.tenantId, p._count._all]));

  return NextResponse.json(
    {
      tenants: tenants.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        category: t.category,
        active: t.active,
        requireApproval: t.requireApproval,
        pendingCount: pendingMap.get(t.id) ?? 0,
      })),
      isAdmin: auth.user.isAdmin,
    },
    { headers: json },
  );
}

/** Création d'un tenant — réservée aux admins. */
export async function POST(req: NextRequest) {
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) return auth.error;
  if (!auth.user.isAdmin) {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403, headers: json });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: json });
  }
  const parsed = tenantCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide" },
      { status: 400, headers: json },
    );
  }

  try {
    const tenant = await prisma.bookingTenant.create({
      data: {
        slug: parsed.data.slug,
        name: parsed.data.name,
        category: parsed.data.category ?? "other",
        partnerOrganization: parsed.data.partnerOrganization ?? null,
        organismeId: parsed.data.organismeId ?? null,
      },
      select: { id: true, slug: true },
    });
    await logActivity(auth.user.name, "created", "booking", parsed.data.name, tenant.id, "Tenant booking créé");
    return NextResponse.json({ ok: true, id: tenant.id, slug: tenant.slug }, { status: 201, headers: json });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ce slug est déjà utilisé" }, { status: 409, headers: json });
    }
    console.error("[booking] création tenant échouée:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500, headers: json });
  }
}
