import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const section = await prisma.toolSection.findUnique({
    where: { id },
    include: { _count: { select: { tools: true } } },
  });
  if (!section) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(section);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!body.name) return NextResponse.json({ error: "name vide" }, { status: 400 });
    // Vérifier l'unicité
    const existing = await prisma.toolSection.findFirst({
      where: { name: body.name, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: `Une autre section "${body.name}" existe` }, { status: 409 });
    }
    data.name = body.name;
  }
  if (body.description !== undefined) data.description = body.description || null;
  if (body.icon !== undefined) data.icon = body.icon || null;
  if (body.order !== undefined) data.order = body.order;

  const updated = await prisma.toolSection.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;

  const section = await prisma.toolSection.findUnique({
    where: { id },
    include: { _count: { select: { tools: true } } },
  });
  if (!section) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (section._count.tools > 0) {
    return NextResponse.json(
      {
        error: `Cette section contient ${section._count.tools} outil(s). Déplacez-les ou supprimez-les avant.`,
        toolCount: section._count.tools,
      },
      { status: 409 }
    );
  }

  await prisma.toolSection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
