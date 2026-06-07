import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
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
 * Receives an arbitrary `{ field: value }` object from any builder form.
 * Primary capture: the submission is persisted in the DB (FormSubmission).
 * Best-effort secondary: it's also forwarded as an email (Resend) to the site
 * inbox (CONTACT_EMAIL_FROM) when email is configured. The request only fails
 * (502) if BOTH the DB store and the email delivery fail.
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

    const raw = body as Record<string, unknown>;
    // Honeypot : un bot remplit le champ caché → on accepte en silence (pas de stockage/email).
    if (typeof raw._hp === "string" && raw._hp.trim()) {
      return NextResponse.json({ status: "ok" }, { status: 201 });
    }
    const source =
      typeof raw._source === "string" ? raw._source.slice(0, 300) : undefined;

    const entries = Object.entries(raw)
      .filter(
        ([k]) =>
          typeof k === "string" &&
          k.length > 0 &&
          k.length <= 100 &&
          k !== "_hp" &&
          k !== "_source"
      )
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

    // Capture primaire : on enregistre la soumission en base (best-effort).
    let stored = false;
    try {
      await prisma.formSubmission.create({
        data: { source, data: Object.fromEntries(entries) },
      });
      stored = true;
    } catch (e) {
      console.error("[pagebuilder-form] DB store failed:", e);
    }

    // Secondaire : transfert par email si configuré (sinon la base suffit).
    const apiKey = process.env.RESEND_API_KEY;
    const noreplyFrom = process.env.EMAIL_FROM;
    const inbox = process.env.CONTACT_EMAIL_FROM;
    let emailed = false;
    if (apiKey && noreplyFrom && inbox) {
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

      try {
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
        } else {
          emailed = true;
          await logActivity(
            "Page Form",
            "received",
            "message",
            replyTo || "soumission",
            result.data?.id || undefined,
            `${entries.length} champ(s)`
          );
        }
      } catch (e) {
        console.error("[pagebuilder-form] email failed:", e);
      }
    }

    if (!stored && !emailed) {
      return NextResponse.json(
        { error: "Échec de l'enregistrement" },
        { status: 502 }
      );
    }
    return NextResponse.json({ status: "ok" }, { status: 201 });
  } catch (err) {
    console.error("[pagebuilder-form] failed:", err);
    return NextResponse.json({ error: "Échec de l'envoi" }, { status: 500 });
  }
}
