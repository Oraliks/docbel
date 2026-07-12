// Lot 3 du plan qualité bureaux : génère les BureauAssignment (compétence
// territoriale) pour que le résolveur soit DÉTERMINISTE au lieu de tomber en
// "estimé par proximité".
//
//  chomage  : CP → commune (via PostalCode, à jour post-fusion 2025) → bureau
//             ONEM (via numeroOnem/BC). Remplace le mapping par code INS périmé.
//  paiement : chaque commune → section OP la plus proche DANS SA RÉGION, pour
//             CAPAC/FGTB/CSC/SYNOVA (serviceType paiement_<org>).
//
// Non destructif : createMany skipDuplicates (idempotent). Régions germanophone
// et wallonne fusionnées pour le pooling des sections (territoire wallon).
//
// Usage :
//   pnpm bureaux:assign                 (dry-run, chomage + paiement)
//   pnpm bureaux:assign --yes           (applique)
//   pnpm bureaux:assign --only chomage  (ou --only paiement)

import { prisma } from "@/lib/prisma";
import {
  planChomageAssignments,
  planNearestAssignments,
  type CpMapping,
  type CommuneGeo,
  type SectionGeo,
} from "@/lib/bureaus/assignment-plan";

const APPLY = process.argv.includes("--yes");
function getArg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}
const ONLY = getArg("--only"); // "chomage" | "paiement" | null (les deux)

interface LookupCpMeta {
  BC?: string;
}

/** germanophone est administrativement en Wallonie → même pool de sections. */
function normRegion(r: string): string {
  return r === "germanophone" ? "wallonia" : r;
}

async function assignChomage() {
  console.log("━━ CHÔMAGE (CP → commune → bureau ONEM) ━━━━━━━━━━━━━━━━━━");

  const cpEntries = await prisma.lookupEntry.findMany({
    where: { table: { slug: "parametres-onem-cp" } },
    select: { code: true, metadata: true },
  });
  const cpMappings: CpMapping[] = cpEntries.map((e) => ({
    postalCode: e.code,
    bcCode: ((e.metadata ?? {}) as LookupCpMeta).BC?.split("-")[0]?.trim() ?? null,
  }));

  const pcs = await prisma.postalCode.findMany({ select: { code: true, communeId: true } });
  const cpToCommune = new Map(pcs.map((p) => [p.code, p.communeId]));

  const onem = await prisma.bureau.findMany({
    where: { type: "ONEM", active: true },
    select: { id: true, numeroOnem: true },
  });
  const bureauByNumero = new Map(
    onem.filter((b) => b.numeroOnem).map((b) => [b.numeroOnem!, b.id])
  );

  const plan = planChomageAssignments(cpMappings, cpToCommune, bureauByNumero);
  const communes = new Set(plan.map((a) => a.communeId));
  console.log(`  ${plan.length} assignments (1/commune), ${communes.size} communes couvertes`);

  // REPLACE : les anciens assignments chômage étaient partiels et pointaient
  // parfois vers des bureaux ONEM sans numéro (doublons) → findFirst non
  // déterministe. On reconstruit à l'identique depuis le mapping officiel.
  if (APPLY && plan.length > 0) {
    const res = await prisma.$transaction(async (tx) => {
      await tx.bureauAssignment.deleteMany({ where: { serviceType: "chomage" } });
      return tx.bureauAssignment.createMany({
        data: plan.map((a) => ({ ...a, serviceType: "chomage" })),
        skipDuplicates: true,
      });
    });
    console.log(`  ✓ ${res.count} assignments chomage (remplacés)`);
  }
}

async function assignPaiement() {
  console.log("\n━━ PAIEMENT (commune → section OP la plus proche, par région) ━");

  const communesRaw = await prisma.commune.findMany({
    where: { mergedIntoId: null },
    select: { id: true, region: true, lat: true, lng: true },
  });
  const communes: CommuneGeo[] = communesRaw.map((c) => ({
    communeId: c.id,
    region: normRegion(c.region),
    lat: c.lat,
    lng: c.lng,
  }));

  for (const org of ["capac", "fgtb", "csc", "synova"]) {
    const secsRaw = await prisma.bureau.findMany({
      where: { active: true, type: "SYNDICAT", organisme: { code: org }, lat: { not: null } },
      select: {
        id: true,
        lat: true,
        lng: true,
        postalCode: true,
        commune: { select: { region: true } },
      },
    });

    // Région de la section : via sa commune, sinon via son CP (fallback).
    const pcs = await prisma.postalCode.findMany({
      where: { code: { in: secsRaw.map((s) => s.postalCode) } },
      select: { code: true, commune: { select: { region: true } } },
    });
    const cpRegion = new Map(pcs.map((p) => [p.code, p.commune?.region ?? null]));

    const sections: SectionGeo[] = [];
    for (const s of secsRaw) {
      const region = s.commune?.region ?? cpRegion.get(s.postalCode) ?? null;
      if (region == null || s.lat == null || s.lng == null) continue;
      sections.push({ bureauId: s.id, region: normRegion(region), lat: s.lat, lng: s.lng });
    }

    const plan = planNearestAssignments(communes, sections);
    const covered = new Set(plan.map((a) => a.communeId));
    console.log(
      `  ${org.toUpperCase()} : ${sections.length} sections géolocalisées → ${plan.length} assignments (${covered.size} communes)`
    );

    if (APPLY && plan.length > 0) {
      const res = await prisma.bureauAssignment.createMany({
        data: plan.map((a) => ({ ...a, serviceType: `paiement_${org}` })),
        skipDuplicates: true,
      });
      console.log(`    ✓ ${res.count} nouveaux assignments paiement_${org}`);
    }
  }
}

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN (passe --yes pour appliquer)"}\n`);
  if (ONLY !== "paiement") await assignChomage();
  if (ONLY !== "chomage") await assignPaiement();
  if (!APPLY) console.log("\nDry-run terminé. Relance avec --yes pour appliquer.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
