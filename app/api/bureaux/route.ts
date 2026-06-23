import { NextRequest, NextResponse } from "next/server";
import { Prisma, BureauType } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { serializeBureau } from "@/lib/bureaus/types";
import { localizeRecords } from "@/lib/i18n/content";
import { getUserLocale } from "@/i18n/locale";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const VALID_TYPES: BureauType[] = ["CPAS", "COMMUNE", "ONEM", "SYNDICAT", "PERMANENCE", "AUTRE"];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const typeRaw = sp.get("type")?.trim().toUpperCase() ?? "";
  const organismeId = sp.get("organismeId")?.trim() ?? "";
  const postalCode = sp.get("postalCode")?.trim() ?? "";
  const limit = Math.min(Number(sp.get("limit")) || 50, 200);

  const where: Prisma.BureauWhereInput = { active: true };

  if (typeRaw && VALID_TYPES.includes(typeRaw as BureauType)) {
    where.type = typeRaw as BureauType;
  }
  if (organismeId) where.organismeId = organismeId;
  if (postalCode) where.postalCode = postalCode;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { street: { contains: q, mode: "insensitive" } },
    ];
  }

  try {
    const items = await withDbRetry(() =>
      prisma.bureau.findMany({
        where,
        include: { organisme: true, commune: true },
        orderBy: [{ type: "asc" }, { city: "asc" }, { name: "asc" }],
        take: limit,
      })
    );

    const locale = await getUserLocale();
    let localized = await localizeRecords("Bureau", items, ["hoursNotes"], locale);
    const organismes = localized
      .map((b) => b.organisme)
      .filter((o): o is NonNullable<typeof o> => Boolean(o));
    if (organismes.length > 0) {
      const localizedOrganismes = await localizeRecords(
        "Organisme",
        organismes,
        ["name", "description"],
        locale
      );
      const byId = new Map(localizedOrganismes.map((o) => [o.id, o]));
      localized = localized.map((b) =>
        b.organisme ? { ...b, organisme: byId.get(b.organisme.id) ?? b.organisme } : b
      );
    }

    return NextResponse.json(
      { items: localized.map(serializeBureau), total: localized.length },
      { headers: jsonHeaders }
    );
  } catch (error) {
    console.error("[bureaus] list error:", error);
    return NextResponse.json(
      { error: "Échec du chargement" },
      { status: 500, headers: jsonHeaders }
    );
  }
}
