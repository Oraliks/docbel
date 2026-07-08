import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET — check si un `publicPath` est disponible.
///
/// Query params :
///   - path        : la valeur candidate (ex. "onem/c1")
///   - excludeId   : optionnel, id du PdfForm en cours d'édition (pour ne
///                   pas se signaler soi-même comme collision)
///
/// Réponses :
///   { available: true }
///   { available: false, taken_by: { id, slug, title } }
///
/// Sert au form-settings admin (feedback ✓/✗ inline avant le save 409).
/// N'expose que titre + slug — pas de secret côté PdfForm.
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const rawPath = (url.searchParams.get("path") || "").trim().toLowerCase();
  const excludeId = url.searchParams.get("excludeId") || null;

  // Normalisation identique à ce qui est appliqué côté PATCH
  // (app/api/admin/pdf/forms/[id]/route.ts). Un input vide/normalisé à vide
  // = pas d'URL publique demandée → toujours disponible.
  const normalized = rawPath.replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return NextResponse.json({ available: true }, { headers: json });
  }

  const collision = await prisma.pdfForm.findFirst({
    where: { publicPath: normalized, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true, slug: true, title: true },
  });

  if (!collision) {
    return NextResponse.json({ available: true }, { headers: json });
  }
  return NextResponse.json(
    {
      available: false,
      taken_by: { id: collision.id, slug: collision.slug, title: collision.title },
    },
    { headers: json }
  );
}
