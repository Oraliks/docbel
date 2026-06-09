// Pré-import des sous-formulaires C1A / C1B / C1C en DB depuis private/pdfs/.
//
// Ces 3 PdfForms sont les cibles des triggers du C1 (cf. C1_TRIGGERS dans
// lib/pdf-forms/seed/c1-fields-improvements.ts). Pour que la matérialisation
// runtime fonctionne, les slugs `c1a`, `c1b`, `c1c` doivent exister en DB.
//
// Le script :
// 1. Lit chaque PDF depuis private/pdfs/ (C1A_FR.pdf, C1B_FR.pdf, C1C_FR.pdf)
// 2. Crée le PdfForm correspondant en DB avec status=draft (l'admin publie)
// 3. Si un PdfForm avec ce slug existe déjà, ne touche à rien (idempotent)
//
// Usage : pnpm tsx scripts/seed-c1-companion-forms.ts        (dry run)
//         pnpm tsx scripts/seed-c1-companion-forms.ts --yes  (applique)

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ingestPdf } from "@/lib/pdf-forms/ingest";
import { saveSourcePdf } from "@/lib/pdf-forms/storage";

const APPLY = process.argv.includes("--yes");
const PDF_DIR = join(process.cwd(), "private", "pdfs");

/// Cinq sous-formulaires liés au C1 (cf. feuille d'information C1).
const COMPANIONS = [
  {
    slug: "c1a",
    file: "C1A_FR.pdf",
    title: "C1A — Activité accessoire, aide à un indépendant, mandat",
    description:
      "Formulaire à joindre au C1 quand le travailleur exerce une activité accessoire, aide un indépendant, est administrateur de société ou exerce un mandat politique (sauf conseiller communal/CPAS).",
  },
  {
    slug: "c1b",
    file: "C1B_FR.pdf",
    title: "C1B — Pension de retraite ou de survie",
    description:
      "Formulaire à joindre au C1 quand le travailleur perçoit une pension de retraite ou de survie. Ne concerne pas l'allocation de transition limitée dans le temps.",
  },
  {
    slug: "c1c",
    file: "C1C_FR.pdf",
    title: "C1C — Tremplin-indépendants",
    description:
      "Formulaire à joindre au C1 quand le travailleur exerce une activité accessoire comme indépendant et bénéficie de la mesure « Tremplin-indépendants ».",
  },
  {
    slug: "c46",
    file: "C46_FR.pdf",
    title: "C46 — Mandat dans un organe consultatif (secteur culturel / Comm. travail des arts)",
    description:
      "Formulaire à joindre au C1 quand le travailleur exerce un mandat rémunéré dans un organe consultatif du secteur culturel ou de la Commission du travail des arts.",
  },
  {
    slug: "c1-partenaire",
    file: "C1-Partenaire_FR.pdf",
    title: "C1-Partenaire — Personne financièrement à charge",
    description:
      "Formulaire à joindre au C1 quand une personne du ménage (autre qu'un enfant) est déclarée comme financièrement à charge du travailleur.",
  },
] as const;

async function importOne(c: (typeof COMPANIONS)[number]): Promise<{
  status: "created" | "exists" | "skipped";
  message: string;
}> {
  const existing = await prisma.pdfForm.findUnique({ where: { slug: c.slug } });
  if (existing) {
    return { status: "exists", message: `Existe déjà (id=${existing.id}, status=${existing.status})` };
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(join(PDF_DIR, c.file));
  } catch {
    return { status: "skipped", message: `Source ${c.file} introuvable dans ${PDF_DIR}` };
  }

  if (!APPLY) {
    return { status: "skipped", message: `(dry-run) prêt à créer depuis ${c.file}` };
  }

  const ingest = await ingestPdf(buffer);
  const storagePath = await saveSourcePdf(buffer, c.file);

  const created = await prisma.pdfForm.create({
    data: {
      slug: c.slug,
      title: c.title,
      description: c.description,
      issuer: "ONEM",
      defaultLocale: "fr",
      locales: ["fr"] as unknown as Prisma.InputJsonValue,
      sourceStoragePath: storagePath,
      sourceFileName: c.file,
      sourceByteSize: ingest.byteSize,
      sourceSha256: ingest.sha256,
      pageCount: ingest.pageCount,
      technicalSchema: ingest.technicalSchema as unknown as Prisma.InputJsonValue,
      fields: ingest.fields as unknown as Prisma.InputJsonValue,
      // status reste à draft (défaut) — l'admin publie quand il a fini
      // d'éditer le schéma.
    },
    select: { id: true, slug: true, pageCount: true },
  });

  return {
    status: "created",
    message: `Créé id=${created.id}, ${created.pageCount} page(s), ${ingest.fields.length} champ(s) inféré(s) — status=draft`,
  };
}

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"}\n`);

  for (const c of COMPANIONS) {
    const res = await importOne(c);
    const icon = res.status === "created" ? "✅" : res.status === "exists" ? "ℹ️ " : "⚠️ ";
    console.log(`${icon} ${c.slug.padEnd(4)} ${res.message}`);
  }

  if (!APPLY) {
    console.log("\nDry-run terminé. Passe --yes pour appliquer.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
