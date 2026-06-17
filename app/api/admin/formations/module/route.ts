import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { setFormationsModule } from "@/lib/formations/module";

export const runtime = "nodejs";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Patch partiel de la config globale du module Formations. Tous les champs sont
 * optionnels : le client n'envoie que ceux qui changent. `setFormationsModule`
 * fusionne avec l'état courant, persiste dans AppSetting et journalise.
 */
const moduleSchema = z
  .object({
    enabled: z.boolean(),
    publicEnabled: z.boolean(),
    citizenEnabled: z.boolean(),
    employerEnabled: z.boolean(),
    partnerEnabled: z.boolean(),
    maintenanceMode: z.boolean(),
    maintenanceMessage: z.string().max(2000),
    launchMode: z.enum(["HIDDEN", "COMING_SOON", "PRIVATE_BETA", "PUBLIC"]),
  })
  .partial();

/** PATCH /api/admin/formations/module — met à jour l'état du module. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const parsed = moduleSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body invalide", issues: parsed.error.flatten() },
      { status: 400, headers: jsonHeaders },
    );
  }

  try {
    const module = await setFormationsModule(parsed.data, auth.user.id);
    return NextResponse.json({ ok: true, module }, { headers: jsonHeaders });
  } catch (err) {
    console.error("[admin/formations/module PATCH] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
