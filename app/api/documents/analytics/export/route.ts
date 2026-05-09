import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

/// Export CSV des événements analytics, optionnellement filtré par template.
/// Limité aux 30 derniers jours par défaut, configurable via ?days=X.
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10)));
  const templateId = url.searchParams.get("templateId");

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where: Record<string, unknown> = { createdAt: { gte: since } };
  if (templateId) where.templateId = templateId;

  const events = await prisma.formAnalyticsEvent.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      template: { include: { tool: { select: { name: true, slug: true } } } },
    },
  });

  // Construire le CSV
  const header = [
    "createdAt",
    "templateName",
    "templateSlug",
    "eventType",
    "contextKey",
    "sessionId",
    "userId",
    "metadata",
  ].join(",");

  const rows = events.map((e) => {
    const cells = [
      e.createdAt.toISOString(),
      escapeCsv(e.template.tool.name),
      e.template.tool.slug,
      e.eventType,
      escapeCsv(e.contextKey ?? ""),
      e.sessionId,
      e.userId ?? "",
      escapeCsv(e.metadata ? JSON.stringify(e.metadata) : ""),
    ];
    return cells.join(",");
  });

  const csv = [header, ...rows].join("\n");
  const filename = `analytics-${days}d${templateId ? `-${templateId}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
