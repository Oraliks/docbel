import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportSchema } from "@/lib/formations/schemas";
import { blockIfFlagOff } from "@/lib/formations/module-guard";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Signalement public d'une formation. */
export async function POST(req: Request) {
  const blocked = await blockIfFlagOff("catalog");
  if (blocked) return blocked;
  const body = await req.json().catch(() => null);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400, headers: json },
    );
  }
  const { trainingId, reason, message, reporterEmail } = parsed.data;

  const training = await prisma.training.findUnique({
    where: { id: trainingId },
    select: { id: true },
  });
  if (!training) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404, headers: json });
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);

  await prisma.trainingReport.create({
    data: {
      trainingId,
      reporterId: session?.user?.id ?? null,
      reporterEmail: reporterEmail || null,
      reason,
      message: message || null,
      status: "new",
    },
  });

  return NextResponse.json({ ok: true }, { status: 201, headers: json });
}
