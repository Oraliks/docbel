import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockIfFlagOff } from "@/lib/formations/module-guard";
import { trackEvent } from "@/lib/formations/analytics";

const json = { "Content-Type": "application/json; charset=utf-8" };
const schema = z.object({ trainingId: z.string().min(1) });

async function userId(): Promise<string | null> {
  const s = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  return s?.user?.id ?? null;
}

/** Sauvegarde une formation pour l'utilisateur connecté (no-op silencieux si anonyme). */
export async function POST(req: Request) {
  const blocked = await blockIfFlagOff("catalog");
  if (blocked) return blocked;
  const uid = await userId();
  if (!uid) return NextResponse.json({ ok: false, anonymous: true }, { status: 401, headers: json });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "trainingId requis" }, { status: 400, headers: json });

  const training = await prisma.training.findUnique({ where: { id: parsed.data.trainingId }, select: { id: true } });
  if (!training) {
    // Le client envoie un slug ? Tenter par slug.
    const bySlug = await prisma.training.findUnique({ where: { slug: parsed.data.trainingId }, select: { id: true } });
    if (!bySlug) return NextResponse.json({ error: "Formation introuvable" }, { status: 404, headers: json });
    await prisma.trainingSaved.upsert({
      where: { userId_trainingId: { userId: uid, trainingId: bySlug.id } },
      create: { userId: uid, trainingId: bySlug.id },
      update: {},
    });
    await trackEvent("SAVE", { userId: uid, trainingId: bySlug.id });
    return NextResponse.json({ ok: true }, { headers: json });
  }

  await prisma.trainingSaved.upsert({
    where: { userId_trainingId: { userId: uid, trainingId: training.id } },
    create: { userId: uid, trainingId: training.id },
    update: {},
  });
  await trackEvent("SAVE", { userId: uid, trainingId: training.id });
  return NextResponse.json({ ok: true }, { headers: json });
}

/** Retire une formation sauvegardée. Accepte ?id= (training id ou slug). */
export async function DELETE(req: Request) {
  const blocked = await blockIfFlagOff("catalog");
  if (blocked) return blocked;
  const uid = await userId();
  if (!uid) return NextResponse.json({ ok: false, anonymous: true }, { status: 401, headers: json });
  const url = new URL(req.url);
  const key = url.searchParams.get("id");
  if (!key) return NextResponse.json({ error: "id requis" }, { status: 400, headers: json });

  const training =
    (await prisma.training.findUnique({ where: { id: key }, select: { id: true } })) ??
    (await prisma.training.findUnique({ where: { slug: key }, select: { id: true } }));
  if (!training) return NextResponse.json({ ok: true }, { headers: json });

  await prisma.trainingSaved.deleteMany({ where: { userId: uid, trainingId: training.id } });
  return NextResponse.json({ ok: true }, { headers: json });
}
