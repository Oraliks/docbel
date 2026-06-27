import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const json = { "Content-Type": "application/json; charset=utf-8" };
const STRATEGIES = ["translate", "translate_gloss", "keep"];

/** PATCH — édite un terme. Body partiel : { term?, glossFr?, strategy?, note?, category? }. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }

  const data: Prisma.GlossaryTermUpdateInput = {};
  if (typeof body.term === "string") {
    if (!body.term.trim())
      return NextResponse.json({ error: "term vide" }, { status: 400, headers: json });
    data.term = body.term.trim();
  }
  if (typeof body.glossFr === "string") {
    if (!body.glossFr.trim())
      return NextResponse.json({ error: "glossFr vide" }, { status: 400, headers: json });
    data.glossFr = body.glossFr.trim();
  }
  if (typeof body.strategy === "string") {
    if (!STRATEGIES.includes(body.strategy))
      return NextResponse.json({ error: "stratégie invalide" }, { status: 400, headers: json });
    data.strategy = body.strategy;
  }
  if (body.note !== undefined)
    data.note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  if (typeof body.category === "string") data.category = body.category.trim();

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400, headers: json });

  try {
    const updated = await withDbRetry(() =>
      prisma.glossaryTerm.update({ where: { id }, data })
    );
    return NextResponse.json(updated, { headers: json });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
      return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });
    console.error("PATCH /api/admin/glossary/[id]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500, headers: json });
  }
}

/** DELETE — supprime un terme. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  try {
    await withDbRetry(() => prisma.glossaryTerm.delete({ where: { id } }));
    return NextResponse.json({ ok: true }, { headers: json });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
      return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });
    console.error("DELETE /api/admin/glossary/[id]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500, headers: json });
  }
}
