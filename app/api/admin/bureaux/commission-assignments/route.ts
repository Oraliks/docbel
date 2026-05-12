import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Liens bureau (sectoriel/syndical) ↔ commission paritaire.
 *
 * GET ?bureauId=...     → commissions liées à ce bureau
 * GET ?commissionId=... → bureaus liés à cette commission
 *
 * PUT body: { bureauId, commissionIds: string[], role? }
 *   → replace tout pour ce bureau
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const sp = req.nextUrl.searchParams;
  const bureauId = sp.get("bureauId")?.trim();
  const commissionId = sp.get("commissionId")?.trim();

  if (bureauId) {
    const items = await withDbRetry(() =>
      prisma.bureauCommission.findMany({
        where: { bureauId },
        include: {
          commission: {
            select: { id: true, code: true, numero: true, nom: true, type: true },
          },
        },
        orderBy: { commission: { numero: "asc" } },
      })
    );
    return NextResponse.json(
      {
        items: items.map((bc) => ({
          commissionId: bc.commissionId,
          commission: bc.commission,
          role: bc.role,
        })),
      },
      { headers: jsonHeaders }
    );
  }

  if (commissionId) {
    const items = await withDbRetry(() =>
      prisma.bureauCommission.findMany({
        where: { commissionId },
        include: {
          bureau: {
            include: { organisme: { select: { code: true, shortName: true, color: true } } },
          },
        },
      })
    );
    return NextResponse.json(
      {
        items: items.map((bc) => ({
          bureauId: bc.bureauId,
          bureau: {
            id: bc.bureau.id,
            name: bc.bureau.name,
            city: bc.bureau.city,
            postalCode: bc.bureau.postalCode,
            organismeCode: bc.bureau.organisme?.code ?? null,
            organismeName: bc.bureau.organisme?.shortName ?? null,
            organismeColor: bc.bureau.organisme?.color ?? null,
          },
          role: bc.role,
        })),
      },
      { headers: jsonHeaders }
    );
  }

  // Sinon : liste tous les bureaux candidats (syndicats + mutuelles)
  const bureaus = await withDbRetry(() =>
    prisma.bureau.findMany({
      where: {
        active: true,
        OR: [{ type: "SYNDICAT" }, { organisme: { code: "mutualite" } }],
      },
      include: {
        organisme: { select: { code: true, shortName: true, color: true } },
        commissions: { select: { commissionId: true, role: true } },
      },
      orderBy: [{ city: "asc" }, { name: "asc" }],
    })
  );

  return NextResponse.json(
    {
      items: bureaus.map((b) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        postalCode: b.postalCode,
        organismeCode: b.organisme?.code ?? null,
        organismeName: b.organisme?.shortName ?? null,
        organismeColor: b.organisme?.color ?? "#0050A0",
        commissionIds: b.commissions.map((c) => c.commissionId),
      })),
    },
    { headers: jsonHeaders }
  );
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
  const commissionIds = (body as { commissionIds?: unknown })?.commissionIds;
  const role = ((body as { role?: string })?.role ?? "general") as string;

  if (typeof bureauId !== "string" || !Array.isArray(commissionIds)) {
    return NextResponse.json(
      { error: "Body : { bureauId, commissionIds: string[], role? }" },
      { status: 400, headers: jsonHeaders }
    );
  }
  const cleanIds = commissionIds.filter((c): c is string => typeof c === "string" && c.length > 0);

  const bureau = await withDbRetry(() => prisma.bureau.findUnique({ where: { id: bureauId } }));
  if (!bureau) {
    return NextResponse.json({ error: "Bureau introuvable" }, { status: 404, headers: jsonHeaders });
  }

  await prisma.$transaction(async (tx) => {
    await tx.bureauCommission.deleteMany({ where: { bureauId } });
    if (cleanIds.length > 0) {
      await tx.bureauCommission.createMany({
        data: cleanIds.map((cid) => ({ bureauId, commissionId: cid, role })),
        skipDuplicates: true,
      });
    }
  });

  await logActivity(
    auth.user.name,
    "updated",
    "setting",
    `Commission assignments — ${bureau.name}`,
    bureau.id,
    `${cleanIds.length} CP`
  );

  revalidatePath("/api/bureaux/resolve", "layout");
  return NextResponse.json({ ok: true, bureauId, count: cleanIds.length }, { headers: jsonHeaders });
}
