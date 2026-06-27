import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const json = { "Content-Type": "application/json; charset=utf-8" };
const STRATEGIES = ["translate", "translate_gloss", "keep"];

/** GET — liste complète du glossaire (ordonnée). */
export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const terms = await withDbRetry(() =>
    prisma.glossaryTerm.findMany({ orderBy: [{ order: "asc" }, { term: "asc" }] })
  );
  return NextResponse.json({ terms }, { headers: json });
}

/** POST — crée un terme. Body : { term, glossFr, strategy?, note?, category? }. */
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }

  const term = typeof body.term === "string" ? body.term.trim() : "";
  const glossFr = typeof body.glossFr === "string" ? body.glossFr.trim() : "";
  if (!term || !glossFr) {
    return NextResponse.json(
      { error: "term et glossFr sont requis" },
      { status: 400, headers: json }
    );
  }
  const strategy =
    typeof body.strategy === "string" && STRATEGIES.includes(body.strategy)
      ? body.strategy
      : "translate_gloss";

  // Place le nouveau terme en fin de sa catégorie.
  const max = await withDbRetry(() =>
    prisma.glossaryTerm.aggregate({ _max: { order: true } })
  );

  const created = await withDbRetry(() =>
    prisma.glossaryTerm.create({
      data: {
        term,
        glossFr,
        strategy,
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
        category: typeof body.category === "string" ? body.category.trim() : "",
        order: (max._max.order ?? 0) + 1,
      },
    })
  );
  return NextResponse.json(created, { status: 201, headers: json });
}
