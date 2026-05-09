import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { sendContactReply } from "@/lib/inbox/send";
import { logActivity } from "@/lib/activity-logger";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Compose a brand new outgoing email from contact@docbel.be.
 * Body: { to, subject, text }
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const body = await request.json();
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.text === "string" ? body.text : "";

  if (!to || !subject || !text.trim()) {
    return NextResponse.json({ error: "Tous les champs sont obligatoires" }, { status: 400 });
  }
  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
  }

  try {
    await sendContactReply({ to, subject, text });
    await logActivity("Admin", "replied", "email", to, undefined, `Sujet: ${subject}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[inbox/compose] failed:", err);
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
