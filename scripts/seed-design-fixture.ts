/** Synthetic recipe only. Never run against a shared database. */
import { PrismaClient, Prisma } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PdfFormField } from "../lib/pdf-forms/types";

const databaseUrl = process.env.DESIGN_RECIPE_DATABASE_URL;
if (!databaseUrl) throw new Error("Set DESIGN_RECIPE_DATABASE_URL explicitly to the disposable recipe database.");
const target = new URL(databaseUrl);
if (!["postgres:", "postgresql:"].includes(target.protocol) || target.hostname !== "127.0.0.1" || target.port !== "5434" || target.pathname !== "/docbel_design_20261023" || target.username !== "docbel_design" || [...target.searchParams.keys()].some((key) => key !== "schema")) {
  throw new Error("Refusing fixture: only docbel_design@127.0.0.1:5434/docbel_design_20261023 is allowed.");
}
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const marker = "docbel-design-synthetic-only-20261023";
const formId = "design-recipe-form";
const bundleId = "design-recipe-bundle";
const runId = "design-recipe-run";
const sourceStoragePath = "private/uploads/design-recipe.pdf";
const help = "RECETTE SYNTHÉTIQUE UNIQUEMENT. Choisissez une couleur pour vérifier les cartes de réponse, sans information personnelle ni règle administrative. Le choix Autre fait apparaître une précision obligatoire. Vous pouvez ouvrir cette aide, la faire défiler, puis la fermer au clavier ou au toucher sans perdre votre réponse. ".repeat(8);
const fields: PdfFormField[] = [
  { id: "recipe-choice", pdfFieldName: "recipe-choice", type: "radio", required: true, section: "demande", order: 1,
    label: { fr: "Quelle couleur de test choisissez-vous ?", nl: "Welke testkleur kiest u?", de: "Welche Testfarbe wählen Sie?" },
    help: { fr: help, nl: "ALLEEN SYNTHETISCHE TEST. Kies een testkleur. Andere toont een verplicht detail.", de: "NUR SYNTHETISCHER TEST. Andere zeigt eine Pflichtangabe." },
    options: [
      { value: "violet", label: { fr: "Violet de test", nl: "Testpaars", de: "Testviolett" } },
      { value: "vert", label: { fr: "Vert de test", nl: "Testgroen", de: "Testgrün" } },
      { value: "autre", label: { fr: "Autre couleur de test", nl: "Andere testkleur", de: "Andere Testfarbe" } },
    ],
    errorMsg: { fr: "Choisissez une couleur de test pour continuer." },
  },
  { id: "recipe-detail", pdfFieldName: "recipe-detail", type: "text", required: true, section: "demande", order: 2,
    label: { fr: "Précision synthétique", nl: "Synthetisch detail", de: "Synthetische Angabe" },
    visibleIf: { fieldId: "recipe-choice", op: "equals", value: "autre" },
    errorMsg: { fr: "Indiquez une précision synthétique." },
  },
  { id: "recipe-reference", pdfFieldName: "recipe-reference", type: "text", required: true, section: "divers", order: 3,
    label: { fr: "Repère de recette", nl: "Testreferentie", de: "Testreferenz" },
    help: { fr: "Saisissez uniquement un repère inventé, par exemple Recette Alpha. Ne saisissez aucune donnée personnelle." },
    errorMsg: { fr: "Indiquez un repère de recette." },
  },
];

