import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { markFolderAllRead, type Folder } from "@/lib/inbox/imap";
import { logActivity } from "@/lib/activity-logger";

const VALID: Folder[] = ["INBOX", "SENT", "SPAM", "ARCHIVE", "TRASH"];

/**
 * POST /api/inbox/mark-all-read?folder=INBOX
 * Marks every unread message in the folder as \Seen on the IMAP server,
 * then updates the local DB cache.
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const folder = (request.nextUrl.searchParams.get("folder") || "INBOX") as Folder;
  if (!VALID.includes(folder)) {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }

  try {
    const serverCount = await markFolderAllRead(folder);
    const dbResult = await prisma.inboxEmail.updateMany({
      where: { folder, isRead: false },
      data: { isRead: true },
    });
    await logActivity(
      "Admin",
      "updated",
      "inbox",
      folder,
      undefined,
      `Mark-all-read: server ${serverCount}, db ${dbResult.count}`
    );
    return NextResponse.json({ count: dbResult.count });
  } catch (err) {
    console.error("[inbox/mark-all-read] failed:", err);
    const message = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
