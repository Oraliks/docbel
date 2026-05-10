import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * GET /api/admin/bureaus/onem-assignments
 *   Liste tous les bureaux ONEM avec leurs communes desservies.
 *
 * PUT /api/admin/bureaus/onem-assignments
 *   Body: { bureauId: string, communeIds: string[] }
 *   Remplace TOUTE la liste des communes desservies par ce bureau ONEM
 *   pour serviceType="chomage".
 */

export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const onemBureaus = await withDbRetry(() =>
    prisma.bureau.findMany({
      where: { type: "ONEM", active: true },
      orderBy: [{ city: "asc" }],
      include: {
        organisme: { select: { id: true, name: true, shortName: true, color: true } },
        assignments: {
          where: { serviceType: "chomage" },
          select: { communeId: true },
        },
      },
    })
  );

  const items = onemBureaus.map((b) => ({
    id: b.id,
    name: b.name,
    city: b.city,
    postalCode: b.postalCode,
    color: b.organisme?.color ?? "#0050A0",
    communeIds: b.assignments.map((a) => a.communeId),
  }));

  return NextResponse.json({ items, total: items.length }, { headers: jsonHeaders });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON invalide" },
      { status: 400, headers: jsonHeaders }
    );
  }

  const bureauId = (body as { bureauId?: string })?.bureauId;
  const communeIds = (body as { communeIds?: unknown })?.communeIds;
  if (typeof bureauId !== "string" || !Array.isArray(communeIds)) {
    return NextResponse.json(
      { error: "Body attendu : { bureauId, communeIds: string[] }" },
      { status: 400, headers: jsonHeaders }
    );
  }
  const cleanIds = communeIds.filter((c): c is string => typeof c === "string" && c.length > 0);

  // Vérifie que le bureau est bien ONEM
  const bureau = await withDbRetry(() =>
    prisma.bureau.findUnique({ where: { id: bureauId } })
  );
  if (!bureau) {
    return NextResponse.json(
      { error: "Bureau introuvable" },
      { status: 404, headers: jsonHeaders }
    );
  }
  if (bureau.type !== "ONEM") {
    return NextResponse.json(
      { error: "Le bureau n'est pas de type ONEM" },
      { status: 400, headers: jsonHeaders }
    );
  }

  // Replace : delete all current + recreate
  await withDbRetry(async () => {
    await prisma.$transaction([
      prisma.bureauAssignment.deleteMany({
        where: { bureauId, serviceType: "chomage" },
      }),
      ...(cleanIds.length > 0
        ? [
            prisma.bureauAssignment.createMany({
              data: cleanIds.map((cid) => ({
                bureauId,
                communeId: cid,
                serviceType: "chomage",
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
  });

  await logActivity(
    auth.user.name,
    "updated",
    "setting",
    `ONEM assignments — ${bureau.name}`,
    bureau.id,
    `${cleanIds.length} commune(s)`
  );

  revalidatePath("/api/bureaus/resolve", "layout");
  return NextResponse.json(
    { ok: true, bureauId, count: cleanIds.length },
    { headers: jsonHeaders }
  );
}
