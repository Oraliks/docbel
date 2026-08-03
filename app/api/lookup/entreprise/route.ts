import { NextRequest, NextResponse } from "next/server";
import { searchByName } from "@/lib/be-companies/kbo-lookup";
import { parseEnterpriseSuggestions } from "@/lib/pdf-forms/enterprise-suggestions";
import { checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET /api/lookup/entreprise?q=<nom> — recherche PUBLIQUE d'entreprise belge
/// par nom, mirroir KBO local rafraîchi par /api/cron/kbo-refresh. Sœur de
/// /api/admin/lookup/bce (admin-only, inchangée) : périmètre volontairement
/// plus étroit — recherche par nom uniquement, pas par numéro (spec
/// 2026-08-03-autofill-employeur-bce-design.md). Le plancher de longueur de
/// requête (3 caractères) est déjà appliqué par `searchByName` — pas de
/// duplication ici.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`lookup-entreprise:${ip}`, { windowMs: 60_000, max: 30 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes, réessayez plus tard" },
      { status: 429, headers: json },
    );
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const raw = await searchByName(q, 10);
    return NextResponse.json({ results: parseEnterpriseSuggestions(raw) }, { headers: json });
  } catch (err) {
    console.error("[lookup-entreprise] error:", err);
    return NextResponse.json({ error: "Erreur de recherche" }, { status: 500, headers: json });
  }
}
