/**
 * Backfill migration 53 — sécurité des codes de reprise.
 *
 * Pour chaque BundleRun ayant encore un `resumeCode` EN CLAIR :
 *   1. calcule `resumeCodeHash` (HMAC) s'il manque,
 *   2. ANNULE `resumeCode` (on ne stocke plus jamais le code en clair).
 *
 * Idempotent : relançable sans effet de bord (les runs déjà traités n'ont plus
 * de `resumeCode` non-null et sont ignorés).
 *
 * Lancer une fois le quota Neon rétabli :
 *   pnpm backfill:resume-hash
 *   (ou : dotenv -e .env.local -- tsx scripts/backfill-resume-code-hash.ts)
 */
import { prisma } from "@/lib/prisma";
import { hashResumeCode } from "@/lib/bundles/resume-code-hash";

async function main() {
  const BATCH = 200;
  let processed = 0;

  for (;;) {
    const runs = await prisma.bundleRun.findMany({
      where: { resumeCode: { not: null } },
      select: { id: true, resumeCode: true, resumeCodeHash: true },
      take: BATCH,
    });
    if (runs.length === 0) break;

    for (const run of runs) {
      if (!run.resumeCode) continue;
      await prisma.bundleRun.update({
        where: { id: run.id },
        data: {
          resumeCodeHash: run.resumeCodeHash ?? hashResumeCode(run.resumeCode),
          resumeCode: null,
        },
      });
      processed += 1;
    }
    console.log(`… ${processed} runs traités`);
  }

  console.log(`Terminé : ${processed} code(s) haché(s) et clair supprimé.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
