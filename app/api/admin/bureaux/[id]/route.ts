import { NextRequest, NextResponse } from "next/server";
import { Prisma, BureauType } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";
import { serializeBureau } from "@/lib/bureaus/types";
import { validateBureauInput } from "@/lib/bureaus/validation";
import { scheduleAutoTranslate } from "@/lib/i18n/auto-translate";
import { diffBureau, snapshotBureau } from "@/lib/bureaus/diff";
import { invalidateBureauCaches } from "@/lib/bureaus/cache-invalidation";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await ctx.params;
  const bureau = await withDbRetry(() =>
    prisma.bureau.findUnique({
      where: { id },
      include: { organisme: true, commune: true },
    })
  );
  if (!bureau) {
    return NextResponse.json(
      { error: "Introuvable" },
      { status: 404, headers: jsonHeaders }
    );
  }
  return NextResponse.json(serializeBureau(bureau), { headers: jsonHeaders });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: jsonHeaders }
    );
  }

  const validation = validateBureauInput(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.errors },
      { status: 400, headers: jsonHeaders }
    );
  }
  const data = validation.data;

  try {
    const before = await withDbRetry(() => prisma.bureau.findUnique({ where: { id } }));
    if (!before) {
      return NextResponse.json(
        { error: "Bureau introuvable" },
        { status: 404, headers: jsonHeaders }
      );
    }

    const updateData = {
      organismeId: data.organismeId,
      type: data.type as BureauType,
      name: data.name,
      nameNl: data.nameNl,
      nameDe: data.nameDe,
      street: data.street,
      streetNum: data.streetNum,
      postalCode: data.postalCode,
      city: data.city,
      lat: data.lat,
      lng: data.lng,
      communeId: data.communeId,
      phone: data.phone,
      email: data.email,
      website: data.website,
      appointmentUrl: data.appointmentUrl,
      hours: data.hours as Prisma.InputJsonValue,
      hoursNotes: data.hoursNotes,
      services: data.services as Prisma.InputJsonValue,
      active: data.active,
      notes: data.notes,
      updatedBy: authCheck.user.id,
    };

    const diff = diffBureau(before, updateData as unknown as Partial<typeof before>);

    const updated = await withDbRetry(() =>
      prisma.bureau.update({
        where: { id },
        data: updateData,
        include: { organisme: true, commune: true },
      })
    );

    // Trace la révision si quelque chose a changé.
    if (diff.changed.length > 0) {
      await prisma.bureauRevision
        .create({
          data: {
            bureauId: id,
            snapshot: snapshotBureau(before) as Prisma.InputJsonValue,
            diff: diff as unknown as Prisma.InputJsonValue,
            changedBy: authCheck.user.id,
          },
        })
        .catch((err) => console.error("[bureaus] revision write failed:", err));
    }

    // Auto-traduction NL/EN seulement si les notes d'horaires ont changé.
    if (diff.changed.includes("hoursNotes")) {
      scheduleAutoTranslate("Bureau", updated.id);
    }

    await logActivity(
      authCheck.user.name,
      "updated",
      "setting",
      `Bureau - ${updated.name}`,
      updated.id,
      diff.changed.length > 0 ? `Champs modifiés : ${diff.changed.join(", ")}` : undefined
    );

    invalidateBureauCaches();
    return NextResponse.json(serializeBureau(updated), { headers: jsonHeaders });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json(
        { error: "Bureau introuvable" },
        { status: 404, headers: jsonHeaders }
      );
    }
    console.error("[admin/bureaus PATCH] error:", error);
    return NextResponse.json(
      { error: "Échec de la mise à jour" },
      { status: 500, headers: jsonHeaders }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await ctx.params;
  try {
    // Garde-fou : empêche la désactivation du DERNIER CPAS d'une commune.
    const target = await withDbRetry(() =>
      prisma.bureau.findUnique({ where: { id }, select: { type: true, communeId: true, name: true } })
    );
    if (!target) {
      return NextResponse.json(
        { error: "Bureau introuvable" },
        { status: 404, headers: jsonHeaders }
      );
    }
    if ((target.type === "CPAS" || target.type === "COMMUNE") && target.communeId) {
      const otherActive = await withDbRetry(() =>
        prisma.bureau.count({
          where: {
            type: target.type,
            communeId: target.communeId,
            active: true,
            NOT: { id },
          },
        })
      );
      if (otherActive === 0) {
        return NextResponse.json(
          {
            error: `Impossible de désactiver le dernier ${target.type} de cette commune. Créez-en un autre d'abord ou supprimez la commune.`,
          },
          { status: 409, headers: jsonHeaders }
        );
      }
    }

    // Soft delete : on flippe `active` plutôt que de supprimer.
    const updated = await withDbRetry(() =>
      prisma.bureau.update({
        where: { id },
        data: { active: false, updatedBy: authCheck.user.id },
      })
    );
    await logActivity(
      authCheck.user.name,
      "deleted",
      "setting",
      `Bureau - ${updated.name}`,
      updated.id,
      "désactivé (soft delete)"
    );
    invalidateBureauCaches();
    return NextResponse.json({ ok: true }, { headers: jsonHeaders });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json(
        { error: "Bureau introuvable" },
        { status: 404, headers: jsonHeaders }
      );
    }
    console.error("[admin/bureaus DELETE] error:", error);
    return NextResponse.json(
      { error: "Échec de la suppression" },
      { status: 500, headers: jsonHeaders }
    );
  }
}
