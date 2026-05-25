/**
 * POST /api/chomage-ia/ingestion/queue/[id]/reject
 *
 * Marque un IngestedDocument en "rejected". Conserve l'enregistrement pour
 * dédoublonnage des prochains runs (le même URL ne sera plus proposé).
 *
 * Body optionnel : { notes }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;

  let body: { notes?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body optionnel
  }

  const doc = await prisma.ingestedDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }
  if (doc.status !== "pending") {
    return NextResponse.json(
      { error: `Document déjà ${doc.status}` },
      { status: 400 },
    );
  }

  const updated = await prisma.ingestedDocument.update({
    where: { id },
    data: {
      status: "rejected",
      notes: body.notes?.slice(0, 1000) ?? null,
    },
  });

  return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
}
