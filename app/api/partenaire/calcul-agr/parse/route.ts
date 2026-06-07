/**
 * POST /api/partenaire/calcul-agr/parse
 *
 * Reçoit 1 à 4 fichiers WECH 506 (PDF), extrait le texte (pdfjs) et le parse
 * en données structurées prêtes pour le moteur de calcul AGR.
 *
 * Réservé aux agents FGTB et aux admins (même garde que l'outil fgtb-planning).
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { extractWechText } from "@/lib/agr/extract-pdf-text";
import { parseWech506 } from "@/lib/agr/parse-wech506";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 4;
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB / fichier

export async function POST(req: NextRequest) {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  // Outil privé FGTB : admins + partenaires FGTB uniquement.
  if (!auth.user.isAdmin && !/fgtb/i.test(auth.user.partnerOrganization ?? "")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} DRS par calcul.` },
      { status: 400 },
    );
  }

  const results = [];
  for (const file of files) {
    if (file.size > MAX_SIZE) {
      results.push({ filename: file.name, error: "Fichier trop volumineux (> 10 Mo)." });
      continue;
    }
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const text = await extractWechText(data);
      if (text.length < 30) {
        results.push({
          filename: file.name,
          error: "Texte illisible — PDF scanné ou non standard ?",
        });
        continue;
      }
      const parsed = parseWech506(text);
      results.push({ filename: file.name, parsed });
    } catch (err) {
      console.error("[calcul-agr parse] échec extraction:", err);
      results.push({ filename: file.name, error: "Échec de l'extraction du PDF." });
    }
  }

  return NextResponse.json({ results });
}
