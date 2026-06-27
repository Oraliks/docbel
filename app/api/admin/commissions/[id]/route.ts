import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";
import { scheduleAutoTranslate } from "@/lib/i18n/auto-translate";
import {
  buildLabel,
  buildSearchText,
  serializeCommission,
  validateCommissionInput,
} from "@/lib/commissions";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await params;
  try {
    const commission = await withDbRetry(() =>
      prisma.commissionParitaire.findUnique({ where: { id } })
    );
    if (!commission) {
      return NextResponse.json(
        { error: "Commission introuvable" },
        { status: 404, headers: jsonHeaders }
      );
    }
    return NextResponse.json(serializeCommission(commission), { headers: jsonHeaders });
  } catch (error) {
    console.error("Error fetching commission:", error);
    return NextResponse.json(
      { error: "Failed to fetch commission" },
      { status: 500, headers: jsonHeaders }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: jsonHeaders }
    );
  }

  const validation = validateCommissionInput(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.errors },
      { status: 400, headers: jsonHeaders }
    );
  }
  const data = validation.data;

  try {
    const updated = await withDbRetry(() =>
      prisma.commissionParitaire.update({
        where: { id },
        data: {
          ...data,
          label: buildLabel(data.numero, data.nom),
          searchText: buildSearchText(data),
          updatedBy: authCheck.user.id,
        },
      })
    );

    // Auto-traduction NL/EN (nom + label rebâtis à chaque update, statut "ia").
    scheduleAutoTranslate("CommissionParitaire", updated.id);

    await logActivity(
      authCheck.user.name,
      "updated",
      "setting",
      `CP ${updated.numero} - ${updated.nom}`,
      updated.id
    );

    return NextResponse.json(serializeCommission(updated), { headers: jsonHeaders });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Commission introuvable" },
          { status: 404, headers: jsonHeaders }
        );
      }
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Une autre commission utilise déjà ce code" },
          { status: 409, headers: jsonHeaders }
        );
      }
    }
    console.error("Error updating commission:", error);
    return NextResponse.json(
      { error: "Failed to update commission" },
      { status: 500, headers: jsonHeaders }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await params;

  try {
    const existing = await withDbRetry(() =>
      prisma.commissionParitaire.findUnique({ where: { id } })
    );
    if (!existing) {
      return NextResponse.json(
        { error: "Commission introuvable" },
        { status: 404, headers: jsonHeaders }
      );
    }

    await withDbRetry(() => prisma.commissionParitaire.delete({ where: { id } }));

    await logActivity(
      authCheck.user.name,
      "deleted",
      "setting",
      `CP ${existing.numero} - ${existing.nom}`,
      existing.id
    );

    return NextResponse.json({ success: true }, { headers: jsonHeaders });
  } catch (error) {
    console.error("Error deleting commission:", error);
    return NextResponse.json(
      { error: "Failed to delete commission" },
      { status: 500, headers: jsonHeaders }
    );
  }
}
