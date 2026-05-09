import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const VALID_FOLDERS = ["INBOX", "SENT", "SPAM", "ARCHIVE", "TRASH"] as const;
type Folder = (typeof VALID_FOLDERS)[number];

function isFolder(s: string): s is Folder {
  return (VALID_FOLDERS as readonly string[]).includes(s);
}

/**
 * GET /api/inbox?folder=INBOX&q=hello&flagged=1
 *
 * Returns the list view (without bodies) for one folder. Each item is
 * augmented with `isReplied` — true if any SENT email's In-Reply-To matches
 * its Message-ID, computed in a single batch query.
 *
 * Query params:
 *   - folder: which folder (default INBOX)
 *   - q: free-text search across from / subject / textBody
 *   - flagged: "1" to filter to starred emails only
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const folderParam = request.nextUrl.searchParams.get("folder") || "INBOX";
  if (!isFolder(folderParam)) {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const flaggedOnly = request.nextUrl.searchParams.get("flagged") === "1";

  try {
    const where: Prisma.InboxEmailWhereInput = { folder: folderParam };
    if (flaggedOnly) where.isFlagged = true;
    if (q.length > 0) {
      where.OR = [
        { subject: { contains: q, mode: "insensitive" } },
        { fromAddress: { contains: q, mode: "insensitive" } },
        { fromName: { contains: q, mode: "insensitive" } },
        { textBody: { contains: q, mode: "insensitive" } },
      ];
    }

    const emails = await prisma.inboxEmail.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: 200,
      select: {
        id: true,
        folder: true,
        uid: true,
        fromAddress: true,
        fromName: true,
        replyToAddress: true,
        toAddresses: true,
        subject: true,
        textBody: true,
        isRead: true,
        isFlagged: true,
        receivedAt: true,
        attachments: true,
        messageId: true,
        inReplyTo: true,
      },
    });

    // Compute "isReplied" + thread size for INBOX items
    let repliedSet = new Set<string>();
    const threadSizeByMessageId = new Map<string, number>();

    if (folderParam === "INBOX" || folderParam === "ARCHIVE") {
      const messageIds = emails.map((e) => e.messageId).filter((id): id is string => Boolean(id));
      if (messageIds.length > 0) {
        const replies = await prisma.inboxEmail.findMany({
          where: {
            OR: [
              { folder: "SENT", inReplyTo: { in: messageIds } },
              { messageId: { in: messageIds } },
              { inReplyTo: { in: messageIds } },
            ],
          },
          select: { messageId: true, inReplyTo: true, folder: true },
        });
        repliedSet = new Set(
          replies
            .filter((r) => r.folder === "SENT")
            .map((r) => r.inReplyTo)
            .filter((id): id is string => Boolean(id))
        );
        // Approximate thread size — count distinct Message-IDs that share inReplyTo or messageId
        for (const id of messageIds) {
          const linked = replies.filter((r) => r.messageId === id || r.inReplyTo === id).length;
          threadSizeByMessageId.set(id, linked);
        }
      }
    }

    const enriched = emails.map((e) => ({
      ...e,
      isReplied: e.messageId ? repliedSet.has(e.messageId) : false,
      threadSize: e.messageId ? (threadSizeByMessageId.get(e.messageId) || 0) + 1 : 1,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    console.error("[inbox] list failed:", err);
    return NextResponse.json({ error: "Failed to fetch inbox" }, { status: 500 });
  }
}
