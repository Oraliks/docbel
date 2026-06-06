import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { guardTenant } from "@/lib/booking/partner-guard";
import { parseFormFields } from "@/lib/booking/form-fields";
import { tenantSettingsSchema } from "@/lib/booking/schemas";
import { locationAddress } from "@/lib/booking/route-bureau";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Détail + configuration d'un tenant (avec ses antennes). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await ctx.params;
  const guard = await guardTenant(tenantId, "view");
  if (!guard.ok) return guard.response;
  const t = guard.tenant;

  const locations = await prisma.bookingLocation.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    {
      role: guard.role,
      tenant: {
        id: t.id,
        slug: t.slug,
        name: t.name,
        category: t.category,
        partnerOrganization: t.partnerOrganization,
        logoUrl: t.logoUrl,
        brandColor: t.brandColor,
        emailFromName: t.emailFromName,
        notifyEmail: t.notifyEmail,
        formFields: parseFormFields(t.formFields),
        requireApproval: t.requireApproval,
        autoApproveAfterHours: t.autoApproveAfterHours,
        dedupeField: t.dedupeField,
        dedupeWindowDays: t.dedupeWindowDays,
        active: t.active,
      },
      locations: locations.map((l) => ({
        id: l.id,
        name: l.name,
        bureauId: l.bureauId,
        street: l.street,
        postalCode: l.postalCode,
        city: l.city,
        lat: l.lat,
        lng: l.lng,
        active: l.active,
        address: locationAddress(l),
      })),
    },
    { headers: json },
  );
}

/** Mise à jour de la configuration — owner uniquement. */
export async function PATCH(
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
  const parsed = tenantSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide" },
      { status: 400, headers: json },
    );
  }

  const d = parsed.data;
  await prisma.bookingTenant.update({
    where: { id: tenantId },
    data: {
      name: d.name,
      category: d.category,
      logoUrl: d.logoUrl,
      brandColor: d.brandColor,
      emailFromName: d.emailFromName,
      notifyEmail: d.notifyEmail,
      formFields: d.formFields,
      requireApproval: d.requireApproval,
      autoApproveAfterHours: d.autoApproveAfterHours,
      dedupeField: d.dedupeField,
      dedupeWindowDays: d.dedupeWindowDays,
      active: d.active,
    },
  });

  await logActivity(guard.userName, "updated", "booking", guard.tenant.name, tenantId, "Config tenant mise à jour");
  return NextResponse.json({ ok: true }, { headers: json });
}
