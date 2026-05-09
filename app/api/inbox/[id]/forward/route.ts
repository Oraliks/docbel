import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { sendContactReply } from "@/lib/inbox/send";
import { logActivity } from "@/lib/activity-logger";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/inbox/[id]/forward
 * Body: { to, subject, text }
 *
 * Forwards an email to a new recipient. The body should already include the
 * quoted original (the client builds it). Sent via Resend + APPEND to Sent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await params;
  const body = await request.json();
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.text === "string" ? body.text : "";
  const html = typeof body.html === "string" && body.html.trim() ? body.html : undefined;

  if (!to || !subject || !text.trim()) {
    return NextResponse.json({ error: "Tous les champs sont obligatoires" }, { status: 400 });
  }
  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
  }

  const email = await prisma.inboxEmail.findUnique({ where: { id } });
  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  try {
    await sendContactReply({ to, subject, text, html });
    await logActivity(
      "Admin",
      "replied",
      "email",
      to,
      id,
      `Forward: ${subject}`
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[inbox/forward] failed:", err);
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
