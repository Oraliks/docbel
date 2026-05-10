import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { serializeBureau } from "@/lib/bureaus/types";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    const bureau = await withDbRetry(() =>
      prisma.bureau.findUnique({
        where: { id },
        include: { organisme: true, commune: true },
      })
    );
    if (!bureau || !bureau.active) {
      return NextResponse.json(
        { error: "Bureau introuvable" },
        { status: 404, headers: jsonHeaders }
      );
    }
    return NextResponse.json(serializeBureau(bureau), { headers: jsonHeaders });
  } catch (error) {
    console.error("[bureaus/:id] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500, headers: jsonHeaders }
    );
  }
}
