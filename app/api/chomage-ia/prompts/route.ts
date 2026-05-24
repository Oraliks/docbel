/**
 * GET /api/chomage-ia/prompts?domain=chomage
 *
 * Historique des prompts générés (les plus récents en premier).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? DEFAULT_DOMAIN;

  const items = await prisma.generatedPrompt.findMany({
    where: { domain },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      brief: true,
      domain: true,
      citedSourceIds: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    items: items.map((p) => ({
      id: p.id,
      title: p.title,
      brief: p.brief,
      domain: p.domain,
      citedCount: p.citedSourceIds.length,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
