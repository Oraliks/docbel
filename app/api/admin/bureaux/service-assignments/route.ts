import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Matrice générique bureau ↔ communes pour un serviceType arbitraire.
 *
 * GET ?serviceType=paiement_fgtb
 *   → tous les bureaux de l'organisme correspondant, avec leurs communeIds
 *
 * PUT body: { bureauId, communeIds: string[], serviceType }
 *   → replace
 */

const KNOWN_SERVICE_TYPES = [
  "chomage",
  "paiement_capac",
  "paiement_fgtb",
  "paiement_csc",
  "paiement_synova",
  "mutuelle_solidaris",
  "mutuelle_mc",
  "mutuelle_mloz",
  "mutuelle_mutlibres",
  "mutuelle_neutrales",
  "emploi_regional",
  "pension",
];

// Mappage serviceType → critère bureau (type + code organisme)
function bureauFilter(serviceType: string): { type?: string; organismeCode?: string } {
  if (serviceType === "chomage") return { type: "ONEM" };
  if (serviceType.startsWith("paiement_")) {
    const code = serviceType.replace("paiement_", "");
    return { type: "SYNDICAT", organismeCode: code };
  }
  if (serviceType.startsWith("mutuelle_")) {
    return { type: "AUTRE", organismeCode: "mutualite" };
  }
  if (serviceType === "emploi_regional") {
    return { type: "AUTRE" };
  }
  if (serviceType === "pension") {
    return { type: "AUTRE", organismeCode: "onp" };
  }
  return {};
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const serviceType = req.nextUrl.searchParams.get("serviceType")?.trim() ?? "";
  if (!serviceType || !KNOWN_SERVICE_TYPES.includes(serviceType)) {
    return NextResponse.json(
      { error: `serviceType inconnu. Valeurs : ${KNOWN_SERVICE_TYPES.join(", ")}` },
      { status: 400, headers: jsonHeaders }
    );
  }

  const filter = bureauFilter(serviceType);
  const bureaus = await withDbRetry(() =>
    prisma.bureau.findMany({
      where: {
        active: true,
        ...(filter.type ? { type: filter.type as "ONEM" | "SYNDICAT" | "AUTRE" } : {}),
        ...(filter.organismeCode ? { organisme: { code: filter.organismeCode } } : {}),
      },
      orderBy: [{ city: "asc" }],
      include: {
        organisme: { select: { id: true, name: true, shortName: true, color: true, code: true } },
        assignments: {
          where: { serviceType },
          select: { communeId: true },
        },
      },
    })
  );

  const items = bureaus.map((b) => ({
    id: b.id,
    name: b.name,
    city: b.city,
    postalCode: b.postalCode,
    color: b.organisme?.color ?? "#0050A0",
    organismeCode: b.organisme?.code ?? null,
    communeIds: b.assignments.map((a) => a.communeId),
  }));

  return NextResponse.json({ items, serviceType, total: items.length }, { headers: jsonHeaders });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: jsonHeaders });
  }
  const bureauId = (body as { bureauId?: string })?.bureauId;
  const communeIds = (body as { communeIds?: unknown })?.communeIds;
  const serviceType = (body as { serviceType?: string })?.serviceType;
  if (
    typeof bureauId !== "string" ||
    !Array.isArray(communeIds) ||
    !serviceType ||
    !KNOWN_SERVICE_TYPES.includes(serviceType)
  ) {
    return NextResponse.json(
      { error: "Body : { bureauId, communeIds: string[], serviceType }" },
      { status: 400, headers: jsonHeaders }
    );
  }
  const cleanIds = communeIds.filter((c): c is string => typeof c === "string" && c.length > 0);

  const bureau = await withDbRetry(() =>
    prisma.bureau.findUnique({ where: { id: bureauId } })
  );
  if (!bureau) {
    return NextResponse.json(
      { error: "Bureau introuvable" },
      { status: 404, headers: jsonHeaders }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.bureauAssignment.deleteMany({
      where: { bureauId, serviceType },
    });
    if (cleanIds.length > 0) {
      await tx.bureauAssignment.createMany({
        data: cleanIds.map((cid) => ({ bureauId, communeId: cid, serviceType })),
        skipDuplicates: true,
      });
    }
  });

  await logActivity(
    auth.user.name,
    "updated",
    "setting",
    `Service assignments ${serviceType} — ${bureau.name}`,
    bureau.id,
    `${cleanIds.length} commune(s)`
  );

  revalidatePath("/api/bureaux/resolve", "layout");
  return NextResponse.json(
    { ok: true, bureauId, serviceType, count: cleanIds.length },
    { headers: jsonHeaders }
  );
}
