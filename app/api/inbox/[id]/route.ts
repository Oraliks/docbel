import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";
import { sendContactReply } from "@/lib/inbox/send";

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

  if (!email.isRead) {
    await prisma.inboxEmail.update({
      where: { id },
      data: { isRead: true },
    });
    email.isRead = true;
  }

  return NextResponse.json(email);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await params;
  const body = await request.json();

  const data: { isRead?: boolean; isArchived?: boolean } = {};
  if (typeof body.isRead === "boolean") data.isRead = body.isRead;
  if (typeof body.isArchived === "boolean") data.isArchived = body.isArchived;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.inboxEmail.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await params;
  const email = await prisma.inboxEmail.findUnique({
    where: { id },
    select: { id: true, subject: true, fromAddress: true },
  });
  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  await prisma.inboxEmail.delete({ where: { id } });
  await logActivity(
    "Admin",
    "deleted",
    "email",
    email.fromAddress,
    id,
    `Sujet: ${email.subject}`
  );
  return NextResponse.json({ success: true });
}

/**
 * POST /api/inbox/[id] — send a reply via Resend.
 * Body: { subject, text, html? }
 * Sets isReplied=true on success.
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
  const html = typeof body.html === "string" ? body.html : undefined;

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

  try {
    await sendContactReply({
      to: email.fromAddress,
      toName: email.fromName,
      subject,
      text,
      html,
      inReplyTo: email.messageId,
      references: email.messageId,
    });

    const updated = await prisma.inboxEmail.update({
      where: { id },
      data: { isReplied: true, isRead: true },
    });

    await logActivity(
      "Admin",
      "replied",
      "email",
      email.fromAddress,
      id,
      `Sujet: ${subject}`
    );

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[inbox/reply] failed:", err);
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
