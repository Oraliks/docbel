import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { readSourcePdf } from "@/lib/pdf-forms/storage";

/// GET — sert le PDF source d'un formulaire (admin uniquement). Utilisé par
/// l'éditeur visuel (react-pdf charge l'URL côté navigateur). Pas de cache
/// long pour éviter de servir un PDF obsolète après matérialisation.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const form = await prisma.pdfForm.findUnique({
    where: { id },
    select: { sourceStoragePath: true, sourceFileName: true, updatedAt: true },
  });
  if (!form) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const buf = await readSourcePdf(form.sourceStoragePath);
  if (!buf) return NextResponse.json({ error: "PDF source introuvable" }, { status: 404 });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${form.sourceFileName}"`,
      "Cache-Control": "private, no-cache, must-revalidate",
      // ETag basé sur updatedAt — permet aux clients de revalider gratuitement.
      ETag: `W/"${form.updatedAt.getTime()}"`,
    },
  });
}
