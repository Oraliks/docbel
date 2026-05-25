/**
 * Routes API pour les gaps de connaissance (Feature 6).
 *
 * GET  /api/chomage-ia/gaps?domain=chomage&status=open
 *
 * Listing ordonné par occurrences DESC (priorité aux questions répétées) puis
 * detectedAt DESC. Limite 200 (la UI affiche tout, mais on cap pour ne pas
 * exploser la bande passante).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import {
  DEFAULT_DOMAIN,
  KNOWLEDGE_GAP_STATUSES,
  type KnowledgeGapListItem,
} from "@/lib/chomage-ia/types";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? DEFAULT_DOMAIN;
  const statusParam = url.searchParams.get("status");

  const where: Record<string, unknown> = { domain };
  if (
    statusParam &&
    (KNOWLEDGE_GAP_STATUSES as readonly string[]).includes(statusParam)
  ) {
    where.status = statusParam;
  }

  const rows = await prisma.knowledgeGap.findMany({
    where,
    orderBy: [{ occurrences: "desc" }, { detectedAt: "desc" }],
    take: 200,
  });

  const items: KnowledgeGapListItem[] = rows.map((r) => ({
    id: r.id,
    query: r.query,
    detectedAt: r.detectedAt.toISOString(),
    sessionId: r.sessionId,
    messageId: r.messageId,
    status: r.status as KnowledgeGapListItem["status"],
    resolvedBy: r.resolvedBy,
    knowledgeSourceId: r.knowledgeSourceId,
    notes: r.notes,
    occurrences: r.occurrences,
    domain: r.domain,
  }));

  // Aggrégation lite par status pour la sidebar / header.
  const counts = await prisma.knowledgeGap.groupBy({
    by: ["status"],
    where: { domain },
    _count: { _all: true },
  });
  const countsByStatus: Record<string, number> = {
    open: 0,
    resolved: 0,
    ignored: 0,
  };
  for (const c of counts) {
    countsByStatus[c.status] = c._count._all;
  }

  return NextResponse.json({
    items,
    count: items.length,
    countsByStatus,
  });
}
