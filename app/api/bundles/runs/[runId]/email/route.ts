import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Resend } from "resend";
import { auth } from "@/lib/auth";
import { loadDossierState } from "@/lib/bundles/completion";
import { completedEligibleItems, regenerateAllDocuments } from "@/lib/bundles/regenerate-pdfs";
import { checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";
import { trackBundleEvent } from "@/lib/bundles/analytics";
import { itemTitle } from "@/components/docbel/bundle-runner/compute";
import { buildFeuilleDeRoute } from "@/lib/feuille-de-route/build";
import { feuilleServerDataForState } from "@/lib/feuille-de-route/server";
import { buildPageDeGarde } from "@/lib/feuille-de-route/page-de-garde";
import { isOpCode } from "@/lib/feuille-de-route/model";

const json = { "Content-Type": "application/json; charset=utf-8" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// POST → envoie tous les documents complétés d'un dossier par email
/// (pièces jointes régénérées en mémoire, jamais stockées). Verrouillé tant
/// que le dossier n'est pas entièrement complété.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bundle-email:${ip}:${runId}`, { windowMs: 60_000, max: 3 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes, réessayez plus tard" }, { status: 429, headers: json });
  }

  let body: { to?: unknown; consent?: unknown; op?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }
  // Choix d'organisme de paiement — paramètre TRANSITOIRE (spec, art. 9) :
  // compose la page de garde puis est oublié. Jamais journalisé.
  const opChoice = isOpCode(body.op) ? body.op : null;
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
  // la route zip (app/api/bundles/runs/[runId]/download-all/route.ts).
  const state = await loadDossierState(runId, { userId, sessionId });
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
    result = await regenerateAllDocuments(runId, { userId, sessionId });
  } catch (err) {
    // La base Neon partagée a des cold-starts (P1001) : on renvoie une erreur
    // JSON propre plutôt que de laisser une exception remonter en 500 brut.
    console.error("[bundles/email] regeneration error:", err);
    return NextResponse.json({ error: "Échec de la génération" }, { status: 500, headers: json });
  }
  if (!result || result.docs.length === 0) {
    return NextResponse.json({ error: "Aucun document à envoyer" }, { status: 404, headers: json });
  }

  // Page de garde « Et maintenant ? » en première pièce jointe — best-effort :
  // son échec ne prive jamais le citoyen de ses documents.
  let garde: Uint8Array | null = null;
  try {
    const serverData = await feuilleServerDataForState(result.state);
    const pieces = completedEligibleItems(result.state).flatMap((it) =>
      it.pdfForm ? [{ slug: it.pdfForm.slug, titre: itemTitle(it) }] : [],
    );
    const feuille = buildFeuilleDeRoute({ pieces, serverData, opChoice });
    garde = await buildPageDeGarde(feuille);
  } catch (err) {
    console.error("[bundles/email] page de garde échouée (non bloquant) :", err);
  }

  try {
    const resend = new Resend(apiKey);
    const res = await resend.emails.send({
      from: fromAddress,
      to,
      subject: `Vos documents — ${result.state.run.bundleSlug}`,
      text: `Bonjour,\n\nVoici les ${result.docs.length} document(s) complété(s) de votre dossier.\n\nCeci est un envoi automatique, ne pas répondre.`,
      attachments: [
        ...(garde
          ? [{ filename: "0_LISEZ-MOI_feuille-de-route.pdf", content: Buffer.from(garde) }]
          : []),
        ...result.docs.map((d) => ({ filename: d.filename, content: d.bytes })),
      ],
    });
    if (res.error) {
      console.error("[bundles/email] envoi échoué:", res.error);
      return NextResponse.json({ error: "Échec de l'envoi" }, { status: 502, headers: json });
    }
  } catch (err) {
    console.error("[bundles/email] exception:", err);
    return NextResponse.json({ error: "Échec de l'envoi" }, { status: 502, headers: json });
  }

  // Étape finale du funnel « Parcours » : documents récupérés (par email).
  await trackBundleEvent("documents_downloaded", {
    sessionId,
    userId,
    metadata: { bundleSlug: state.run.bundleSlug, via: "email" },
  });

  return NextResponse.json({ ok: true }, { headers: json });
}
