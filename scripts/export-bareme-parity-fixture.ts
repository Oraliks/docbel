// Exporte un extrait du DERNIER barème ONEM publié (BaremeFile status=published)
// vers lib/chomage/__fixtures__/bareme-publie.json, pour le TEST DE PARITÉ
// code ↔ barème publié (lib/chomage/__tests__/parity.test.ts).
//
// À relancer après chaque publication d'un nouveau barème dans l'admin :
//   pnpm exec dotenv -e .env.local -- tsx scripts/export-bareme-parity-fixture.ts
// puis committer le JSON régénéré : le diff git montre exactement ce qui a
// changé côté ONEM, et le test de parité signale si lib/chomage/params.ts
// doit recevoir un nouveau jeu daté.
//
// Lecture seule — aucune écriture en base.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OUT_PATH = join(
  process.cwd(),
  "lib",
  "chomage",
  "__fixtures__",
  "bareme-publie.json",
);

async function main() {
  const file = await prisma.baremeFile.findFirst({
    where: { status: "published" },
    orderBy: [{ validFrom: "desc" }, { publishedAt: "desc" }],
    select: {
      id: true,
      name: true,
      validFrom: true,
      publishedAt: true,
      multiplicateur: true,
    },
  });
  if (!file) {
    console.error(
      "Aucun BaremeFile publié — publier un import dans /admin/baremes d'abord.",
    );
    process.exitCode = 1;
    return;
  }

  // Plafonds salariaux officiels (art. 111, al. 2) en mensuel — la référence
  // directe pour les plafonds de lib/chomage/params.ts.
  const plafonds = await prisma.baremeAmount.findMany({
    where: {
      fileId: file.id,
      comparisonKey: { startsWith: "other_unemployment_amount:art_111_al_2:monthly" },
    },
    select: { comparisonKey: true, labelNl: true, amount: true, unit: true },
    orderBy: { comparisonKey: "asc" },
  });

  // Feuille W (allocations d'insertion / de sauvegarde) — journalier.
  // Exportée en entier pour préparer l'encodage des montants d'insertion
  // (audit lot 3) : le choix des variantes (WA2/WN2/WP2/WB2, M1→5 vs M6→)
  // est une décision MÉTIER à valider avant tout usage dans un calcul.
  const allocationW = await prisma.baremeAmount.findMany({
    where: { fileId: file.id, category: "allocation_w" },
    select: {
      comparisonKey: true,
      labelFr: true,
      labelNl: true,
      amount: true,
      unit: true,
    },
    orderBy: { comparisonKey: "asc" },
  });

  const fixture = {
    exportedAt: new Date().toISOString(),
    file: {
      id: file.id,
      name: file.name,
      validFrom: file.validFrom?.toISOString() ?? null,
      publishedAt: file.publishedAt?.toISOString() ?? null,
      multiplicateur: file.multiplicateur,
    },
    plafondsArt111Monthly: plafonds.map((p) => ({
      comparisonKey: p.comparisonKey,
      labelNl: p.labelNl,
      amount: Number(p.amount),
    })),
    allocationW: allocationW.map((w) => ({
      comparisonKey: w.comparisonKey,
      labelFr: w.labelFr,
      labelNl: w.labelNl,
      amount: Number(w.amount),
      unit: w.unit,
    })),
  };

  writeFileSync(OUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  console.log(
    `Fixture écrite : ${OUT_PATH}\n  fichier publié : ${file.name} (validFrom ${
      file.validFrom?.toISOString().slice(0, 10) ?? "?"
    })\n  plafonds art.111 : ${plafonds.length} · feuille W : ${allocationW.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
