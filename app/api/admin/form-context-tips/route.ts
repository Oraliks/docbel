import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { FORM_CONTEXT_TIPS_DEFAULTS } from "@/lib/form-context-tips";
import {
  getFormContextTipsDictUncached,
  getFormContextTipsMeta,
  setFormContextTips,
} from "@/lib/form-context-tips.server";

export const runtime = "nodejs";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/** GET /api/admin/form-context-tips — dictionnaire frais + défauts + métadonnées. */
export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const [dict, meta] = await Promise.all([
    getFormContextTipsDictUncached(),
    getFormContextTipsMeta(),
  ]);
  return NextResponse.json(
    { dict, defaults: FORM_CONTEXT_TIPS_DEFAULTS, meta },
    { headers: jsonHeaders },
  );
}

/**
 * PUT /api/admin/form-context-tips — remplace le dictionnaire COMPLET (l'éditeur
 * détient l'état entier). Validation stricte Zod dans `setFormContextTips` : un
 * dictionnaire invalide est rejeté (400) sans écraser l'existant.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Body invalide (objet attendu)" },
      { status: 400, headers: jsonHeaders },
    );
  }

  try {
    const result = await setFormContextTips(body, auth.user.id);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Conseils invalides", issues: result.issues },
        { status: 400, headers: jsonHeaders },
      );
    }
    return NextResponse.json(
      { ok: true, tips: result.tips },
      { headers: jsonHeaders },
    );
  } catch (err) {
    console.error("[admin/form-context-tips PUT] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
