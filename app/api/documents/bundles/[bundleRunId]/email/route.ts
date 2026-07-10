import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Resend } from "resend";
import { auth } from "@/lib/auth";
import { loadDossierState } from "@/lib/bundles/completion";
import { regenerateAllDocuments } from "@/lib/bundles/regenerate-pdfs";
import { checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";

const json = { "Content-Type": "application/json; charset=utf-8" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// POST → envoie tous les documents complétés d'un dossier par email
/// (pièces jointes régénérées en mémoire, jamais stockées). Verrouillé tant
/// que le dossier n'est pas entièrement complété.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bundleRunId: string }> },
) {
  const { bundleRunId } = await params;
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bundle-email:${ip}:${bundleRunId}`, { windowMs: 60_000, max: 3 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes, réessayez plus tard" }, { status: 429, headers: json });
  }

  let body: { to?: unknown; consent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }
  if (body.consent !== true) {
    return NextResponse.json({ error: "Consentement RGPD requis" }, { status: 400, headers: json });
  }
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ error: "Adresse email invalide" }, { status: 400, headers: json });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.CONTACT_EMAIL_FROM;
  if (!apiKey || !fromAddress) {
    return NextResponse.json({ error: "Envoi par email indisponible" }, { status: 400, headers: json });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const sessionId = req.cookies.get("beldoc-bundle-session")?.value || null;

  // Pré-vérification : on distingue « introuvable / pas à toi » (404, jamais de
  // fuite d'existence) de « dossier incomplet » (409 + liste des manquants,
  // pour que l'UI puisse dire QUOI compléter). `regenerateAllDocuments`
  // écrase ces deux cas en `null`, d'où ce pré-check dédié — même schéma que
  // la route zip (app/api/documents/bundles/[bundleRunId]/download-all/route.ts).
  const state = await loadDossierState(bundleRunId, { userId, sessionId });
  if (!state) {
    return NextResponse.json({ error: "Dossier introuvable" }, { status: 404, headers: json });
  }
  if (!state.allRequiredDone) {
    return NextResponse.json(
      { error: "dossier_incomplete", missing: state.missing },
      { status: 409, headers: json },
    );
  }

  let result: Awaited<ReturnType<typeof regenerateAllDocuments>>;
  try {
    result = await regenerateAllDocuments(bundleRunId, { userId, sessionId });
  } catch (err) {
    // La base Neon partagée a des cold-starts (P1001) : on renvoie une erreur
    // JSON propre plutôt que de laisser une exception remonter en 500 brut.
    console.error("[bundles/email] regeneration error:", err);
    return NextResponse.json({ error: "Échec de la génération" }, { status: 500, headers: json });
  }
  if (!result || result.docs.length === 0) {
    return NextResponse.json({ error: "Aucun document à envoyer" }, { status: 404, headers: json });
  }

  try {
    const resend = new Resend(apiKey);
    const res = await resend.emails.send({
      from: fromAddress,
      to,
      subject: `Vos documents — ${result.state.run.bundleSlug}`,
      text: `Bonjour,\n\nVoici les ${result.docs.length} document(s) complété(s) de votre dossier.\n\nCeci est un envoi automatique, ne pas répondre.`,
      attachments: result.docs.map((d) => ({ filename: d.filename, content: d.bytes })),
    });
    if (res.error) {
      console.error("[bundles/email] envoi échoué:", res.error);
      return NextResponse.json({ error: "Échec de l'envoi" }, { status: 502, headers: json });
    }
  } catch (err) {
    console.error("[bundles/email] exception:", err);
    return NextResponse.json({ error: "Échec de l'envoi" }, { status: 502, headers: json });
  }

  return NextResponse.json({ ok: true }, { headers: json });
}
