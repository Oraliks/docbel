import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

export async function GET() {
  // Lecture publique des bundles actifs (utilisé pour la page publique aussi)
  const bundles = await prisma.documentBundle.findMany({
    where: { active: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      items: {
        orderBy: { order: "asc" },
        include: {
          template: {
            select: {
              id: true,
              tool: { select: { id: true, name: true, slug: true } },
              status: true,
            },
          },
        },
      },
    },
  });
  return NextResponse.json(bundles);
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

  const { slug, name, description, icon, color, order } = body || {};
  if (!slug) return NextResponse.json({ error: "slug requis" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name requis" }, { status: 400 });

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const dup = await prisma.documentBundle.findUnique({ where: { slug: cleanSlug } });
  if (dup) {
    return NextResponse.json({ error: `slug "${cleanSlug}" déjà utilisé` }, { status: 409 });
  }

  const created = await prisma.documentBundle.create({
    data: {
      slug: cleanSlug,
      name,
      description: description || null,
      icon: icon || null,
      color: color || "#7C3AED",
      order: typeof order === "number" ? order : 0,
      createdBy: auth.user.id,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
