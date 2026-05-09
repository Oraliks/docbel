import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

export async function GET() {
  const sections = await prisma.toolSection.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { _count: { select: { tools: true } } },
  });
  return NextResponse.json(sections);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, description, icon, order } = body || {};
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name requis" }, { status: 400 });
  }

  const dup = await prisma.toolSection.findUnique({ where: { name } });
  if (dup) {
    return NextResponse.json({ error: `Une section "${name}" existe déjà` }, { status: 409 });
  }

  const created = await prisma.toolSection.create({
    data: {
      name,
      description: description || null,
      icon: icon || null,
      order: typeof order === "number" ? order : 0,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
