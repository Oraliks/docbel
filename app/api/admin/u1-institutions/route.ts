import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";
import { serializeU1, validateU1Input } from "@/lib/u1-institutions";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  const where: Prisma.U1InstitutionWhereInput = q
    ? {
        OR: [
          { country: { contains: q, mode: "insensitive" } },
          { organization: { contains: q, mode: "insensitive" } },
          { department: { contains: q, mode: "insensitive" } },
          { alternateName: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  try {
    const items = await withDbRetry(() =>
      prisma.u1Institution.findMany({
        where,
        orderBy: [{ country: "asc" }],
      })
    );
    return NextResponse.json(
      { items: items.map(serializeU1), total: items.length },
      { headers: jsonHeaders }
    );
  } catch (error) {
    console.error("Error fetching U1 institutions:", error);
    return NextResponse.json(
      { error: "Failed to fetch U1 institutions" },
      { status: 500, headers: jsonHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

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
    const created = await withDbRetry(() =>
      prisma.u1Institution.create({
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
      "created",
      "setting",
      `U1 - ${created.country}`,
      created.id
    );

    return NextResponse.json(serializeU1(created), {
      status: 201,
      headers: jsonHeaders,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Une institution pour ce pays existe déjà" },
        { status: 409, headers: jsonHeaders }
      );
    }
    console.error("Error creating U1 institution:", error);
    return NextResponse.json(
      { error: "Failed to create U1 institution" },
      { status: 500, headers: jsonHeaders }
    );
  }
}
