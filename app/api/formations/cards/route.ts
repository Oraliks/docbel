import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTrainingCardsByIds } from "@/lib/formations/queries";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Renvoie les cartes (publiées) pour une liste de slugs : ?slugs=a,b,c. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("slugs") ?? "";
  const slugs = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (slugs.length === 0) return NextResponse.json({ cards: [] }, { headers: json });

  const rows = await prisma.training.findMany({
    where: { slug: { in: slugs }, status: "published" },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));
  const ids = slugs.map((s) => idBySlug.get(s)).filter((x): x is string => !!x);
  const cards = await getTrainingCardsByIds(ids);
  return NextResponse.json({ cards }, { headers: json });
}
