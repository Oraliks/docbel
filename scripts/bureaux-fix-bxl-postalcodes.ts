// Corrige les codes postaux bruxellois principaux mal rattachés : 4 communes
// n'avaient AUCUN code postal (Etterbeek, Ixelles, Saint-Gilles, Anderlecht)
// car leurs CP principaux étaient rattachés à « Ville de Bruxelles » (et 1070
// à Ganshoren). Sans ça, le résolveur route toute la zone vers la commune
// « Bruxelles » → mauvais CPAS/commune/FGTB pour ces 4 communes.
//
// Correctif ciblé, haute confiance (codes postaux résidentiels standard) :
//   1040 → Etterbeek, 1050 → Ixelles, 1060 → Saint-Gilles, 1070 → Anderlecht
// Les sous-codes institutionnels/boîtes postales (1031, 1041, 1047, 1051, 1052,
// 1071, 1100…) restent sur Ville de Bruxelles (ambigus, faible impact).
//
// Usage : pnpm bureaux:fix-bxl-cp          (dry-run)
//         pnpm bureaux:fix-bxl-cp --yes     (applique)

import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--yes");

// code postal → code INS de la commune correcte
const FIX: { cp: string; insCode: string; commune: string }[] = [
  { cp: "1040", insCode: "21005", commune: "Etterbeek" },
  { cp: "1050", insCode: "21009", commune: "Ixelles" },
  { cp: "1060", insCode: "21013", commune: "Saint-Gilles" },
  { cp: "1070", insCode: "21001", commune: "Anderlecht" },
];

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"}\n`);
  for (const f of FIX) {
    const commune = await prisma.commune.findUnique({ where: { insCode: f.insCode }, select: { id: true, nameFr: true } });
    if (!commune) { console.log(`⚠ commune [${f.insCode}] ${f.commune} introuvable — sauté`); continue; }
    const pc = await prisma.postalCode.findUnique({ where: { code: f.cp }, include: { commune: { select: { nameFr: true } } } });
    const from = pc?.commune?.nameFr ?? "AUCUN";
    console.log(`  CP ${f.cp} : ${from} → ${commune.nameFr}`);
    if (!APPLY) continue;
    await prisma.postalCode.upsert({
      where: { code: f.cp },
      update: { communeId: commune.id },
      create: { code: f.cp, communeId: commune.id },
    });
  }
  if (APPLY) console.log("\n✓ Codes postaux bruxellois corrigés. Enchaîner : bureaux:assign --yes (chomage + paiement).");
  else console.log("\nDry-run. --yes pour appliquer.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
