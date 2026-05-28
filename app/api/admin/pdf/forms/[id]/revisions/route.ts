import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET — historique des versions d'un formulaire (sans le schéma complet).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const revisions = await prisma.pdfFormRevision.findMany({
    where: { formId: id },
    orderBy: { version: "desc" },
    take: 100,
    select: {
      id: true, version: true, changeType: true, changeNotes: true,
      diffSummary: true, sourceFileName: true, createdBy: true, createdAt: true,
    },
  });
  return NextResponse.json(revisions, { headers: json });
}
