/// Helpers de réponse API standardisés. Généralise l'îlot
/// lib/decision-builder/api-helpers.ts à tout le repo. Convention retenue :
///  - Erreur : toujours { error: string, code?: string, details?: unknown } + Content-Type JSON.
///  - Succès : corps brut (compat avec la convention de facto existante).
/// Opt-in : les nouvelles routes et celles qu'on touche utilisent ces helpers ;
/// pas de migration forcée des 300+ routes existantes.

import { NextResponse } from "next/server";

const JSON_CT = { "Content-Type": "application/json; charset=utf-8" };

export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: unknown;
}

export function apiError(
  status: number,
  message: string,
  opts?: { code?: string; details?: unknown; headers?: Record<string, string> },
): NextResponse {
  const body: ApiErrorBody = { error: message };
  if (opts?.code) body.code = opts.code;
  if (opts?.details !== undefined) body.details = opts.details;
  return NextResponse.json(body, {
    status,
    headers: { ...JSON_CT, ...(opts?.headers ?? {}) },
  });
}

export function apiOk<T>(
  data: T,
  opts?: { status?: number; headers?: Record<string, string> },
): NextResponse {
  return NextResponse.json(data, {
    status: opts?.status ?? 200,
    headers: { ...JSON_CT, ...(opts?.headers ?? {}) },
  });
}
