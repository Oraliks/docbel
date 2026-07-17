import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { applyAllC1Improvements } from "@/lib/pdf-forms/seed/apply-c1-improvements-core";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET  /api/admin/pdf-forms/apply-c1-improvements
///   → prévisualisation (dry-run, aucune écriture) de toutes les cibles
///     (cf. C1_IMPROVEMENT_TARGETS : c1-changement-situation, c1-regis,
///     c1-partenaire, c1a, c1b, c1c, c46, c47).
/// POST /api/admin/pdf-forms/apply-c1-improvements?apply=1
///   → applique réellement (met à jour fields+triggers en DB). Un POST sans
///     `?apply=1` reste un dry-run, comme le script (par défaut sans --yes).
///
/// Même logique que scripts/apply-c1-improvements.ts (lib/pdf-forms/seed/
/// apply-c1-improvements-core.ts, source commune) — exposée en HTTP
/// admin-gated car le script CLI ne peut pas s'exécuter contre la prod
/// depuis un poste local : les identifiants de la base Neon de prod
/// n'existent que côté Vercel.
export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const results = await applyAllC1Improvements(false);
  return NextResponse.json({ mode: "dry-run", results }, { headers: json });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const apply = new URL(req.url).searchParams.get("apply") === "1";
  const results = await applyAllC1Improvements(apply);
  return NextResponse.json(
    { mode: apply ? "applied" : "dry-run (ajoute ?apply=1 pour écrire)", results },
    { headers: json },
  );
}
