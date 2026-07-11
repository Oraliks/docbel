import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { SITE_SETTINGS_DEFAULTS } from "@/lib/site-settings";
import {
  getSiteSettingsUncached,
  getSiteSettingsMeta,
  setSiteSettings,
} from "@/lib/site-settings.server";

export const runtime = "nodejs";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/** GET /api/admin/site-settings — état frais + défauts + métadonnées d'édition. */
export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const [settings, meta] = await Promise.all([
    getSiteSettingsUncached(),
    getSiteSettingsMeta(),
  ]);
  return NextResponse.json(
    { settings, defaults: SITE_SETTINGS_DEFAULTS, meta },
    { headers: jsonHeaders },
  );
}

/**
 * PATCH /api/admin/site-settings — patch partiel imbriqué (seulement les champs
 * modifiés). La validation stricte + le merge se font dans `setSiteSettings` :
 * un patch invalide est rejeté (400) sans écraser la config existante.
 */
export async function PATCH(req: NextRequest) {
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
    const result = await setSiteSettings(body, auth.user.id);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Réglages invalides", issues: result.issues },
        { status: 400, headers: jsonHeaders },
      );
    }
    return NextResponse.json(
      { ok: true, settings: result.settings },
      { headers: jsonHeaders },
    );
  } catch (err) {
    console.error("[admin/site-settings PATCH] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
