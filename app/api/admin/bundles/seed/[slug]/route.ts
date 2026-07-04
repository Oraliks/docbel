import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { getDossier } from "@/lib/dossiers/registry";
import { seedDossier } from "@/lib/dossiers/seed";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// POST /api/admin/bundles/seed/[slug][?force=1]
///
/// Seed GÉNÉRIQUE d'un dossier codé (registry lib/dossiers) → crée ses
/// PdfForms remplissables + son DocumentBundle + les items. Tourne côté
/// serveur : le stockage des PDF sources va vers Vercel Blob quand
/// BLOB_READ_WRITE_TOKEN est présent (obligatoire en prod — le fallback
/// disque est refusé sur Vercel, cf. lib/pdf-forms/storage.ts). C'est donc
/// l'endroit correct pour semer un dossier destiné à la prod (plutôt qu'un
/// seed local, dont les PDF pointeraient vers un disque inaccessible en prod).
///
/// Idempotent : sans `?force=1`, un bundle déjà présent n'est pas modifié.
/// ⚠️ `?force=1` supprime le bundle existant + ses PdfForms (cascade sur les
/// BundleRuns du dossier) avant de recréer — nécessaire pour (re)générer les
/// items après une évolution du module. À utiliser en connaissance de cause.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { slug } = await params;
  const dossier = getDossier(slug);
  if (!dossier) {
    return NextResponse.json(
      { ok: false, error: `Dossier codé introuvable dans le registry : ${slug}` },
      { status: 404, headers: json },
    );
  }

  const force = new URL(req.url).searchParams.get("force") === "1";

  try {
    const result = await seedDossier(dossier, auth.user.id, { force });
    return NextResponse.json(result, { headers: json });
  } catch (err) {
    console.error(`[seed/${slug}] error:`, err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500, headers: json },
    );
  }
}
