import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { loadDossierState } from "@/lib/bundles/completion";
import { feuilleServerDataForState } from "@/lib/feuille-de-route/server";
import { checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET → données bureaux de la feuille de route (commune + bureaux OP
/// compétents). Le choix d'OP du citoyen ne transite JAMAIS par ici : le
/// serveur renvoie les 4, le panneau filtre côté client (spec, art. 9).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bundle-feuille:${ip}:${runId}`, { windowMs: 60_000, max: 10 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes, réessayez plus tard" }, { status: 429, headers: json });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const sessionId = req.cookies.get("beldoc-bundle-session")?.value || null;

  // Même patron ownership/verrou que download-all : 404 indistinct
  // « introuvable / pas à toi », 409 tant que le dossier n'est pas complet.
  const state = await loadDossierState(runId, { userId, sessionId });
  if (!state) {
    return NextResponse.json({ error: "Dossier introuvable" }, { status: 404, headers: json });
  }
  if (!state.allRequiredDone) {
    return NextResponse.json({ error: "dossier_incomplete" }, { status: 409, headers: json });
  }

  let serverData;
  try {
    serverData = await feuilleServerDataForState(state);
  } catch (err) {
    // Neon partagée : cold-start possible (P1001) — repli générique plutôt
    // qu'une 500 : la feuille reste utile sans adresse.
    console.error("[bundle-feuille-de-route] resolve error:", err);
    serverData = null;
  }

  return NextResponse.json(
    { serverData },
    { headers: { ...json, "Cache-Control": "private, no-store" } },
  );
}
