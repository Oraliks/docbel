// Réaligne sur REFNIS 2025 les 6 fusions communales où la commune SURVIVANTE a
// gardé son nom en absorbant une voisine (le code INS a changé). Différent des
// 7 fusions à nom nouveau (bureaux-merge-communes-2025.ts) : ici on renumérote
// la survivante EN PLACE et on absorbe la voisine.
//
// Fusions (vérifiées : VRT/L'Avenir + REFNIS) :
//   Wingene   [37018→37021] ← Ruiselede [37012]
//   Tielt     [37015→37022] ← Meulebeke [37007]
//   Lochristi [44034→44087] ← Wachtebeke [44073]
//   Lokeren   [46014→46029] ← Moerbeke  [44045]
//   Hasselt   [71022→71072] ← Kortessem [73040]
//   Bastogne  [82003→82039] ← Bertogne  [82005]   (1re fusion wallonne)
//
// Par fusion : la survivante prend le nouveau code INS + les noms officiels ;
// les codes postaux + bureaux + assignments de la voisine sont déplacés vers
// elle ; la voisine est marquée mergedIntoId. Le CP officiel est forcé.
//
// Enchaîner ensuite : bureaux:dedupe --yes, bureaux:apply-official --yes,
// bureaux:assign --yes.
//
// Idempotent (si la survivante a déjà le nouveau code INS, on ne refait que le
// forçage du CP). Non destructif (aucune suppression de commune/bureau).
//
// Usage : pnpm bureaux:realign-ins          (dry-run)
//         pnpm bureaux:realign-ins --yes     (applique)

import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--yes");
const COMMUNES_PATH = path.resolve(process.cwd(), "lib/data/communes-officiel-2026-07.json");

// survivante (ancien INS) → nouveau INS REFNIS + voisines absorbées (anciens INS)
const REALIGN: { oldIns: string; newIns: string; absorbed: string[] }[] = [
  { oldIns: "37018", newIns: "37021", absorbed: ["37012"] }, // Wingene ← Ruiselede
  { oldIns: "37015", newIns: "37022", absorbed: ["37007"] }, // Tielt ← Meulebeke
  { oldIns: "44034", newIns: "44087", absorbed: ["44073"] }, // Lochristi ← Wachtebeke
  { oldIns: "46014", newIns: "46029", absorbed: ["44045"] }, // Lokeren ← Moerbeke
  { oldIns: "71022", newIns: "71072", absorbed: ["73040"] }, // Hasselt ← Kortessem
  { oldIns: "82003", newIns: "82039", absorbed: ["82005"] }, // Bastogne ← Bertogne
];

interface CommuneRaw {
  code_ins: string;
  commune: string;
  noms: { fr: string | null; nl: string | null; de: string | null };
  administration: { adresse: { code_postal: string } };
}

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN (passe --yes pour appliquer)"}\n`);
  const official = JSON.parse(readFileSync(COMMUNES_PATH, "utf8")) as CommuneRaw[];
  const officialByIns = new Map(official.map((o) => [o.code_ins, o]));

  for (const r of REALIGN) {
    const o = officialByIns.get(r.newIns);
    if (!o) { console.log(`⚠ [${r.newIns}] absent du fichier officiel — sauté`); continue; }
    const officialCp = o.administration.adresse.code_postal.trim();

    // Idempotent : déjà renuméroté ?
    const already = await prisma.commune.findUnique({ where: { insCode: r.newIns } });
    if (already) {
      console.log(`✓ [${r.newIns}] ${o.commune} déjà réaligné — force CP ${officialCp}`);
      if (APPLY && /^\d{4}$/.test(officialCp)) {
        await prisma.postalCode.upsert({
          where: { code: officialCp },
          update: { communeId: already.id },
          create: { code: officialCp, communeId: already.id },
        });
      }
      continue;
    }

    const survivor = await prisma.commune.findUnique({ where: { insCode: r.oldIns } });
    if (!survivor) { console.log(`⚠ survivante [${r.oldIns}] introuvable — sauté`); continue; }
    const absorbed = await prisma.commune.findMany({ where: { insCode: { in: r.absorbed } }, select: { id: true, insCode: true, nameFr: true } });
    const missing = r.absorbed.filter((ins) => !absorbed.some((c) => c.insCode === ins));
    if (missing.length) { console.log(`⚠ [${r.newIns}] voisines introuvables ${missing.join(",")} — sauté`); continue; }
    const absorbedIds = absorbed.map((c) => c.id);

    const pc = await prisma.postalCode.count({ where: { communeId: { in: absorbedIds } } });
    const bu = await prisma.bureau.count({ where: { communeId: { in: absorbedIds } } });
    const as = await prisma.bureauAssignment.count({ where: { communeId: { in: absorbedIds } } });
    console.log(`■ ${survivor.nameFr} [${r.oldIns}→${r.newIns}] absorbe ${absorbed.map((c) => `${c.nameFr}[${c.insCode}]`).join(", ")}`);
    console.log(`   à déplacer : ${pc} CP, ${bu} bureaux, ${as} assignments ; + CP officiel ${officialCp}`);

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      // Renumérote la survivante + noms officiels
      await tx.commune.update({
        where: { id: survivor.id },
        data: { insCode: r.newIns, nameFr: o.noms.fr ?? survivor.nameFr, nameNl: o.noms.nl, nameDe: o.noms.de },
      });
      // Absorbe la voisine
      await tx.postalCode.updateMany({ where: { communeId: { in: absorbedIds } }, data: { communeId: survivor.id } });
      await tx.bureau.updateMany({ where: { communeId: { in: absorbedIds } }, data: { communeId: survivor.id } });
      await tx.bureauAssignment.deleteMany({ where: { communeId: { in: absorbedIds } } });
      await tx.commune.updateMany({ where: { id: { in: absorbedIds } }, data: { mergedIntoId: survivor.id } });
      // Force le CP officiel
      if (/^\d{4}$/.test(officialCp)) {
        await tx.postalCode.upsert({
          where: { code: officialCp },
          update: { communeId: survivor.id },
          create: { code: officialCp, communeId: survivor.id },
        });
      }
    });
    console.log(`   ✓ réaligné + voisine absorbée`);
  }

  if (!APPLY) console.log("\nDry-run terminé. Relance avec --yes pour appliquer.");
  else console.log("\n✓ Terminé. Enchaîner : bureaux:dedupe --yes, bureaux:apply-official --yes, bureaux:assign --yes");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
