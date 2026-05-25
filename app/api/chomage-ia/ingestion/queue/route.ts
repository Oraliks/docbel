/**
 * GET /api/chomage-ia/ingestion/queue?domain=chomage&status=pending
 *
 * Liste des IngestedDocument filtrés. Tri par fetchedAt DESC. Limite 200.
 * `domain` filtre via la jointure IngestionSource.domain (pas direct).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import {
  DEFAULT_DOMAIN,
  type IngestedDocumentListItem,
} from "@/lib/chomage-ia/types";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? DEFAULT_DOMAIN;
  const status = url.searchParams.get("status") ?? "pending";
  const allowedStatus = ["pending", "validated", "rejected"];
  if (!allowedStatus.includes(status)) {
    return NextResponse.json({ error: "status invalide" }, { status: 400 });
  }

  const rows = await prisma.ingestedDocument.findMany({
    where: {
      status,
      ingestionSource: { domain },
    },
    include: { ingestionSource: { select: { name: true } } },
    orderBy: { fetchedAt: "desc" },
    take: 200,
  });

  const items: IngestedDocumentListItem[] = rows.map((r) => ({
    id: r.id,
    ingestionSourceId: r.ingestionSourceId,
    ingestionSourceName: r.ingestionSource.name,
    externalUrl: r.externalUrl,
    title: r.title,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    fetchedAt: r.fetchedAt.toISOString(),
    status: r.status as IngestedDocumentListItem["status"],
    knowledgeSourceId: r.knowledgeSourceId,
    notes: r.notes,
  }));

  return NextResponse.json({ items, count: items.length });
}
