import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { logActivity } from "@/lib/activity-logger";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generic page-builder form endpoint (default target of the `form` block).
 *
 * Receives an arbitrary `{ field: value }` object from any builder form and
 * forwards it as an email (Resend) to the site inbox (CONTACT_EMAIL_FROM).
 * Nothing is stored in the DB — consistent with /api/contact-messages.
 * Graceful 503 if email isn't configured.
 */
export async function POST(request: NextRequest) {
  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`pagebuilder:messages:${ip}`, {
      windowMs: 10 * 60_000,
      max: 5,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Trop d'envois — réessayez dans quelques minutes" },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const entries = Object.entries(body as Record<string, unknown>)
      .filter(([k]) => typeof k === "string" && k.length > 0 && k.length <= 100)
      .slice(0, 40)
      .map(
        ([k, v]) =>
          [
            k,
            (typeof v === "string" ? v : v == null ? "" : JSON.stringify(v)).slice(0, 5000),
          ] as [string, string]
      )
      .filter(([, v]) => v.trim().length > 0);

    if (entries.length === 0) {
      return NextResponse.json({ error: "Formulaire vide" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const noreplyFrom = process.env.EMAIL_FROM;
    const inbox = process.env.CONTACT_EMAIL_FROM;
    if (!apiKey || !noreplyFrom || !inbox) {
      console.error("[pagebuilder-form] missing email env vars");
      return NextResponse.json(
        { error: "Service de messagerie indisponible" },
        { status: 503 }
      );
    }

    // Detect a reply-to email among the submitted fields.
    const replyTo =
      entries.find(([k, v]) => /e-?mail/i.test(k) && EMAIL_RE.test(v))?.[1] ||
      entries.find(([, v]) => EMAIL_RE.test(v))?.[1];

    const text = [
      "Nouvelle soumission de formulaire",
      "",
      ...entries.map(([k, v]) => `${k} : ${v}`),
    ].join("\n");

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#111">
        <h2 style="margin:0 0 12px;font-size:18px;font-weight:600">Nouvelle soumission de formulaire</h2>
        <table style="border-collapse:collapse;font-size:14px">
          ${entries
            .map(
              ([k, v]) =>
                `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${escapeHtml(
                  k
                )}</td><td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`
            )
            .join("")}
        </table>
      </div>`;

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: `Formulaire <${noreplyFrom}>`,
      to: inbox,
      replyTo: replyTo || undefined,
      subject: "[Formulaire] Nouvelle soumission",
      text,
      html,
    });

    if (result.error) {
      console.error("[pagebuilder-form] Resend error:", result.error);
      return NextResponse.json({ error: "Échec de l'envoi" }, { status: 502 });
    }

    await logActivity(
      "Page Form",
      "received",
      "message",
      replyTo || "soumission",
      result.data?.id || undefined,
      `${entries.length} champ(s)`
    );

    return NextResponse.json({ status: "ok" }, { status: 201 });
  } catch (err) {
    console.error("[pagebuilder-form] failed:", err);
    return NextResponse.json({ error: "Échec de l'envoi" }, { status: 500 });
  }
}
