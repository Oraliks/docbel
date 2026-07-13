// Relie chaque bureau syndicat / organisme de paiement / mutuelle / autre à la
// commune de SON code postal. Beaucoup pointaient vers une commune erronée
// (import cassé) : le même problème que la FGTB touche CSC, CAPAC, SYNOVA, les
// mutuelles, etc.
//
// Périmètre : types SYNDICAT / PERMANENCE / AUTRE (les CPAS/COMMUNE sont
// territoriaux, gérés par apply-official/merge ; ONEM garde communeId=null).
// On saute les CP inconnus de PostalCode. Le mapping CP→commune bruxellois est
// désormais fiable (résidentiels corrigés), donc Bruxelles est inclus.
//
// Non destructif (snapshot BureauRevision). Dry-run par défaut.
// Usage : pnpm bureaux:relink-syndicats          (dry-run)
//         pnpm bureaux:relink-syndicats --yes     (applique)

import { prisma } from "@/lib/prisma";
import { snapshotBureau } from "@/lib/bureaus/diff";
import type { Prisma } from "@prisma/client";

const APPLY = process.argv.includes("--yes");

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"}\n`);

  const bureaux = await prisma.bureau.findMany({
    where: { active: true, type: { in: ["SYNDICAT", "PERMANENCE", "AUTRE"] } },
    select: {
      id: true, name: true, postalCode: true, communeId: true,
      organisme: { select: { code: true } },
      commune: { select: { nameFr: true } },
    },
  });
  const pcs = await prisma.postalCode.findMany({ select: { code: true, communeId: true, commune: { select: { nameFr: true } } } });
  const cpMap = new Map(pcs.map((p) => [p.code, p]));

  const plan: { id: string; to: string; label: string }[] = [];
  const byOrg: Record<string, number> = {};
  for (const b of bureaux) {
    const real = cpMap.get(b.postalCode);
    if (!real) continue; // CP inconnu
    if (real.communeId === b.communeId) continue; // déjà correct
    plan.push({ id: b.id, to: real.communeId, label: `[${b.organisme.code}] ${b.name} (${b.postalCode}) : ${b.commune?.nameFr ?? "—"} → ${real.commune?.nameFr}` });
    byOrg[b.organisme.code] = (byOrg[b.organisme.code] ?? 0) + 1;
  }

  console.log(`${plan.length} bureaux à relier (par organisme : ${Object.entries(byOrg).map(([k, v]) => `${k}=${v}`).join(", ")})\n`);
  for (const p of plan) console.log(`  ${p.label}`);

  if (!APPLY) { console.log("\nDry-run. --yes pour appliquer."); return; }

  console.log("\n🔥 Application…");
  for (const p of plan) {
    const before = await prisma.bureau.findUnique({ where: { id: p.id } });
    if (!before) continue;
    await prisma.$transaction([
      prisma.bureauRevision.create({ data: { bureauId: p.id, snapshot: snapshotBureau(before) as Prisma.InputJsonValue, changeNotes: "Relink commune (bureaux:relink-syndicats)", changedBy: "script:relink-syndicats" } }),
      prisma.bureau.update({ where: { id: p.id }, data: { communeId: p.to, updatedBy: "script:relink-syndicats" } }),
    ]);
  }
  console.log(`✓ ${plan.length} bureaux reliés.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
