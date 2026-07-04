// Seed générique d'un dossier codé → crée ses PdfForms + son DocumentBundle
// à partir de sa DossierDefinition. Source de vérité unique : le module.
// Idempotent au niveau des slugs ; option `force` pour ré-écrire.

import { PDFDocument, StandardFonts } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { saveSourcePdf } from "@/lib/pdf-forms/storage";
import { ingestPdf } from "@/lib/pdf-forms/ingest";
import type { PdfFormField, Localized } from "@/lib/pdf-forms/types";
import { loc } from "@/lib/pdf-forms/types";
import type { DossierDefinition, DossierDocument } from "./types";
import { resolveDocumentFields, type ResolvedField } from "./resolve";

export interface SeedResult {
  ok: boolean;
  created: boolean;
  bundleId: string;
  bundleSlug: string;
  pdfFormIds: string[];
  message: string;
}

export interface SeedOptions {
  /// Si true, supprime le bundle existant + les PdfForms publiés portés
  /// par ce dossier avant de recréer. Permet de re-seed après une mise à
  /// jour du module (ex. changement de mapping de widgets).
  force?: boolean;
}

function frLabel(l: Localized): string {
  return loc(l, "fr");
}

/// Génère un PDF gabarit 1+ pages avec un widget texte par champ résolu.
async function generateTemplatePdf(doc: DossierDocument, fields: ResolvedField[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([595, 842]);
  page.drawText(doc.title, { x: 50, y: 800, size: 16, font });
  page.drawText(`Émetteur : ${doc.issuer}`, { x: 50, y: 780, size: 10, font });
  page.drawText("Gabarit — à remplacer par le formulaire officiel.", { x: 50, y: 762, size: 9, font });

  const form = pdf.getForm();
  let y = 720;
  for (const f of fields) {
    if (y < 80) {
      page = pdf.addPage([595, 842]);
      y = 780;
    }
    page.drawText(`${frLabel(f.label)} :`, { x: 50, y, size: 10, font });
    const widget = form.createTextField(f.pdfFieldName);
    const h = f.type === "signature" ? 40 : 18;
    widget.addToPage(page, { x: 250, y: y - (h - 14), width: 290, height: h });
    y -= h + 12;
  }
  form.updateFieldAppearances(font);
  return Buffer.from(await pdf.save());
}

/// Charge le PDF source officiel (commit dans private/pdfs/) sous forme de
/// Buffer. La présence du fichier est validée — sinon on lève une erreur
/// claire pour que le seed n'avance pas en silence avec un stub.
async function readOfficialPdf(relativePath: string): Promise<Buffer> {
  const fullPath = join(process.cwd(), relativePath);
  try {
    return await readFile(fullPath);
  } catch {
    throw new Error(`PDF source introuvable : ${relativePath}`);
  }
}

/// Crée (idempotent par slug) un PdfForm publié à partir d'un document.
/// Si `doc.sourcePdfPath` est défini → utilise le vrai PDF officiel ; sinon
/// génère un stub. Quand l'AcroForm officiel a plus de widgets que les
/// champs déclarés dans le dossier, les widgets non mappés sont conservés
/// avec leur métadonnée auto-inférée (l'admin peut les enrichir ensuite).
async function createPdfFormForDocument(doc: DossierDocument, userId: string | null): Promise<string> {
  const existing = await prisma.pdfForm.findUnique({ where: { slug: doc.slug } });
  if (existing) return existing.id;

  const declaredFields = resolveDocumentFields(doc);
  const usingOfficial = !!doc.sourcePdfPath;
  const buffer = usingOfficial
    ? await readOfficialPdf(doc.sourcePdfPath!)
    : await generateTemplatePdf(doc, declaredFields);
  const filename = usingOfficial ? doc.sourcePdfPath!.split("/").pop()! : `${doc.slug}.pdf`;
  const storagePath = await saveSourcePdf(buffer, filename);
  const ingest = await ingestPdf(buffer);

  // Index par pdfFieldName pour matcher les déclarations du module aux
  // widgets réels du PDF.
  const declaredByPdfName = new Map(declaredFields.map((f) => [f.pdfFieldName, f]));

  let enriched: PdfFormField[];
  if (usingOfficial) {
    // PDF officiel = source de vérité. On part de l'inférence faite par
    // ingestPdf (déjà un PdfFormField[]) et on applique les overrides du
    // module pour les widgets déclarés. Les widgets non mappés gardent leur
    // métadonnée auto-inférée.
    // Dédoublonnage : un même champ (ex. NISS en tête de chaque page) apparaît
    // sur plusieurs widgets de MÊME nom. Le citoyen ne doit le voir qu'UNE fois.
    // On garde la 1ʳᵉ occurrence visible et on masque (hidden) les suivantes —
    // elles se remplissent quand même via le nom AcroForm partagé (pdf-lib).
    const seenPdfNames = new Set<string>();
    enriched = ingest.fields.map((inferred, i) => {
      const declared = declaredByPdfName.get(inferred.pdfFieldName);
      const isDuplicate = seenPdfNames.has(inferred.pdfFieldName);
      seenPdfNames.add(inferred.pdfFieldName);
      if (!declared) {
        // `lockUndeclaredFields` : tout champ non mappé par le module est
        // MASQUÉ du citoyen (formulaire complété par un tiers, ex. partie école
        // du DIPLÔME) → hidden + non requis. Il reste blanc dans le PDF.
        const hide = doc.lockUndeclaredFields === true || isDuplicate;
        return hide
          ? { ...inferred, order: i, hidden: true, required: false }
          : { ...inferred, order: i };
      }
      return {
        ...inferred,
        id: declared.key,
        type: declared.type,
        required: isDuplicate ? false : declared.required,
        label: declared.label,
        help: declared.help,
        prefillFrom: declared.prefillFrom,
        section: declared.section,
        order: i,
        // Répétition d'un champ déclaré (même nom PDF) → masquée : une seule
        // saisie citoyen, toutes les occurrences remplies via le nom partagé.
        ...(isDuplicate ? { hidden: true } : {}),
      } as PdfFormField;
    });
  } else {
    // Stub : on prend les déclarations du module comme autorité.
    enriched = declaredFields.map((f, i) => {
      const tech = ingest.fields.find((t) => t.pdfFieldName === f.pdfFieldName);
      return {
        id: f.key,
        pdfFieldName: f.pdfFieldName,
        type: f.type,
        required: f.required,
        label: f.label,
        help: f.help,
        prefillFrom: f.prefillFrom,
        section: f.section,
        order: i,
        acroType: tech?.acroType,
      } as PdfFormField;
    });
  }

  const created = await prisma.pdfForm.create({
    data: {
      slug: doc.slug,
      title: doc.title,
      issuer: doc.issuer,
      status: "published",
      defaultLocale: "fr",
      locales: ["fr"] as unknown as Prisma.InputJsonValue,
      sourceStoragePath: storagePath,
      sourceFileName: filename,
      sourceByteSize: ingest.byteSize,
      sourceSha256: ingest.sha256,
      pageCount: ingest.pageCount,
      technicalSchema: ingest.technicalSchema as unknown as Prisma.InputJsonValue,
      fields: enriched as unknown as Prisma.InputJsonValue,
      createdBy: userId,
    },
    select: { id: true },
  });
  return created.id;
}

/// Seed complet d'un dossier : PdfForms + bundle + items. Idempotent.
/// `force: true` ⇒ supprime le bundle + les PdfForms du dossier avant de
/// recréer (utile quand le module change : mapping de widgets, ajout de doc).
export async function seedDossier(
  def: DossierDefinition,
  userId: string | null,
  opts: SeedOptions = {}
): Promise<SeedResult> {
  if (opts.force) {
    // Drop le bundle (cascade sur les BundleItems) + les PdfForms aux slugs
    // du dossier. Pas de cascade automatique → on supprime explicitement.
    await prisma.documentBundle.deleteMany({ where: { slug: def.slug } });
    await prisma.pdfForm.deleteMany({ where: { slug: { in: def.documents.map((d) => d.slug) } } });
  } else {
    const existing = await prisma.documentBundle.findUnique({
      where: { slug: def.slug },
      include: { items: { include: { pdfForm: { select: { id: true } } } } },
    });
    if (existing) {
      return {
        ok: true,
        created: false,
        bundleId: existing.id,
        bundleSlug: existing.slug,
        pdfFormIds: existing.items.map((i) => i.pdfForm?.id).filter((x): x is string => !!x),
        message: `Dossier « ${def.title} » déjà présent — aucune modification (force=true pour ré-écrire).`,
      };
    }
  }

  // Seuls les documents remplissables par le citoyen (responsibility "user"
  // ou absent) deviennent des PdfForms + items de bundle. Les documents à
  // charge d'un tiers (employeur pour le C4, ONEM, mutuelle…) sont listés
  // dans la définition du dossier mais ne sont pas des formulaires à remplir
  // dans beldoc — ils seront surfacés ailleurs (panneau « documents à
  // fournir »). On les écarte ici pour ne pas générer de gabarit vide.
  const fillableDocs = def.documents.filter(
    (d) => !d.responsibility || d.responsibility === "user"
  );

  // 1. PdfForms (un par document remplissable).
  const pdfFormIds: string[] = [];
  for (const docDef of fillableDocs) {
    pdfFormIds.push(await createPdfFormForDocument(docDef, userId));
  }

  // 2. Bundle (questions/warnings convertis au format DB attendu, en FR).
  const eligibilityQuestions = def.questions.map((q) => ({
    id: q.id,
    label: frLabel(q.label),
    type: q.type,
    options: q.options?.map((o) => ({ value: o.value, label: frLabel(o.label) })),
    verdicts: {},
  }));
  const warnings = def.warnings.map((w) => ({ title: w.title, message: w.message, severity: w.severity }));

  const bundle = await prisma.documentBundle.create({
    data: {
      slug: def.slug,
      name: def.title,
      description: def.description,
      icon: def.icon,
      color: def.color,
      active: true,
      order: 0,
      lifeEventCategory: def.category,
      showOnOnboarding: true,
      vocabularyTags: def.vocabularyTags as unknown as Prisma.InputJsonValue,
      eligibilityQuestions: eligibilityQuestions as unknown as Prisma.InputJsonValue,
      warnings: warnings as unknown as Prisma.InputJsonValue,
    },
  });

  // 3. Items (un par document remplissable, aligné sur fillableDocs).
  for (let i = 0; i < fillableDocs.length; i++) {
    const docDef = fillableDocs[i];
    await prisma.documentBundleItem.create({
      data: {
        bundleId: bundle.id,
        pdfFormId: pdfFormIds[i],
        order: i,
        required: docDef.includeWhen ? false : docDef.required ?? true,
      },
    });
  }

  const externalCount = def.documents.length - fillableDocs.length;
  return {
    ok: true,
    created: true,
    bundleId: bundle.id,
    bundleSlug: bundle.slug,
    pdfFormIds,
    message: `Dossier « ${def.title} » créé avec ${fillableDocs.length} formulaire(s) à remplir (${
      fillableDocs.filter((d) => d.sourcePdfPath).length
    } PDF officiels)${externalCount > 0 ? ` + ${externalCount} document(s) à fournir par un tiers` : ""}.`,
  };
}
