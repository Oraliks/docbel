import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Auto-assigne toutes les communes d'une province (ou région) à un bureau,
 * pour un serviceType donné. Version générique de l'ancien
 * /admin/bureaux/onem-assignments/auto-by-province (qui n'acceptait que
 * type=ONEM + serviceType=chomage hardcodé).
 *
 * POST {
 *   bureauId: string,
 *   serviceType: string,   // "chomage" | "paiement_capac" | …
 *   scope: { province?: string, region?: BelgianRegion },
 *   mode: "replace" | "merge"
 * }
 *  - replace : supprime les assignments existants du bureau pour ce
 *              serviceType et met seulement les nouvelles
 *  - merge   : ajoute aux existantes
 */
const KNOWN_SERVICE_TYPES = [
  "chomage",
  "paiement_capac",
  "paiement_fgtb",
  "paiement_csc",
  "paiement_cgslb",
  "mutuelle_solidaris",
  "mutuelle_mc",
  "mutuelle_mloz",
  "mutuelle_mutlibres",
  "mutuelle_neutrales",
  "emploi_regional",
  "pension",
];

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: jsonHeaders });
  }

  const raw = body as Record<string, unknown>;
  const bureauId = String(raw.bureauId ?? "").trim();
  const serviceType = String(raw.serviceType ?? "").trim();
  const scope = (raw.scope ?? {}) as { province?: string; region?: string };
  const mode = (raw.mode === "replace" ? "replace" : "merge") as "replace" | "merge";

  if (!bureauId) {
    return NextResponse.json({ error: "bureauId requis" }, { status: 400, headers: jsonHeaders });
  }
  if (!serviceType || !KNOWN_SERVICE_TYPES.includes(serviceType)) {
    return NextResponse.json(
      { error: `serviceType invalide. Valeurs : ${KNOWN_SERVICE_TYPES.join(", ")}` },
      { status: 400, headers: jsonHeaders }
    );
  }
  if (!scope.province && !scope.region) {
    return NextResponse.json(
      { error: "scope.province ou scope.region requis" },
      { status: 400, headers: jsonHeaders }
    );
  }

  const bureau = await withDbRetry(() => prisma.bureau.findUnique({ where: { id: bureauId } }));
  if (!bureau) {
    return NextResponse.json({ error: "Bureau introuvable" }, { status: 404, headers: jsonHeaders });
  }

  // Récupère les communes du scope
  const communes = await withDbRetry(() =>
    prisma.commune.findMany({
      where: {
        ...(scope.province ? { province: scope.province } : {}),
        ...(scope.region
          ? { region: scope.region as "wallonia" | "flanders" | "brussels" | "germanophone" }
          : {}),
      },
      select: { id: true },
    })
  );

  if (communes.length === 0) {
    return NextResponse.json(
      { error: "Aucune commune trouvée pour ce scope" },
      { status: 404, headers: jsonHeaders }
    );
  }

  await prisma.$transaction(async (tx) => {
    if (mode === "replace") {
      await tx.bureauAssignment.deleteMany({
        where: { bureauId, serviceType },
      });
    }
    await tx.bureauAssignment.createMany({
      data: communes.map((c) => ({
        bureauId,
        communeId: c.id,
        serviceType,
      })),
      skipDuplicates: true,
    });
  });

  await logActivity(
    auth.user.name,
    "updated",
    "setting",
    `Auto-assign ${serviceType} — ${bureau.name}`,
    bureauId,
    `${mode}: ${communes.length} communes (scope=${JSON.stringify(scope)})`
  );

  revalidatePath("/api/bureaux/resolve", "layout");
  return NextResponse.json(
    { ok: true, applied: communes.length, mode, serviceType },
    { headers: jsonHeaders }
  );
}
