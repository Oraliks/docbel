import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";
import { sendContactReply } from "@/lib/inbox/send";
import { setReadFlag, moveMessage, deleteMessage, type Folder } from "@/lib/inbox/imap";

function asFolder(s: string): Folder {
  if (s === "INBOX" || s === "SENT" || s === "SPAM" || s === "ARCHIVE" || s === "TRASH") return s;
  throw new Error(`Invalid folder: ${s}`);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await params;
  const email = await prisma.inboxEmail.findUnique({ where: { id } });
  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  // Auto-mark as read on open — but only for INBOX/SPAM (sent items don't get a "read" notion)
  if (!email.isRead && (email.folder === "INBOX" || email.folder === "SPAM")) {
    try {
      await setReadFlag(asFolder(email.folder), email.uid, true);
      await prisma.inboxEmail.update({ where: { id }, data: { isRead: true } });
      email.isRead = true;
    } catch (err) {
      console.error("[inbox/get] failed to mark read on server:", err);
    }
  }

  return NextResponse.json(email);
}

/**
 * PATCH — toggle read state, or move between folders.
 * Body: { isRead?: boolean, moveTo?: Folder }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await params;
  const body = await request.json();

  const email = await prisma.inboxEmail.findUnique({ where: { id } });
  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  try {
    if (typeof body.isRead === "boolean" && body.isRead !== email.isRead) {
      await setReadFlag(asFolder(email.folder), email.uid, body.isRead);
      await prisma.inboxEmail.update({ where: { id }, data: { isRead: body.isRead } });
      email.isRead = body.isRead;
    }

    if (typeof body.moveTo === "string") {
      const target = asFolder(body.moveTo);
      if (target !== email.folder) {
        await moveMessage(asFolder(email.folder), email.uid, target);
        // After IMAP move, our local UID is stale (target folder assigns new UID).
        // Simplest is to delete the local row — next sync will pull it fresh from
        // the destination folder with the correct UID.
        await prisma.inboxEmail.delete({ where: { id } });
        return NextResponse.json({ moved: true, target });
      }
    }

    return NextResponse.json(email);
  } catch (err) {
    console.error("[inbox/patch] failed:", err);
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE — moves to Trash (Éléments supprimés) for INBOX/SENT/SPAM/ARCHIVE.
 * For emails already in TRASH, performs a permanent delete (\Deleted + EXPUNGE).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await params;
  const email = await prisma.inboxEmail.findUnique({ where: { id } });
  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  try {
    if (email.folder === "TRASH") {
      await deleteMessage("TRASH", email.uid);
      await prisma.inboxEmail.delete({ where: { id } });
    } else {
      await moveMessage(asFolder(email.folder), email.uid, "TRASH");
      await prisma.inboxEmail.delete({ where: { id } });
    }
    await logActivity(
      "Admin",
      "deleted",
      "email",
      email.fromAddress,
      id,
      `Sujet: ${email.subject} (folder: ${email.folder})`
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[inbox/delete] failed:", err);
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST — send a reply via Resend + APPEND to IMAP Sent.
 * Body: { subject, text }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await params;
  const body = await request.json();
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.text === "string" ? body.text : "";

  if (!subject || !text.trim()) {
    return NextResponse.json(
      { error: "Sujet et message obligatoires" },
      { status: 400 }
    );
  }

  const email = await prisma.inboxEmail.findUnique({ where: { id } });
  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  // Reply destination: prefer Reply-To header if the original had one
  // (form submissions set it to the visitor's address; direct emails usually don't).
  const recipient = email.replyToAddress || email.fromAddress;
  const recipientName = email.replyToAddress ? email.replyToName : email.fromName;

  try {
    await sendContactReply({
      to: recipient,
      toName: recipientName,
      subject,
      text,
      inReplyTo: email.messageId,
      references: email.messageId,
    });

    await logActivity(
      "Admin",
      "replied",
      "email",
      recipient,
      id,
      `Sujet: ${subject}`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[inbox/reply] failed:", err);
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
