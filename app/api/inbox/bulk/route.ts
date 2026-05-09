import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { bulkSetFlags, bulkMoveMessages, type Folder } from "@/lib/inbox/imap";
import { logActivity } from "@/lib/activity-logger";

const VALID: Folder[] = ["INBOX", "SENT", "SPAM", "ARCHIVE", "TRASH"];
function asFolder(s: string): Folder | null {
  return VALID.includes(s as Folder) ? (s as Folder) : null;
}

/**
 * POST /api/inbox/bulk
 * Body: { ids: string[], action: 'read' | 'unread' | 'archive' | 'spam' | 'trash' | 'inbox' | 'delete' }
 *
 * Applies one action to multiple emails. All ids must be in the same folder
 * (we group by folder server-side anyway).
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids.filter((s: unknown) => typeof s === "string") : [];
  const action = typeof body.action === "string" ? body.action : "";
  if (ids.length === 0) {
    return NextResponse.json({ error: "Aucun email sélectionné" }, { status: 400 });
  }

  const emails = await prisma.inboxEmail.findMany({
    where: { id: { in: ids } },
    select: { id: true, folder: true, uid: true },
  });
  if (emails.length === 0) {
    return NextResponse.json({ error: "Emails introuvables" }, { status: 404 });
  }

  // Group by source folder
  const byFolder = new Map<Folder, number[]>();
  for (const e of emails) {
    const folder = asFolder(e.folder);
    if (!folder) continue;
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder)!.push(e.uid);
  }

  try {
    let affected = 0;

    for (const [folder, uids] of byFolder) {
      switch (action) {
        case "read":
          await bulkSetFlags(folder, uids, { add: ["\\Seen"] });
          break;
        case "unread":
          await bulkSetFlags(folder, uids, { remove: ["\\Seen"] });
          break;
        case "archive":
          await bulkMoveMessages(folder, uids, "ARCHIVE");
          break;
        case "spam":
          await bulkMoveMessages(folder, uids, "SPAM");
          break;
        case "inbox":
          await bulkMoveMessages(folder, uids, "INBOX");
          break;
        case "trash":
          await bulkMoveMessages(folder, uids, "TRASH");
          break;
        case "delete":
          // Only allowed when source folder is TRASH; otherwise treat as move-to-trash
          if (folder === "TRASH") {
            await bulkSetFlags(folder, uids, { add: ["\\Deleted"] });
          } else {
            await bulkMoveMessages(folder, uids, "TRASH");
          }
          break;
        default:
          return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
      }
      affected += uids.length;
    }

    // Update local DB to reflect the change
    if (action === "read") {
      await prisma.inboxEmail.updateMany({ where: { id: { in: ids } }, data: { isRead: true } });
    } else if (action === "unread") {
      await prisma.inboxEmail.updateMany({ where: { id: { in: ids } }, data: { isRead: false } });
    } else {
      // Move actions: drop local rows; next sync will pull fresh copies in the new folder
      await prisma.inboxEmail.deleteMany({ where: { id: { in: ids } } });
    }

    await logActivity(
      "Admin",
      action === "delete" ? "deleted" : "updated",
      "inbox",
      "bulk",
      undefined,
      `${action} on ${affected} email(s)`
    );

    return NextResponse.json({ affected });
  } catch (err) {
    console.error("[inbox/bulk] failed:", err);
    const message = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
