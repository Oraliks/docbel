import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { memoCache } from "@/lib/memo-cache";

/**
 * GET /api/inbox/stats — per-folder counts (total + unread for INBOX).
 *
 * groupBy + count en parallèle (Promise.all) au lieu de séquentiel.
 * Cache 10s mémoire : les compteurs inbox sont pingés en boucle par
 * le sidebar admin, pas besoin de re-tape la DB à chaque rendu.
 */
async function buildInboxStats() {
  const [grouped, unreadInbox] = await Promise.all([
    prisma.inboxEmail.groupBy({
      by: ["folder"],
      _count: { _all: true },
    }),
    prisma.inboxEmail.count({
      where: { folder: "INBOX", isRead: false },
    }),
  ]);

  const counts: Record<string, number> = {
    INBOX: 0,
    SENT: 0,
    SPAM: 0,
    ARCHIVE: 0,
    TRASH: 0,
  };
  for (const g of grouped) {
    counts[g.folder] = g._count._all;
  }
  return { counts, unreadInbox };
}

export async function GET() {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const payload = await memoCache("inbox:stats", 10_000, buildInboxStats);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[inbox/stats] failed:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
