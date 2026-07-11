import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import AdmZip from "adm-zip";
import { auth } from "@/lib/auth";
import { loadDossierState } from "@/lib/bundles/completion";
import { regenerateAllDocuments } from "@/lib/bundles/regenerate-pdfs";
import { checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET → zip de tous les documents complétés d'un dossier, régénérés à la
/// volée (aucun PDF n'est jamais stocké). Verrouillé tant que le dossier
/// n'est pas entièrement complété (cf. lib/bundles/completion.ts).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bundle-download-all:${ip}:${runId}`, { windowMs: 60_000, max: 5 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes, réessayez plus tard" }, { status: 429, headers: json });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const sessionId = req.cookies.get("beldoc-bundle-session")?.value || null;

  // Pré-vérification : on distingue « introuvable / pas à toi » (404, jamais de
  // fuite d'existence) de « dossier incomplet » (409 + liste des manquants,
  // pour que l'UI puisse dire QUOI compléter). `regenerateAllDocuments`
  // écrase ces deux cas en `null`, d'où ce pré-check dédié — même schéma que
  // la route generate (app/api/pdf/[slug]/generate/route.ts).
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
    console.error("[bundle-download-all] regeneration error:", err);
    return NextResponse.json({ error: "Échec de la génération" }, { status: 500, headers: json });
  }
  if (!result || result.docs.length === 0) {
    return NextResponse.json({ error: "Aucun document à télécharger" }, { status: 404, headers: json });
  }

  const zip = new AdmZip();
  for (const doc of result.docs) {
    zip.addFile(doc.filename, doc.bytes);
  }
  const zipBytes = zip.toBuffer();

  // Défense en profondeur : le slug est déjà normalisé `[a-z0-9-]` à la
  // création du bundle, mais on re-sanitize ici pour ne pas dépendre d'un
  // invariant distant dans un en-tête HTTP.
  const safeSlug = state.run.bundleSlug.replace(/[^a-zA-Z0-9-]/g, "_");

  return new NextResponse(new Uint8Array(zipBytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="documents-${safeSlug}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
