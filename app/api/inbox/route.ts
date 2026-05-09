import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const VALID_FOLDERS = ["INBOX", "SENT", "SPAM", "ARCHIVE", "TRASH"] as const;
type Folder = (typeof VALID_FOLDERS)[number];

function isFolder(s: string): s is Folder {
  return (VALID_FOLDERS as readonly string[]).includes(s);
}

/**
 * GET /api/inbox?folder=INBOX
 *
 * Returns the list view (without bodies) for one folder. Each item is
 * augmented with `isReplied` — true if any SENT email's In-Reply-To matches
 * its Message-ID, computed in a single batch query.
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const folderParam = request.nextUrl.searchParams.get("folder") || "INBOX";
  if (!isFolder(folderParam)) {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }

  try {
    const emails = await prisma.inboxEmail.findMany({
      where: { folder: folderParam },
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
        receivedAt: true,
        attachments: true,
        messageId: true,
      },
    });

    // Compute "isReplied" for INBOX items by checking SENT folder for matching In-Reply-To
    let repliedSet = new Set<string>();
    if (folderParam === "INBOX") {
      const messageIds = emails.map((e) => e.messageId).filter((id): id is string => Boolean(id));
      if (messageIds.length > 0) {
        const replies = await prisma.inboxEmail.findMany({
          where: { folder: "SENT", inReplyTo: { in: messageIds } },
          select: { inReplyTo: true },
        });
        repliedSet = new Set(replies.map((r) => r.inReplyTo).filter((id): id is string => Boolean(id)));
      }
    }

    const enriched = emails.map((e) => ({
      ...e,
      isReplied: e.messageId ? repliedSet.has(e.messageId) : false,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    console.error("[inbox] list failed:", err);
    return NextResponse.json({ error: "Failed to fetch inbox" }, { status: 500 });
  }
}

