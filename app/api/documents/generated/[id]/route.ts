import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { deleteStoredFile } from "@/lib/documents/storage";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const generated = await prisma.generatedDocument.findUnique({ where: { id } });
  if (!generated) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  if (generated.outputFileId) {
    await deleteStoredFile(generated.outputFileId).catch(() => {});
  }
  await prisma.generatedDocument.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
