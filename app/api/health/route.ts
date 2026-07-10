import { NextResponse } from "next/server";
import { getHealthSummary } from "@/lib/health/checks";
import { memoCache } from "@/lib/memo-cache";

// Public, minimal (pas de détail sensible). Cache 10 s : les uptime monitors
// et la carte dashboard pingent en boucle sans re-taper la DB à chaque fois.
export const dynamic = "force-dynamic";

export async function GET() {
  const summary = await memoCache("health:summary", 10_000, getHealthSummary);
  // 200 même si "degraded" (l'API répond) ; 503 seulement si "down" (DB KO)
  // pour que les uptime monitors externes déclenchent une alerte.
  const httpStatus = summary.status === "down" ? 503 : 200;
  return NextResponse.json(summary, {
    status: httpStatus,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
