import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bundle = await prisma.documentBundle.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: {
          template: {
            include: {
              tool: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      },
    },
  });
  if (!bundle) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(bundle);
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
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description || null;
  if (body.icon !== undefined) data.icon = body.icon || null;
  if (body.color !== undefined) data.color = body.color || "#7C3AED";
  if (body.order !== undefined) data.order = body.order;
  if (body.active !== undefined) data.active = !!body.active;

  // Mise à jour des items (remplacement complet de la liste)
  if (Array.isArray(body.items)) {
    await prisma.documentBundleItem.deleteMany({ where: { bundleId: id } });
    type IncomingItem = {
      templateId: string;
      order?: number;
      required?: boolean;
      condition?: { fieldId: string; equals: unknown } | null;
    };
    const items = body.items as IncomingItem[];
    if (items.length > 0) {
      await prisma.documentBundleItem.createMany({
        data: items.map((it, idx) => ({
          bundleId: id,
          templateId: it.templateId,
          order: typeof it.order === "number" ? it.order : idx,
          required: it.required !== false,
          condition: it.condition ?? undefined,
        })),
      });
    }
  }

  const updated = await prisma.documentBundle.update({
    where: { id },
    data,
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { template: { include: { tool: true } } },
      },
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;

  // Soft-delete par défaut (préserve l'historique). Hard-delete si ?hard=true.
  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "true";

  if (hard) {
    await prisma.documentBundle.delete({ where: { id } });
    return NextResponse.json({ ok: true, hardDeleted: true });
  }

  // Vérifier s'il y a des runs en cours (auquel cas on force le soft-delete)
  const runCount = await prisma.bundleRun.count({ where: { bundleId: id } });
  await prisma.documentBundle.update({
    where: { id },
    data: { active: false },
  });
  return NextResponse.json({
    ok: true,
    softDeleted: true,
    runCount,
    message: runCount > 0
      ? `Bundle désactivé (${runCount} run(s) historique préservé(s)).`
      : "Bundle désactivé.",
  });
}
