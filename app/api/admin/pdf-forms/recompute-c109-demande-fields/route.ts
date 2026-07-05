import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { recomputeDocumentFields } from "@/lib/dossiers/seed";
import { allocationsInsertion } from "@/lib/dossiers/allocations-insertion";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET  /api/admin/pdf-forms/recompute-c109-demande-fields
///   → prévisualisation (dry-run, aucune écriture) du recalcul des champs de
///     c109-36-demande (sections/labels des 39 champs auto-inférés).
/// POST /api/admin/pdf-forms/recompute-c109-demande-fields?apply=1
///   → applique réellement (met à jour `fields` en DB, sans toucher au
///     bundle/items/runs). Un POST sans `?apply=1` reste un dry-run.
///
/// Même logique que scripts/recompute-c109-demande-fields.ts
/// (lib/dossiers/seed.ts, source commune) — exposée en HTTP admin-gated car
/// le script CLI ne peut pas s'exécuter contre la prod depuis un poste local
/// (les identifiants de la base Neon de prod n'existent que côté Vercel).
function findDoc() {
  const doc = allocationsInsertion.documents.find((d) => d.slug === "c109-36-demande");
  if (!doc) throw new Error("c109-36-demande introuvable dans allocations-insertion");
  return doc;
}

export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const result = await recomputeDocumentFields(findDoc(), false);
  return NextResponse.json({ mode: "dry-run", result }, { headers: json });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const apply = new URL(req.url).searchParams.get("apply") === "1";
  const result = await recomputeDocumentFields(findDoc(), apply);
  return NextResponse.json(
    { mode: apply ? "applied" : "dry-run (ajoute ?apply=1 pour écrire)", result },
    { headers: json },
  );
}
