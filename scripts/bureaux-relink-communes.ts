// Lot 3 (suite) : relie chaque bureau à SA commune via son code postal réel.
//
// Cible les bureaux ACTIFS dont le communeId est :
//   - absent (SYNDICAT / AUTRE non liés), ou
//   - incohérent (le CP du bureau n'appartient pas aux CP de sa commune liée).
// Exclut ONEM (communeId volontairement null — dessert via assignments).
// Exclut les CP inconnus (stubs 0000 → traités au lot 2 adresses).
//
// Choix de la commune quand un CP est partagé : préfère celle dont le nom
// (FR/NL/DE) matche la ville ou le nom du bureau, sinon la commune dominante
// du CP (PostalCode.communeId).
//
// Non destructif : snapshot BureauRevision avant chaque changement.
//
// Usage :
//   pnpm bureaux:relink            (dry-run)
//   pnpm bureaux:relink --yes      (applique)

import { prisma } from "@/lib/prisma";
import { snapshotBureau } from "@/lib/bureaus/diff";
import type { Prisma } from "@prisma/client";

const APPLY = process.argv.includes("--yes");
const RESTORE = process.argv.includes("--restore");
// Par défaut on ne relie QUE les bureaux sans commune (gain pur, aucun risque
// de couverture). Les "mismatches" CPAS/COMMUNE sont entremêlés avec les stubs
// et le mapping CP→commune est peu fiable pour Bruxelles / CP partagés → à
// traiter au lot 2 (adresses). --include-mismatches pour forcer (déconseillé).
const INCLUDE_MISMATCHES = process.argv.includes("--include-mismatches");

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Rollback : restaure le communeId d'avant, depuis les snapshots de révision. */
async function restore() {
  const revs = await prisma.bureauRevision.findMany({
    where: { changedBy: "script:bureaux-relink" },
    orderBy: { createdAt: "desc" },
    select: { bureauId: true, snapshot: true },
  });
  const seen = new Set<string>();
  let done = 0;
  for (const r of revs) {
    if (seen.has(r.bureauId)) continue; // ne garder que la révision la plus récente
    seen.add(r.bureauId);
    const snap = r.snapshot as { communeId?: string | null };
    if (!APPLY) continue;
    await prisma.bureau.update({
      where: { id: r.bureauId },
      data: { communeId: snap.communeId ?? null, updatedBy: "script:bureaux-relink-restore" },
    });
    done++;
  }
  console.log(
    APPLY
      ? `✓ ${done} bureaux restaurés (communeId d'avant relink).`
      : `${seen.size} bureaux à restaurer. Relance avec --restore --yes.`
  );
}

async function main() {
  if (RESTORE) {
    console.log(`Mode : ${APPLY ? "🔥 RESTORE" : "👀 DRY RUN restore"}\n`);
    await restore();
    return;
  }
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN (passe --yes pour appliquer)"}\n`);

  // CP → toutes ses communes (avec noms) + commune dominante
  const pcs = await prisma.postalCode.findMany({
    select: {
      code: true,
      communeId: true,
      commune: { select: { id: true, nameFr: true, nameNl: true, nameDe: true } },
    },
  });
  const cpDominant = new Map<string, string>(); // code → communeId (1er = dominant)
  const cpCandidates = new Map<string, { id: string; names: string[] }[]>();
  for (const p of pcs) {
    if (!cpDominant.has(p.code)) cpDominant.set(p.code, p.communeId);
    const list = cpCandidates.get(p.code) ?? [];
    if (p.commune) {
      list.push({
        id: p.commune.id,
        names: [p.commune.nameFr, p.commune.nameNl, p.commune.nameDe].filter(Boolean).map((n) => norm(n!)),
      });
    }
    cpCandidates.set(p.code, list);
  }

  // Ensemble des CP par commune (pour détecter les incohérences)
  const cpsByCommune = new Map<string, Set<string>>();
  for (const p of pcs) {
    if (!cpsByCommune.has(p.communeId)) cpsByCommune.set(p.communeId, new Set());
    cpsByCommune.get(p.communeId)!.add(p.code);
  }

  const bureaus = await prisma.bureau.findMany({
    where: { active: true, type: { not: "ONEM" } },
    select: { id: true, name: true, type: true, city: true, postalCode: true, communeId: true },
  });

  type Plan = { id: string; from: string | null; to: string; label: string };
  const plan: Plan[] = [];

  for (const b of bureaus) {
    const cp = b.postalCode.trim();
    if (!cpDominant.has(cp)) continue; // CP inconnu → lot 2

    const currentOk =
      b.communeId != null && (cpsByCommune.get(b.communeId)?.has(cp) ?? false);
    if (currentOk) continue; // déjà cohérent

    // Par défaut : uniquement les bureaux SANS commune. Les mismatches (bureau
    // déjà lié à une autre commune) sont risqués (déplace un guichet vers la
    // commune "dominante" du CP, faux pour Bruxelles / CP partagés).
    const isMismatch = b.communeId != null;
    if (isMismatch && !INCLUDE_MISMATCHES) continue;

    // Choix de la commune cible
    const cands = cpCandidates.get(cp) ?? [];
    let targetId = cpDominant.get(cp)!;
    if (cands.length > 1) {
      const cityN = norm(b.city);
      const nameN = norm(b.name);
      const match = cands.find((c) => c.names.some((n) => n === cityN || nameN.includes(n)));
      if (match) targetId = match.id;
    }
    if (targetId === b.communeId) continue;

    plan.push({
      id: b.id,
      from: b.communeId,
      to: targetId,
      label: `${b.type} ${b.name} (CP ${cp})`,
    });
  }

  console.log(`${plan.length} bureaux à relier :`);
  const nullFix = plan.filter((p) => p.from == null).length;
  console.log(`  ${nullFix} sans commune, ${plan.length - nullFix} incohérents\n`);
  for (const p of plan.slice(0, 25)) console.log(`  ${p.label}`);
  if (plan.length > 25) console.log(`  … (+${plan.length - 25})`);

  if (!APPLY) {
    console.log("\nDry-run terminé. Relance avec --yes pour appliquer.");
    return;
  }

  console.log("\n🔥 Application (snapshot + relink)…");
  let done = 0;
  for (const p of plan) {
    const before = await prisma.bureau.findUnique({ where: { id: p.id } });
    if (!before) continue;
    await prisma.$transaction([
      prisma.bureauRevision.create({
        data: {
          bureauId: p.id,
          snapshot: snapshotBureau(before) as Prisma.InputJsonValue,
          changeNotes: `Relink commune par bureaux:relink (${p.from ?? "null"} → ${p.to})`,
          changedBy: "script:bureaux-relink",
        },
      }),
      prisma.bureau.update({
        where: { id: p.id },
        data: { communeId: p.to, updatedBy: "script:bureaux-relink" },
      }),
    ]);
    done++;
  }
  console.log(`✓ ${done} bureaux reliés.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
