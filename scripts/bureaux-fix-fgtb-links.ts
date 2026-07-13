// Corrige les liens FGTB ↔ communes :
//  A. Relie chaque bureau FGTB (hors Bruxelles) à la commune de SON code postal
//     (beaucoup pointaient vers une commune erronée suite à un import cassé).
//     On saute les CP bruxellois 1000-1210 (table PostalCode non granulaire).
//  B. Fixe les affectations paiement_fgtb des 19 communes bruxelloises selon la
//     VRAIE organisation territoriale FGTB (source fgtbbruxelles.be, 2026-07) —
//     le résolveur les mettait par proximité, tombant sur les permanences
//     THÉMATIQUES (P700 artistes, P900 délégués) au lieu des territoriales.
//
// Non destructif (révisions pour les relink). Dry-run par défaut.
// Usage : pnpm bureaux:fix-fgtb           (dry-run)
//         pnpm bureaux:fix-fgtb --yes      (applique)

import { prisma } from "@/lib/prisma";
import { snapshotBureau } from "@/lib/bureaus/diff";
import type { Prisma } from "@prisma/client";

const APPLY = process.argv.includes("--yes");

// commune (nom normalisé) → code permanence territoriale FGTB Bruxelles
const BXL_TERRITOIRE: Record<string, string> = {
  anderlecht: "P100",
  schaerbeek: "P200", evere: "P200", "saint josse ten noode": "P200",
  etterbeek: "P210", "woluwe saint pierre": "P210", auderghem: "P210", "watermael boitsfort": "P210",
  jette: "P300", ganshoren: "P300",
  "molenbeek saint jean": "P310", koekelberg: "P310", "berchem sainte agathe": "P310",
  bruxelles: "P500", ixelles: "P500", "woluwe saint lambert": "P500",
  forest: "P600", "saint gilles": "P600", uccle: "P600",
};

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function isBxlCp(cp: string) { return /^1[0-2]\d\d$/.test(cp) && cp >= "1000" && cp <= "1210"; }

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"}\n`);

  // ─── A. Relink communeId (hors Bruxelles) ──────────────────────────────
  const fgtb = await prisma.bureau.findMany({
    where: { organisme: { code: "fgtb" }, active: true },
    select: { id: true, name: true, postalCode: true, communeId: true },
  });
  const pcs = await prisma.postalCode.findMany({ select: { code: true, communeId: true, commune: { select: { nameFr: true } } } });
  const cpMap = new Map(pcs.map((p) => [p.code, p]));

  console.log("━━ A. Relink communeId (hors Bruxelles) ━━");
  let relinks = 0;
  const relinkPlan: { id: string; to: string; label: string }[] = [];
  for (const b of fgtb) {
    if (isBxlCp(b.postalCode)) continue;
    const real = cpMap.get(b.postalCode);
    if (!real) continue;
    if (real.communeId === b.communeId) continue;
    relinkPlan.push({ id: b.id, to: real.communeId, label: `${b.name} (${b.postalCode}) → ${real.commune?.nameFr}` });
    relinks++;
  }
  for (const r of relinkPlan) console.log(`  ${r.label}`);
  console.log(`  ${relinks} à relier`);

  // ─── B. Affectations paiement_fgtb Bruxelles (territorial) ──────────────
  console.log("\n━━ B. Affectations FGTB Bruxelles (territorial officiel) ━━");
  const perms = await prisma.bureau.findMany({
    where: { organisme: { code: "fgtb" }, name: { contains: "Permanence" } },
    select: { id: true, name: true },
  });
  const permByCode = new Map<string, string>();
  for (const p of perms) {
    const m = p.name.match(/\((P\d+)\)/);
    if (m) permByCode.set(m[1], p.id);
  }
  const bxlCommunes = await prisma.commune.findMany({ where: { region: "brussels", mergedIntoId: null }, select: { id: true, nameFr: true } });
  const bxlPlan: { communeId: string; bureauId: string; label: string }[] = [];
  for (const c of bxlCommunes) {
    const code = BXL_TERRITOIRE[norm(c.nameFr)];
    if (!code) { console.log(`  ⚠ ${c.nameFr} : pas de permanence mappée`); continue; }
    const bureauId = permByCode.get(code);
    if (!bureauId) { console.log(`  ⚠ ${code} introuvable`); continue; }
    bxlPlan.push({ communeId: c.id, bureauId, label: `${c.nameFr} → ${code}` });
  }
  for (const p of bxlPlan) console.log(`  ${p.label}`);
  console.log(`  ${bxlPlan.length} affectations`);

  if (!APPLY) { console.log("\nDry-run. --yes pour appliquer."); return; }

  console.log("\n🔥 Application…");
  for (const r of relinkPlan) {
    const before = await prisma.bureau.findUnique({ where: { id: r.id } });
    if (!before) continue;
    await prisma.$transaction([
      prisma.bureauRevision.create({ data: { bureauId: r.id, snapshot: snapshotBureau(before) as Prisma.InputJsonValue, changeNotes: `Relink commune FGTB (bureaux:fix-fgtb)`, changedBy: "script:fix-fgtb" } }),
      prisma.bureau.update({ where: { id: r.id }, data: { communeId: r.to, updatedBy: "script:fix-fgtb" } }),
    ]);
  }
  // Remplace les affectations paiement_fgtb des communes bruxelloises
  const bxlIds = bxlCommunes.map((c) => c.id);
  await prisma.$transaction([
    prisma.bureauAssignment.deleteMany({ where: { serviceType: "paiement_fgtb", communeId: { in: bxlIds } } }),
    prisma.bureauAssignment.createMany({ data: bxlPlan.map((p) => ({ bureauId: p.bureauId, communeId: p.communeId, serviceType: "paiement_fgtb" })), skipDuplicates: true }),
  ]);
  console.log(`✓ ${relinkPlan.length} relinks + ${bxlPlan.length} affectations Bruxelles.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
