import { NextRequest, NextResponse } from "next/server";
import { Prisma, BureauType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";
import { serializeBureau } from "@/lib/bureaus/types";
import { validateBureauInput } from "@/lib/bureaus/validation";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function invalidateCaches() {
  revalidatePath("/api/bureaus", "layout");
  revalidatePath("/api/bureaus/resolve", "layout");
}

const VALID_TYPES: BureauType[] = ["CPAS", "COMMUNE", "ONEM", "SYNDICAT", "PERMANENCE", "AUTRE"];

export async function GET(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const typeRaw = sp.get("type")?.trim().toUpperCase() ?? "";
  const organismeId = sp.get("organismeId")?.trim() ?? "";
  const region = sp.get("region")?.trim() ?? "";
  const activeRaw = sp.get("active")?.trim() ?? "";
  const verifiedRaw = sp.get("verified")?.trim() ?? "";
  const limit = Math.min(Number(sp.get("limit")) || 100, 500);

  const where: Prisma.BureauWhereInput = {};
  if (typeRaw && VALID_TYPES.includes(typeRaw as BureauType)) {
    where.type = typeRaw as BureauType;
  }
  if (organismeId) where.organismeId = organismeId;
  if (activeRaw === "true" || activeRaw === "active") where.active = true;
  if (activeRaw === "false") where.active = false;
  if (verifiedRaw === "true") where.verified = true;
  if (verifiedRaw === "false") where.verified = false;
  if (region) {
    where.commune = { region: region as Prisma.CommuneWhereInput["region"] };
  }
  // q et verified=stale utilisent tous les deux des OR, on les compose via AND
  const andClauses: Prisma.BureauWhereInput[] = [];
  if (verifiedRaw === "stale") {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    andClauses.push({
      OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: sixMonthsAgo } }],
    });
  }
  if (q) {
    andClauses.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { street: { contains: q, mode: "insensitive" } },
        { postalCode: { contains: q } },
      ],
    });
  }
  if (andClauses.length > 0) where.AND = andClauses;

  try {
    const items = await withDbRetry(() =>
      prisma.bureau.findMany({
        where,
        include: { organisme: true, commune: true },
        orderBy: [{ type: "asc" }, { city: "asc" }, { name: "asc" }],
        take: limit,
      })
    );
    return NextResponse.json(
      { items: items.map(serializeBureau), total: items.length },
      { headers: jsonHeaders }
    );
  } catch (error) {
    console.error("[admin/bureaus] list error:", error);
    return NextResponse.json(
      { error: "Échec du chargement" },
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

  const validation = validateBureauInput(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.errors },
      { status: 400, headers: jsonHeaders }
    );
  }
  const data = validation.data;

  // Détection préventive de doublon strict (mêmes type + nom + CP)
  const existing = await withDbRetry(() =>
    prisma.bureau.findFirst({
      where: {
        type: data.type as BureauType,
        name: data.name,
        postalCode: data.postalCode,
      },
      select: { id: true, name: true, active: true },
    })
  );
  if (existing) {
    return NextResponse.json(
      {
        error: "Doublon détecté",
        details: [
          {
            field: "name",
            message: `Un bureau de type ${data.type} nommé "${data.name}" existe déjà au CP ${data.postalCode}${
              existing.active ? "" : " (désactivé — réactivez-le plutôt)"
            }.`,
          },
        ],
        existingId: existing.id,
      },
      { status: 409, headers: jsonHeaders }
    );
  }

  try {
    const created = await withDbRetry(() =>
      prisma.bureau.create({
        data: {
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
        },
        include: { organisme: true, commune: true },
      })
    );

    await logActivity(
      authCheck.user.name,
      "created",
      "setting",
      `Bureau - ${created.name}`,
      created.id
    );

    invalidateCaches();
    return NextResponse.json(serializeBureau(created), {
      status: 201,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("[admin/bureaus] create error:", error);
    return NextResponse.json(
      { error: "Échec de la création" },
      { status: 500, headers: jsonHeaders }
    );
  }
}
