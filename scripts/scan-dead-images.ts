// Scan des images cassées (« link-rot ») sur toute la base — version CLI,
// planifiable en tâche périodique (cron / Task Scheduler) pour une veille.
//
// Parcourt tous les champs URL-image (actualités, organismes, formations,
// avatars…), ping chaque URL et persiste le résultat dans AppSetting — la
// page admin /admin/medias affiche ensuite ce dernier scan sans re-pinger.
//
// Usage:
//   pnpm exec tsx scripts/scan-dead-images.ts
//   pnpm exec tsx scripts/scan-dead-images.ts --json
//   APP_URL=https://docbel.be pnpm exec tsx scripts/scan-dead-images.ts
// (APP_URL sert à vérifier aussi les URLs relatives /uploads/… ; optionnel.)

import { prisma } from "@/lib/prisma";
import {
  runDeadImageScan,
  saveScanResult,
} from "@/lib/media/dead-image-scan";

async function main() {
  const asJson = process.argv.includes("--json");
  const baseUrl =
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || undefined;

  const result = await runDeadImageScan({ baseUrl });
  await saveScanResult(result, "script:scan-dead-images");

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n🖼️  Scan images — ${result.scannedAt}`);
  console.log(
    `   Vérifiées: ${result.totalChecked} · Valides: ${result.okCount} · ` +
      `Cassées: ${result.deadCount} · Suspectes: ${result.suspectCount} · ${result.durationMs} ms\n`,
  );

  for (const s of result.bySource) {
    const flag = s.error ? "⚠️  lecture KO" : `${s.dead + s.suspect}/${s.checked}`;
    console.log(
      `   • ${s.label.padEnd(32)} ${flag}${s.error ? ` (${s.error})` : ""}`,
    );
  }

  if (result.items.length) {
    console.log(`\n   Détail (${result.items.length}) :`);
    for (const it of result.items) {
      const tag = it.severity === "dead" ? "❌" : "⚠️ ";
      console.log(
        `   ${tag} [${it.sourceLabel}] ${it.recordLabel} — ${it.reason}` +
          `${it.status ? ` (${it.status})` : ""}`,
      );
      console.log(`      ${it.url}`);
    }
  } else {
    console.log(`\n   ✅ Aucune image cassée.`);
  }
}

main()
  .catch((err) => {
    console.error("scan-dead-images: échec", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
