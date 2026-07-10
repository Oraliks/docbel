import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import AdmZip from "adm-zip";
import { auth } from "@/lib/auth";
import { regenerateAllDocuments } from "@/lib/bundles/regenerate-pdfs";
import { checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET → zip de tous les documents complétés d'un dossier, régénérés à la
/// volée (aucun PDF n'est jamais stocké). Verrouillé tant que le dossier
/// n'est pas entièrement complété (cf. lib/bundles/completion.ts).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bundleRunId: string }> },
) {
  const { bundleRunId } = await params;
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bundle-download-all:${ip}:${bundleRunId}`, { windowMs: 60_000, max: 5 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes, réessayez plus tard" }, { status: 429, headers: json });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const sessionId = req.cookies.get("beldoc-bundle-session")?.value || null;

  const result = await regenerateAllDocuments(bundleRunId, { userId, sessionId });
  if (!result) {
    return NextResponse.json({ error: "Dossier introuvable ou incomplet" }, { status: 404, headers: json });
  }
  if (result.docs.length === 0) {
    return NextResponse.json({ error: "Aucun document à télécharger" }, { status: 404, headers: json });
  }

  const zip = new AdmZip();
  for (const doc of result.docs) {
    zip.addFile(doc.filename, doc.bytes);
  }
  const zipBytes = zip.toBuffer();

  return new NextResponse(new Uint8Array(zipBytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="documents-${result.state.run.bundleSlug}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
