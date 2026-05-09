import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

/// Recompte le nombre d'utilisations de chaque preset en parcourant tous les schemas.
/// À appeler manuellement (admin) ou périodiquement via cron.
export async function POST() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const [presets, templates] = await Promise.all([
    prisma.fieldValidationPreset.findMany({ select: { id: true } }),
    prisma.documentTemplate.findMany({ select: { schema: true } }),
  ]);

  const counts = new Map<string, number>();
  for (const p of presets) counts.set(p.id, 0);

  type FieldWithPreset = { presetId?: string };
  for (const t of templates) {
    const fields = (t.schema as unknown as FieldWithPreset[]) || [];
    for (const f of fields) {
      if (f.presetId && counts.has(f.presetId)) {
        counts.set(f.presetId, counts.get(f.presetId)! + 1);
      }
    }
  }

  let updated = 0;
  for (const [presetId, count] of counts) {
    await prisma.fieldValidationPreset.update({
      where: { id: presetId },
      data: { usageCount: count },
    });
    updated++;
  }

  return NextResponse.json({
    ok: true,
    presetsScanned: presets.length,
    templatesScanned: templates.length,
    presetsUpdated: updated,
  });
}
