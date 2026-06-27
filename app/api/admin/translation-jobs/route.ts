import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import {
  processTranslationJobs,
  requeueFailedJobs,
} from "@/lib/i18n/translation-queue";

const json = { "Content-Type": "application/json; charset=utf-8" };
const STATUSES = ["pending", "processing", "done", "failed"];

/**
 * GET — état de la file de traduction.
 * Query : status? (filtre), limit? (défaut 50).
 * Renvoie { counts: {pending,processing,done,failed}, jobs: [...] }.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status")?.trim() || "";
  const limit = Math.min(
    Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50,
    200
  );

  const where = STATUSES.includes(statusParam) ? { status: statusParam } : {};

  const [grouped, jobs] = await withDbRetry(() =>
    prisma.$transaction([
      prisma.translationJob.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.translationJob.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
    ])
  );

  const counts: Record<string, number> = { pending: 0, processing: 0, done: 0, failed: 0 };
  for (const g of grouped) counts[g.status] = g._count._all;

  return NextResponse.json({ counts, jobs }, { headers: json });
}

/**
 * POST — actions sur la file.
 * Body : { action: "retry" | "process" }
 *   - retry   : remet "pending" les jobs failed + processing bloqués, puis traite.
 *   - process : traite simplement les jobs pending en attente.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = body.action === "retry" ? "retry" : "process";

  let requeued = 0;
  if (action === "retry") {
    requeued = await requeueFailedJobs();
  }
  const result = await processTranslationJobs({ limit: 200 });

  return NextResponse.json({ action, requeued, ...result }, { headers: json });
}
