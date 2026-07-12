// Lot 1 du plan qualité bureaux : purge des doublons / bruit d'import OSM.
//
// Regroupe les CPAS et maisons communales en doublons potentiels, choisit le
// meilleur à garder (module pur lib/bureaus/dedupe.ts) et DÉSACTIVE les autres
// (active=false — jamais de delete), en snapshotant chaque perdant dans
// BureauRevision pour rollback.
//
// Groupes :
//   A. (type, communeId)  → CPAS/COMMUNE liés à la même commune (modèle = 1/commune)
//   B. (type, postalCode, nom normalisé) → doublons exacts sans communeId
//
// Garde-fous :
//   - un bureau `verified` ne se fait jamais évincer par un import
//   - on garde toujours au moins un bureau actif par groupe (respecte la garde
//     "dernier CPAS/COMMUNE de la commune")
//   - dry-run par défaut ; --yes pour appliquer
//   - export CSV du plan avant application recommandé
//
// Usage :
//   pnpm bureaux:dedupe            (dry-run, affiche le plan)
//   pnpm bureaux:dedupe --yes      (applique : désactive les perdants + révisions)

import { prisma } from "@/lib/prisma";
import { pickSurvivor, groupDuplicates, type DedupCandidate } from "@/lib/bureaus/dedupe";
import { snapshotBureau } from "@/lib/bureaus/diff";
import type { Prisma } from "@prisma/client";

const APPLY = process.argv.includes("--yes");
const RESTORE = process.argv.includes("--restore");
const SCRIPT_TAG = "script:bureaux-dedupe";

function hoursCount(hours: unknown): number {
  if (!Array.isArray(hours)) return 0;
  return hours.length;
}

/** Réactive tous les bureaux que ce script a désactivés (rollback complet). */
async function restore() {
  const disabled = await prisma.bureau.findMany({
    where: { active: false, updatedBy: SCRIPT_TAG },
    select: { id: true, name: true },
  });
  console.log(`${disabled.length} bureaux désactivés par le script à réactiver.`);
  if (!APPLY) {
    console.log("\nDry-run. Relance avec --restore --yes pour réactiver.");
    return;
  }
  for (const b of disabled) {
    await prisma.bureau.update({
      where: { id: b.id },
      data: { active: true, updatedBy: "script:bureaux-dedupe-restore" },
    });
  }
  console.log(`✓ ${disabled.length} bureaux réactivés.`);
}

async function main() {
  if (RESTORE) {
    console.log(`Mode : ${APPLY ? "🔥 RESTORE" : "👀 DRY RUN restore"}\n`);
    await restore();
    return;
  }
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN (passe --yes pour appliquer)"}\n`);

  // On ne dédoublonne que les guichets territoriaux (CPAS / maisons communales),
  // là où le modèle impose 1 bureau ↔ 1 commune. Les SYNDICAT/ONEM ont plusieurs
  // antennes légitimes par zone → hors périmètre.
  const bureaus = await prisma.bureau.findMany({
    where: { active: true, type: { in: ["CPAS", "COMMUNE"] } },
    select: {
      id: true,
      name: true,
      type: true,
      street: true,
      postalCode: true,
      communeId: true,
      phone: true,
      hours: true,
      lat: true,
      verified: true,
      updatedAt: true,
    },
  });

  const candidates: DedupCandidate[] = bureaus.map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    street: b.street,
    postalCode: b.postalCode,
    communeId: b.communeId,
    phone: b.phone,
    hoursCount: hoursCount(b.hours),
    lat: b.lat,
    verified: b.verified,
    updatedAt: b.updatedAt,
  }));

  const dupGroups = groupDuplicates(candidates);
  console.log(`${dupGroups.length} groupes de doublons détectés\n`);

  let totalLosers = 0;
  const toDisable: { id: string; reason: string }[] = [];

  for (const g of dupGroups) {
    const { survivor, losers } = pickSurvivor(g);
    if (losers.length === 0) continue;

    console.log(`■ ${survivor.type} — ${g.length} bureaux`);
    console.log(`  ✓ GARDE : ${survivor.name} (${survivor.street}, ${survivor.postalCode})`);
    for (const l of losers) {
      console.log(`  ✗ désactive : ${l.name} (${l.street}) — ${l.reason}`);
      toDisable.push({ id: l.id, reason: l.reason });
      totalLosers++;
    }
    console.log("");
  }

  console.log(`\n${totalLosers} bureaux à désactiver au total.`);

  if (!APPLY) {
    console.log("\nDry-run terminé. Relance avec --yes pour appliquer.");
    return;
  }

  console.log("\n🔥 Application (snapshot + désactivation)…");
  let done = 0;
  for (const { id, reason } of toDisable) {
    const before = await prisma.bureau.findUnique({ where: { id } });
    if (!before) continue;
    await prisma.$transaction([
      prisma.bureauRevision.create({
        data: {
          bureauId: id,
          snapshot: snapshotBureau(before) as Prisma.InputJsonValue,
          changeNotes: `Désactivé par bureaux:dedupe — ${reason}`,
          changedBy: "script:bureaux-dedupe",
        },
      }),
      prisma.bureau.update({
        where: { id },
        data: { active: false, updatedBy: "script:bureaux-dedupe" },
      }),
    ]);
    done++;
  }
  console.log(`✓ ${done} bureaux désactivés (réversibles via BureauRevision).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
