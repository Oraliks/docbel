import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const revisions = await prisma.documentTemplateRevision.findMany({
    where: { templateId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(revisions);
}
