import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/auth-check";

/// GET → retourne le snapshot OCR pour ce hash, ou 404.
/// Permet à l'éditeur visuel de proposer "restaurer la détection précédente"
/// au lieu de relancer l'OCR sur un PDF déjà traité.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sha256: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { sha256 } = await params;
  if (!sha256 || !/^[a-f0-9]{64}$/i.test(sha256)) {
    return NextResponse.json({ error: "sha256 invalide" }, { status: 400 });
  }

  const snap = await prisma.ocrSnapshot.findUnique({
    where: { sha256: sha256.toLowerCase() },
  });
  if (!snap) {
    return NextResponse.json({ found: false }, { status: 404 });
  }
  return NextResponse.json({
    found: true,
    sha256: snap.sha256,
    detectedFields: snap.detectedFields,
    pageCount: snap.pageCount,
    createdAt: snap.createdAt.toISOString(),
    templateId: snap.templateId,
  });
}

/// POST → crée ou met à jour le snapshot pour ce hash.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sha256: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { sha256 } = await params;
  if (!sha256 || !/^[a-f0-9]{64}$/i.test(sha256)) {
    return NextResponse.json({ error: "sha256 invalide" }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.detectedFields)) {
    return NextResponse.json({ error: "detectedFields[] requis" }, { status: 400 });
  }
  if (typeof body.pageCount !== "number") {
    return NextResponse.json({ error: "pageCount requis" }, { status: 400 });
  }

  const lower = sha256.toLowerCase();
  const detectedFields = body.detectedFields as Prisma.InputJsonValue;
  const saved = await prisma.ocrSnapshot.upsert({
    where: { sha256: lower },
    create: {
      sha256: lower,
      fileId: body.fileId || null,
      detectedFields,
      pageCount: body.pageCount,
      templateId: body.templateId || null,
    },
    update: {
      detectedFields,
      pageCount: body.pageCount,
      fileId: body.fileId || null,
      templateId: body.templateId || null,
    },
  });
  return NextResponse.json({ ok: true, id: saved.id });
}