async function main() {
  const [identity] = await db.$queryRaw<Array<{ database: string; username: string; port: number; address: string }>>`SELECT current_database() AS database, current_user AS username, inet_server_port() AS port, host(inet_server_addr()) AS address`;
  if (identity?.database !== "docbel_design_20261023" || identity.username !== "docbel_design" || identity.port !== 5434 || identity.address !== "127.0.0.1") throw new Error("Database identity does not match the disposable target.");
  await db.$executeRaw`CREATE TABLE IF NOT EXISTS "__DocbelDesignIsolation" ("marker" TEXT PRIMARY KEY, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
  await db.$executeRaw`INSERT INTO "__DocbelDesignIsolation" ("marker") VALUES (${marker}) ON CONFLICT DO NOTHING`;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("SYNTHETIC DESIGN RECIPE - NO ADMINISTRATIVE VALUE", { x: 35, y: 800, size: 13, font, color: rgb(0.3, 0.2, 0.6) });
  const acro = pdf.getForm();
  const choice = acro.createRadioGroup("recipe-choice");
  ["violet", "vert", "autre"].forEach((value, index) => {
    choice.addOptionToPage(value, page, { x: 40, y: 730 - index * 30, width: 16, height: 16 });
    page.drawText(value, { x: 65, y: 733 - index * 30, size: 11, font });
  });
  for (const [name, y] of [["recipe-detail", 600], ["recipe-reference", 530]] as const) {
    page.drawText(name, { x: 40, y: y + 30, size: 11, font });
    const field = acro.createTextField(name);
    field.addToPage(page, { x: 40, y, width: 490, height: 24, font });
  }
  const bytes = await pdf.save();
  await mkdir(resolve("private/uploads"), { recursive: true });
  await writeFile(resolve(sourceStoragePath), bytes);
  const jsonFields = fields as unknown as Prisma.InputJsonValue;
  await db.$transaction(async (tx) => {
    const section = await tx.toolSection.upsert({ where: { name: "RECETTE SYNTHÉTIQUE" }, create: { id: "design-recipe-section", name: "RECETTE SYNTHÉTIQUE", order: -100 }, update: {} });
    await tx.pdfForm.upsert({ where: { slug: "design-recipe" }, create: {
      id: formId, slug: "design-recipe", title: "RECETTE — formulaire synthétique", description: "Questionnaire de recette isolé, sans valeur administrative.",
      issuer: "RECETTE SYNTHÉTIQUE", status: "published", active: true, defaultLocale: "fr", locales: ["fr", "nl", "de"],
      sourceStoragePath, sourceFileName: "design-recipe.pdf", sourceByteSize: bytes.length, sourceSha256: createHash("sha256").update(bytes).digest("hex"),
      fields: jsonFields, technicalSchema: [], allowDownload: true,
    }, update: { fields: jsonFields, sourceStoragePath, sourceByteSize: bytes.length, sourceSha256: createHash("sha256").update(bytes).digest("hex") } });
    for (const [slug, name, active, audience] of [
      ["design-recipe", "RECETTE — outil actif", true, "citoyen"],
      ["design-recipe-disabled", "RECETTE — outil désactivé", false, "citoyen"],
      ["design-recipe-private", "RECETTE — outil privé", true, "partenaire"],
    ] as const) {
      await tx.tool.upsert({ where: { slug }, create: { slug, name, sectionId: section.id, description: "Métadonnée synthétique du catalogue isolé. Formulaire de recette : /document/design-recipe.", type: "info", active, audience, popular: true, order: -100 }, update: { active, audience } });
    }
    await tx.documentBundle.upsert({ where: { slug: "design-recipe" }, create: { id: bundleId, slug: "design-recipe", name: "RECETTE — ancienne démarche", description: "Ancienne démarche synthétique en consultation uniquement.", active: true, showOnOnboarding: true, items: { create: { pdfFormId: formId, required: true } } }, update: {} });
    await tx.bundleRun.upsert({ where: { id: runId }, create: { id: runId, bundleId, sessionId: "design-recipe-session", payloads: { [formId]: { "recipe-choice": "violet", "recipe-reference": "Ancienne recette" } }, completedTemplateIds: [formId], status: "completed", completedAt: new Date("2026-10-20T10:00:00Z") }, update: {} });
  });
  console.log(JSON.stringify({ marker, document: "/document/design-recipe", bundle: "/d/design-recipe?bundleRun=design-recipe-run", sessionCookie: "beldoc-bundle-session=design-recipe-session", pdfBytes: bytes.length, note: "Tool has no href column; the PDF uses its real independent document route." }));
}
main().finally(() => db.$disconnect()).catch((error: unknown) => { console.error(error); process.exitCode = 1; });
