/// Helpers de réponse pour les routes `app/api/decision-trees/*`.
/// Calque les conventions du repo (cf. app/api/admin/pdf/forms/[id]/route.ts) :
/// réponses JSON directes, code machine `stale_write` pour le verrou optimiste.

import { NextResponse } from "next/server";
import { STALE_WRITE_CODE } from "@/lib/pdf-forms/concurrency";

export const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
} as const;

/// Réponse d'erreur JSON standard.
export function jsonError(
  status: number,
  message: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { error: message, ...extra },
    { status, headers: JSON_HEADERS },
  );
}

/// Réponse 409 de conflit d'édition (verrou optimiste). Le client compare
/// `code === "stale_write"` pour proposer un rechargement.
export function staleWriteResponse(currentUpdatedAt: Date): NextResponse {
  return NextResponse.json(
    {
      error:
        "Conflit d'édition : cet arbre a été modifié depuis votre dernier chargement. Rechargez pour voir la dernière version.",
      code: STALE_WRITE_CODE,
      currentUpdatedAt,
    },
    { status: 409, headers: JSON_HEADERS },
  );
}

/// Réponse JSON de succès.
export function jsonOk(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: JSON_HEADERS });
}
