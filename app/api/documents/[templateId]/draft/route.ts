import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  return session.user;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { templateId } = await params;
  const draft = await prisma.documentDraft.findUnique({
    where: { templateId_userId: { templateId, userId: user.id } },
  });
  if (!draft) return NextResponse.json({ draft: null });
  return NextResponse.json({ draft });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { templateId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = body?.payload;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "payload requis (objet)" }, { status: 400 });
  }

  const template = await prisma.documentTemplate.findUnique({ where: { id: templateId } });
  if (!template) return NextResponse.json({ error: "Template introuvable" }, { status: 404 });

  const draft = await prisma.documentDraft.upsert({
    where: { templateId_userId: { templateId, userId: user.id } },
    create: { templateId, userId: user.id, payload: payload as object },
    update: { payload: payload as object },
  });
  return NextResponse.json({ draft });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { templateId } = await params;
  await prisma.documentDraft
    .delete({
      where: { templateId_userId: { templateId, userId: user.id } },
    })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
