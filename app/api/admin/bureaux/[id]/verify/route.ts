import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Marque un bureau comme "vérifié" (coordonnées à jour).
 * POST → vérifie maintenant
 * DELETE → retire la vérification (re-flag à vérifier)
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await ctx.params;
  try {
    const updated = await withDbRetry(() =>
      prisma.bureau.update({
        where: { id },
        data: {
          verified: true,
          lastVerifiedAt: new Date(),
          verifiedBy: auth.user.id,
        },
      })
    );
    await logActivity(
      auth.user.name,
      "updated",
      "setting",
      `Bureau vérifié - ${updated.name}`,
      updated.id
    );
    revalidatePath("/api/bureaux", "layout");
    return NextResponse.json({ ok: true, verifiedAt: updated.lastVerifiedAt }, { headers: jsonHeaders });
  } catch (error) {
    console.error("[verify] error:", error);
    return NextResponse.json(
      { error: "Échec" },
      { status: 500, headers: jsonHeaders }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await ctx.params;
  await withDbRetry(() =>
    prisma.bureau.update({
      where: { id },
      data: { verified: false, verifiedBy: null, lastVerifiedAt: null },
    })
  );
  return NextResponse.json({ ok: true }, { headers: jsonHeaders });
}
