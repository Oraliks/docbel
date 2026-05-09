import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";
import { serializeU1, validateU1Input } from "@/lib/u1-institutions";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await params;
  const inst = await withDbRetry(() => prisma.u1Institution.findUnique({ where: { id } }));
  if (!inst) {
    return NextResponse.json(
      { error: "Institution introuvable" },
      { status: 404, headers: jsonHeaders }
    );
  }
  return NextResponse.json(serializeU1(inst), { headers: jsonHeaders });
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

  const validation = validateU1Input(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.errors },
      { status: 400, headers: jsonHeaders }
    );
  }
  const data = validation.data;

  try {
    const updated = await withDbRetry(() =>
      prisma.u1Institution.update({
        where: { id },
        data: {
          country: data.country,
          countryCode: data.countryCode,
          organization: data.organization,
          department: data.department,
          alternateName: data.alternateName,
          addressLines: data.addressLines as Prisma.InputJsonValue,
          postalAddress: data.postalAddress,
          phone: data.phone,
          fax: data.fax,
          website: data.website,
          emails: data.emails as Prisma.InputJsonValue,
          extra: (data.extra ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          updatedBy: authCheck.user.id,
        },
      })
    );

    await logActivity(
      authCheck.user.name,
      "updated",
      "setting",
      `U1 - ${updated.country}`,
      updated.id
    );

    return NextResponse.json(serializeU1(updated), { headers: jsonHeaders });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Institution introuvable" },
          { status: 404, headers: jsonHeaders }
        );
      }
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Une autre institution utilise déjà ce pays" },
          { status: 409, headers: jsonHeaders }
        );
      }
    }
    console.error("Error updating U1 institution:", error);
    return NextResponse.json(
      { error: "Failed to update U1 institution" },
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
      prisma.u1Institution.findUnique({ where: { id } })
    );
    if (!existing) {
      return NextResponse.json(
        { error: "Institution introuvable" },
        { status: 404, headers: jsonHeaders }
      );
    }
    await withDbRetry(() => prisma.u1Institution.delete({ where: { id } }));
    await logActivity(
      authCheck.user.name,
      "deleted",
      "setting",
      `U1 - ${existing.country}`,
      existing.id
    );
    return NextResponse.json({ success: true }, { headers: jsonHeaders });
  } catch (error) {
    console.error("Error deleting U1 institution:", error);
    return NextResponse.json(
      { error: "Failed to delete U1 institution" },
      { status: 500, headers: jsonHeaders }
    );
  }
}
