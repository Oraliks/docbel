import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { loadDossierState } from "@/lib/bundles/completion";
import { regenerateOneDocument } from "@/lib/bundles/regenerate-pdfs";
import { checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET → un seul document complété d'un dossier, régénéré à la volée (aucun PDF
/// n'est jamais stocké). Verrouillé tant que le dossier n'est pas entièrement
/// complété (même verrou que le zip / l'email). Propriété du run vérifiée :
/// un runId étranger ne peut pas récupérer les documents d'un autre
/// citoyen (cf. lib/bundles/completion.ts).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string; pdfFormId: string }> },
) {
  const { runId, pdfFormId } = await params;
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bundle-download-one:${ip}:${runId}`, { windowMs: 60_000, max: 10 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes, réessayez plus tard" }, { status: 429, headers: json });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const sessionId = req.cookies.get("beldoc-bundle-session")?.value || null;

  // Pré-vérification : distingue « introuvable / pas à toi » (404, jamais de
  // fuite d'existence) de « dossier incomplet » (409 + liste des manquants) —
  // même schéma que la route zip et la route generate.
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

  let result: Awaited<ReturnType<typeof regenerateOneDocument>>;
  try {
    result = await regenerateOneDocument(runId, pdfFormId, { userId, sessionId });
  } catch (err) {
    // Cold-start Neon (P1001) : erreur JSON propre plutôt qu'exception brute.
    console.error("[bundle-download-one] regeneration error:", err);
    return NextResponse.json({ error: "Échec de la génération" }, { status: 500, headers: json });
  }
  // `null` ici = pdfFormId n'est pas un document complété+éligible de ce run.
  if (!result) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404, headers: json });
  }

  // `result.doc.filename` provient de renderFilename → déjà normalisé
  // ([a-zA-Z0-9._-]), sûr pour l'en-tête Content-Disposition.
  return new NextResponse(new Uint8Array(result.doc.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.doc.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
