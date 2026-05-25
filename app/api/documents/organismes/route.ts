import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { OrganismeType } from "@prisma/client";
import { memoCache, memoCacheInvalidate } from "@/lib/memo-cache";

const VALID_TYPES: OrganismeType[] = [
  "federal",
  "regional",
  "local",
  "social",
  "professional",
  "other",
];

const ORGANISMES_CACHE_KEY = "documents:organismes:all";

export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  // Cache 30s : les organismes changent rarement (création manuelle admin),
  // et ce endpoint est pingué par le dashboard de monitoring.
  const organismes = await memoCache(ORGANISMES_CACHE_KEY, 30_000, () =>
    prisma.organisme.findMany({
      orderBy: [{ active: "desc" }, { order: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { templates: true } },
      },
    })
  );
  return NextResponse.json(organismes);
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

  const { code, name, shortName, type, color, logoUrl, website, description, order } = body || {};

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "code requis" }, { status: 400 });
  }
  const cleanCode = code.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  if (!cleanCode) {
    return NextResponse.json({ error: "code invalide" }, { status: 400 });
  }
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name requis" }, { status: 400 });
  }
  if (type && !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type invalide (valeurs: ${VALID_TYPES.join(", ")})` },
      { status: 400 }
    );
  }

  const dup = await prisma.organisme.findUnique({ where: { code: cleanCode } });
  if (dup) {
    return NextResponse.json({ error: `code "${cleanCode}" déjà utilisé` }, { status: 409 });
  }

  const created = await prisma.organisme.create({
    data: {
      code: cleanCode,
      name,
      shortName: shortName || null,
      type: (type as OrganismeType) || "other",
      color: color || "#7C3AED",
      logoUrl: logoUrl || null,
      website: website || null,
      description: description || null,
      order: typeof order === "number" ? order : 0,
      createdBy: auth.user.id,
    },
  });

  memoCacheInvalidate(ORGANISMES_CACHE_KEY);
  return NextResponse.json(created, { status: 201 });
}
