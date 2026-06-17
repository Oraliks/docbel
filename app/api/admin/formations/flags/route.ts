import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import {
  FLAG_KEYS,
  setFormationsFlags,
  type FormationsFlag,
  type FormationsFlags,
} from "@/lib/formations/module";

export const runtime = "nodejs";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Validation souple : on accepte n'importe quel Record<string, boolean> puis on
 * ne garde QUE les clés connues (FLAG_KEYS). Toute clé inconnue est ignorée
 * silencieusement plutôt que de rejeter la requête.
 */
const flagsSchema = z.record(z.string(), z.boolean());

const KNOWN_FLAGS = new Set<string>(FLAG_KEYS);

/** PATCH /api/admin/formations/flags — active/désactive des feature flags. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const parsed = flagsSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body invalide", issues: parsed.error.flatten() },
      { status: 400, headers: jsonHeaders },
    );
  }

  const filtered: Partial<FormationsFlags> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (KNOWN_FLAGS.has(key)) {
      filtered[key as FormationsFlag] = value;
    }
  }

  try {
    const flags = await setFormationsFlags(filtered, auth.user.id);
    return NextResponse.json({ ok: true, flags }, { headers: jsonHeaders });
  } catch (err) {
    console.error("[admin/formations/flags PATCH] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
