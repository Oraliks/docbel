// Consolide 5 communes wallonnes/limbourgeoises présentes en DOUBLE dans notre
// table Commune : une ligne à l'ancien code INS (retiré de REFNIS suite aux
// renumérotations d'arrondissement 2025) + une ligne au nouveau code INS REFNIS
// (canonique, qui porte déjà les codes postaux). On absorbe la ligne obsolète
// dans la ligne REFNIS.
//
//   La Louvière  : 55022 (obsolète) → 58001 (REFNIS)
//   Mouscron     : 54007            → 57096
//   Soignies     : 55039            → 55040
//   Binche       : 56011            → 58002
//   Maasmechelen : 71047            → 73107
//
// Par cas : codes postaux + bureaux de la ligne obsolète déplacés vers la ligne
// REFNIS ; assignments de l'obsolète supprimés (régénérés) ; obsolète marquée
// mergedIntoId. CP officiel forcé sur la REFNIS.
//
// Enchaîner : bureaux:dedupe --yes, bureaux:apply-official --yes, bureaux:assign --yes
//
// Idempotent (si l'obsolète est déjà mergedInto, on ne refait que le forçage CP).
// Non destructif. Dry-run par défaut.
//
// Usage : pnpm bureaux:dedup-communes          (dry-run)
//         pnpm bureaux:dedup-communes --yes     (applique)

import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--yes");
const COMMUNES_PATH = path.resolve(process.cwd(), "lib/data/communes-officiel-2026-07.json");

// obsolète (ancien INS) → canonique (nouveau INS REFNIS)
const PAIRS: { name: string; obsolete: string; refnis: string }[] = [
  { name: "La Louvière", obsolete: "55022", refnis: "58001" },
  { name: "Mouscron", obsolete: "54007", refnis: "57096" },
  { name: "Soignies", obsolete: "55039", refnis: "55040" },
  { name: "Binche", obsolete: "56011", refnis: "58002" },
  { name: "Maasmechelen", obsolete: "71047", refnis: "73107" },
  // Diegem = section de Zaventem, ligne dupliquée (nameNl "Zaventem") : REFNIS
  // ne connaît que Zaventem [23094], déjà présent → on absorbe le doublon.
  { name: "Zaventem (Diegem)", obsolete: "23107", refnis: "23094" },
  // Borsbeek : fusion 2025 dans Anvers (devient le 10e district) → absente de
  // REFNIS. Antwerpen [11002] garde son INS et absorbe Borsbeek [11007].
  { name: "Borsbeek → Anvers", obsolete: "11007", refnis: "11002" },
];

interface CommuneRaw {
  code_ins: string;
  administration: { adresse: { code_postal: string } };
}

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN (passe --yes pour appliquer)"}\n`);
  const official = JSON.parse(readFileSync(COMMUNES_PATH, "utf8")) as CommuneRaw[];
  const officialByIns = new Map(official.map((o) => [o.code_ins, o]));

  for (const p of PAIRS) {
    const survivor = await prisma.commune.findUnique({ where: { insCode: p.refnis } });
    if (!survivor) { console.log(`⚠ ${p.name} : ligne REFNIS [${p.refnis}] introuvable — sauté`); continue; }
    const officialCp = officialByIns.get(p.refnis)?.administration.adresse.code_postal.trim() ?? "";

    const dup = await prisma.commune.findUnique({ where: { insCode: p.obsolete } });
    if (!dup) { console.log(`✓ ${p.name} : ligne obsolète [${p.obsolete}] déjà absente — sauté`); continue; }
    if (dup.mergedIntoId) {
      console.log(`✓ ${p.name} : obsolète déjà fusionnée — force CP ${officialCp}`);
      if (APPLY && /^\d{4}$/.test(officialCp)) {
        await prisma.postalCode.upsert({ where: { code: officialCp }, update: { communeId: survivor.id }, create: { code: officialCp, communeId: survivor.id } });
      }
      continue;
    }

    const pc = await prisma.postalCode.count({ where: { communeId: dup.id } });
    const bu = await prisma.bureau.count({ where: { communeId: dup.id } });
    const as = await prisma.bureauAssignment.count({ where: { communeId: dup.id } });
    console.log(`■ ${p.name} : absorbe la ligne obsolète [${p.obsolete}] dans REFNIS [${p.refnis}]`);
    console.log(`   à déplacer : ${pc} CP, ${bu} bureaux, ${as} assignments ; + CP officiel ${officialCp}`);

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      await tx.postalCode.updateMany({ where: { communeId: dup.id }, data: { communeId: survivor.id } });
      await tx.bureau.updateMany({ where: { communeId: dup.id }, data: { communeId: survivor.id } });
      await tx.bureauAssignment.deleteMany({ where: { communeId: dup.id } });
      await tx.commune.update({ where: { id: dup.id }, data: { mergedIntoId: survivor.id } });
      if (/^\d{4}$/.test(officialCp)) {
        await tx.postalCode.upsert({ where: { code: officialCp }, update: { communeId: survivor.id }, create: { code: officialCp, communeId: survivor.id } });
      }
    });
    console.log(`   ✓ consolidée`);
  }

  if (!APPLY) console.log("\nDry-run terminé. Relance avec --yes pour appliquer.");
  else console.log("\n✓ Terminé. Enchaîner : bureaux:dedupe --yes, bureaux:apply-official --yes, bureaux:assign --yes");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
