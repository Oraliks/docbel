import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

/**
 * GET /api/inbox/stats — per-folder counts (total + unread for INBOX).
 */
export async function GET() {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const grouped = await prisma.inboxEmail.groupBy({
      by: ["folder"],
      _count: { _all: true },
    });
    const unreadInbox = await prisma.inboxEmail.count({
      where: { folder: "INBOX", isRead: false },
    });

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
    return NextResponse.json({ counts, unreadInbox });
  } catch (err) {
    console.error("[inbox/stats] failed:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
