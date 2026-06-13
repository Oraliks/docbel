// Seed des données Docbel Employeur : sources officielles (S1..S13) + jeu de
// règles initial du moteur déterministe. Idempotent (upsert par `code`).
// Préserve les champs édités côté admin (active, lastCheckedAt) lors d'un re-run.
//   pnpm seed:employer
import { PrismaClient, Prisma } from "@prisma/client";
import { LEGAL_SOURCES } from "../lib/employeur/data/legal-sources";
import { STARTER_RULES } from "../lib/employeur/data/starter-rules";
import { ruleOutputListSchema } from "../lib/employeur/rules/output";

const prisma = new PrismaClient();

async function main() {
  let sources = 0;
  for (const s of LEGAL_SOURCES) {
    await prisma.employerLegalSource.upsert({
      where: { code: s.code },
      create: {
        code: s.code,
        title: s.title,
        institution: s.institution,
        url: s.url,
        contentSummary: s.contentSummary,
        reliability: s.reliability,
        appliesToModules: s.appliesToModules,
      },
      // Ne pas écraser `active` ni `lastCheckedAt` (édités par l'admin).
      update: {
        title: s.title,
        institution: s.institution,
        url: s.url,
        contentSummary: s.contentSummary,
        reliability: s.reliability,
        appliesToModules: s.appliesToModules,
      },
    });
    sources += 1;
  }

  let rules = 0;
  for (const r of STARTER_RULES) {
    // Validation défensive : refuse une règle dont les outputs sont mal formés.
    ruleOutputListSchema.parse(r.outputJson);
    const conditionJson = r.conditionJson as unknown as Prisma.InputJsonValue;
    const outputJson = r.outputJson as unknown as Prisma.InputJsonValue;
    await prisma.employerRule.upsert({
      where: { code: r.code },
      create: {
        code: r.code,
        title: r.title,
        description: r.description,
        conditionJson,
        outputJson,
        severity: r.severity,
        sourceCode: r.sourceCode,
        internalNote: r.internalNote ?? null,
      },
      // Ne pas écraser `active` (l'admin peut avoir désactivé la règle).
      update: {
        title: r.title,
        description: r.description,
        conditionJson,
        outputJson,
        severity: r.severity,
        sourceCode: r.sourceCode,
      },
    });
    rules += 1;
  }

  console.log(`✓ Docbel Employeur seedé : ${sources} sources, ${rules} règles.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
