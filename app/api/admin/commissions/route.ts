import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";
import { scheduleAutoTranslate } from "@/lib/i18n/auto-translate";
import {
  buildLabel,
  buildSearchText,
  isCommissionType,
  serializeCommission,
  validateCommissionInput,
} from "@/lib/commissions";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const MAX_TAKE = 500;
const DEFAULT_TAKE = 50;

export async function GET(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim() ?? "";
  const typeParam = url.searchParams.get("type")?.trim() ?? "";
  const skipParam = parseInt(url.searchParams.get("skip") ?? "0", 10);
  const takeParam = parseInt(url.searchParams.get("take") ?? `${DEFAULT_TAKE}`, 10);

  const skip = Number.isFinite(skipParam) && skipParam >= 0 ? skipParam : 0;
  const take = Number.isFinite(takeParam) && takeParam > 0 ? Math.min(takeParam, MAX_TAKE) : DEFAULT_TAKE;

  const where: Prisma.CommissionParitaireWhereInput = {};
  if (typeParam && isCommissionType(typeParam)) {
    where.type = typeParam;
  }
  if (q) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { numero: { contains: q, mode: "insensitive" } },
      { nom: { contains: q, mode: "insensitive" } },
      { searchText: { contains: q.toLowerCase() } },
    ];
  }

  try {
    const [items, total] = await Promise.all([
      withDbRetry(() =>
        prisma.commissionParitaire.findMany({
          where,
          orderBy: [{ code: "asc" }],
          skip,
          take,
        })
      ),
      withDbRetry(() => prisma.commissionParitaire.count({ where })),
    ]);

    return NextResponse.json(
      {
        items: items.map(serializeCommission),
        total,
        skip,
        take,
      },
      { headers: jsonHeaders }
    );
  } catch (error) {
    console.error("Error fetching commissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch commissions" },
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

  const validation = validateCommissionInput(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.errors },
      { status: 400, headers: jsonHeaders }
    );
  }
  const data = validation.data;

  try {
    const created = await withDbRetry(() =>
      prisma.commissionParitaire.create({
        data: {
          ...data,
          label: buildLabel(data.numero, data.nom),
          searchText: buildSearchText(data),
          updatedBy: authCheck.user.id,
        },
      })
    );

    // Auto-traduction NL/EN en arrière-plan (nom + label, statut "ia").
    scheduleAutoTranslate("CommissionParitaire", created.id);

    await logActivity(
      authCheck.user.name,
      "created",
      "setting",
      `CP ${created.numero} - ${created.nom}`,
      created.id
    );

    return NextResponse.json(serializeCommission(created), {
      status: 201,
      headers: jsonHeaders,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Une commission avec ce code existe déjà" },
        { status: 409, headers: jsonHeaders }
      );
    }
    console.error("Error creating commission:", error);
    return NextResponse.json(
      { error: "Failed to create commission" },
      { status: 500, headers: jsonHeaders }
    );
  }
}
