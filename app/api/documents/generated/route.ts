import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const templateId = url.searchParams.get("templateId");
  const userFilter = url.searchParams.get("user"); // "all" | "anonymous" | "authenticated"
  const emailedOnly = url.searchParams.get("emailedOnly") === "true";

  const where: Record<string, unknown> = {};
  if (templateId) where.templateId = templateId;
  if (userFilter === "anonymous") where.userId = null;
  if (userFilter === "authenticated") where.userId = { not: null };
  if (emailedOnly) where.emailSentTo = { not: null };

  const [total, items] = await Promise.all([
    prisma.generatedDocument.count({ where }),
    prisma.generatedDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        template: { include: { tool: { select: { name: true, slug: true } } } },
        outputFile: { select: { id: true, name: true, size: true, filePath: true } },
      },
    }),
  ]);

  // On ne renvoie pas filePath au client pour éviter d'exposer les chemins internes
  const sanitized = items.map((g) => ({
    id: g.id,
    templateId: g.templateId,
    templateName: g.template.tool.name,
    templateSlug: g.template.tool.slug,
    userId: g.userId,
    isAnonymous: !g.userId,
    emailSentTo: g.emailSentTo,
    payloadHash: g.payloadHash.slice(0, 12),
    createdAt: g.createdAt.toISOString(),
    expiresAt: g.expiresAt.toISOString(),
    isExpired: g.expiresAt < new Date(),
    fileExists: !!g.outputFile,
    fileSize: g.outputFile?.size || null,
    fileName: g.outputFile?.name || null,
  }));

  // Liste des templates pour le filtre dropdown
  const templates = await prisma.documentTemplate.findMany({
    where: { generated: { some: {} } },
    select: { id: true, tool: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    items: sanitized,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
    templates: templates.map((t) => ({ id: t.id, name: t.tool.name })),
  });
}
