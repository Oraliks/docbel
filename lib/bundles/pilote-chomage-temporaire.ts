/// Pilote "Chômage temporaire" — crée un bundle de bout en bout pour valider
/// le bridge PdfForm ↔ Bundle. Idempotent : si le bundle (slug) existe déjà,
/// renvoie l'existant sans rien recréer.
///
/// Contenu : 3 questions d'orientation, 3 PdfForm AcroForm minimaux (générés
/// avec pdf-lib à la volée), conditions cross-form, 1 avertissement critique.

import { PDFDocument, PDFTextField, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { saveSourcePdf } from "@/lib/pdf-forms/storage";
import { ingestPdf } from "@/lib/pdf-forms/ingest";
import type { PdfFormField } from "@/lib/pdf-forms/types";
import type { Prisma } from "@prisma/client";

const BUNDLE_SLUG = "chomage-temporaire";

export interface PiloteResult {
  ok: boolean;
  created: boolean;
  bundleId: string;
  bundleSlug: string;
  pdfFormIds: string[];
  message: string;
}

interface StubFieldSpec {
  name: string;
  label: string;
  prefillFrom?: string;
}

interface StubFormSpec {
  slug: string;
  title: string;
  issuer: string;
  fields: StubFieldSpec[];
}

/// Trois PDFs minimaux — réalistes en termes de champs partagés (NISS, nom,
/// adresse, date) pour démontrer la propagation cross-document.
const STUB_FORMS: StubFormSpec[] = [
  {
    slug: "pilote-c32a-carte-controle",
    title: "C3.2A — Carte de contrôle (pilote)",
    issuer: "ONEM",
    fields: [
      { name: "FullName", label: "Nom complet" },
      { name: "NISS", label: "Numéro NISS", prefillFrom: "profile.niss" },
      { name: "Street", label: "Rue", prefillFrom: "profile.street" },
      { name: "PostalCode", label: "Code postal", prefillFrom: "profile.postalCode" },
      { name: "City", label: "Ville", prefillFrom: "profile.city" },
      { name: "DateOfRequest", label: "Date de la demande" },
    ],
  },
  {
    slug: "pilote-c32-employeur",
    title: "C3.2-Employeur (pilote)",
    issuer: "ONEM",
    fields: [
      { name: "FullName", label: "Nom du travailleur" },
      { name: "NISS", label: "Numéro NISS", prefillFrom: "profile.niss" },
      { name: "EmployerName", label: "Nom de l'employeur", prefillFrom: "profile.firstName" },
      { name: "EmployerBCE", label: "N° BCE employeur" },
      { name: "DateOfRequest", label: "Date" },
    ],
  },
  {
    slug: "pilote-c32a-fmm",
    title: "C3.2A — Force majeure météorologique (pilote)",
    issuer: "ONEM",
    fields: [
      { name: "FullName", label: "Nom complet" },
      { name: "NISS", label: "Numéro NISS", prefillFrom: "profile.niss" },
      { name: "WeatherEvent", label: "Évènement météorologique" },
      { name: "DateOfRequest", label: "Date" },
    ],
  },
];

/// Génère un PDF AcroForm 1-page minimal avec les champs spécifiés.
async function generateStubPdf(spec: StubFormSpec): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]); // A4
  page.drawText(spec.title, { x: 50, y: 800, size: 16, font });
  page.drawText(`Émetteur : ${spec.issuer}`, { x: 50, y: 780, size: 10, font });
  page.drawText("PDF d'exemple — à remplacer par le formulaire officiel.", {
    x: 50, y: 760, size: 9, font,
  });

  const form = doc.getForm();
  let y = 720;
  for (const f of spec.fields) {
    page.drawText(f.label + " :", { x: 50, y, size: 10, font });
    const text = form.createTextField(f.name);
    text.addToPage(page, { x: 250, y: y - 4, width: 290, height: 18 });
    if (f.label) (text as PDFTextField).setText("");
    y -= 28;
  }
  form.updateFieldAppearances(font);
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/// Crée un PdfForm complet (PDF source + parse + schéma enrichi + prefillFrom).
async function createStubPdfForm(spec: StubFormSpec, userId: string | null): Promise<string> {
  const buffer = await generateStubPdf(spec);
  const filename = `${spec.slug}.pdf`;
  const storagePath = await saveSourcePdf(buffer, filename);
  const ingest = await ingestPdf(buffer);

  // On applique les prefillFrom du spec sur le schéma enrichi auto-déduit
  // (matching par pdfFieldName), pour activer la propagation cross-form.
  const enriched: PdfFormField[] = ingest.fields.map((f) => {
    const stub = spec.fields.find((s) => s.name === f.pdfFieldName);
    if (!stub?.prefillFrom) return f;
    return { ...f, prefillFrom: stub.prefillFrom as PdfFormField["prefillFrom"] };
  });

  const created = await prisma.pdfForm.create({
    data: {
      slug: spec.slug,
      title: spec.title,
      issuer: spec.issuer,
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

/// Crée (ou rafraîchit) le bundle pilote complet. Idempotent au niveau du slug.
export async function createOrUpdatePiloteChomageTemporaire(
  userId: string | null
): Promise<PiloteResult> {
  const existing = await prisma.documentBundle.findUnique({
    where: { slug: BUNDLE_SLUG },
    include: { items: { include: { pdfForm: { select: { id: true } } } } },
  });
  if (existing) {
    return {
      ok: true,
      created: false,
      bundleId: existing.id,
      bundleSlug: existing.slug,
      pdfFormIds: existing.items.map((i) => i.pdfForm?.id).filter((x): x is string => !!x),
      message: "Bundle pilote déjà présent — aucune modification.",
    };
  }

  // 1. Crée les 3 PdfForm stub (idempotent par slug — skip si déjà là).
  const pdfFormIds: string[] = [];
  for (const spec of STUB_FORMS) {
    const found = await prisma.pdfForm.findUnique({ where: { slug: spec.slug } });
    if (found) {
      pdfFormIds.push(found.id);
      continue;
    }
    const id = await createStubPdfForm(spec, userId);
    pdfFormIds.push(id);
  }

  // 2. Crée le bundle avec questions, warnings, items + conditions.
  const eligibilityQuestions = [
    {
      id: "motif",
      label: "Quel est le motif du chômage temporaire ?",
      type: "select",
      options: [
        { value: "fmm", label: "Force majeure météorologique" },
        { value: "intemperies", label: "Intempéries" },
        { value: "economique", label: "Économique" },
        { value: "autre", label: "Autre force majeure" },
      ],
      verdicts: {},
    },
    {
      id: "statut",
      label: "Vous êtes ouvrier ou employé ?",
      type: "select",
      options: [
        { value: "ouvrier", label: "Ouvrier" },
        { value: "employe", label: "Employé" },
      ],
      verdicts: {},
    },
    {
      id: "premiere_demande",
      label: "C'est votre première demande pour ce motif ?",
      type: "boolean",
      verdicts: {},
    },
  ];

  const warnings = [
    {
      title: "Délai légal de 7 jours",
      message:
        "Vous devez introduire votre demande dans les 7 jours calendrier qui suivent votre dernier jour effectivement presté.",
      severity: "critical",
    },
  ];

  const bundle = await prisma.documentBundle.create({
    data: {
      slug: BUNDLE_SLUG,
      name: "Chômage temporaire",
      description:
        "Aide à constituer le dossier de chômage temporaire (force majeure météo, intempéries, économique). Pilote bridge PdfForm ↔ Bundle.",
      icon: "💼",
      color: "#FF8C42",
      active: true,
      order: 0,
      lifeEventCategory: "emploi",
      showOnOnboarding: true,
      vocabularyTags: [
        "chômage",
        "chomage temporaire",
        "ONEM",
        "force majeure",
        "intempéries",
        "fermeture temporaire",
        "RVA",
      ] as unknown as Prisma.InputJsonValue,
      eligibilityQuestions: eligibilityQuestions as unknown as Prisma.InputJsonValue,
      warnings: warnings as unknown as Prisma.InputJsonValue,
    },
  });

  // 3. Crée les items avec conditions :
  //    - PDF 1 (Carte de contrôle) : toujours requis
  //    - PDF 2 (C3.2-Employeur)    : toujours requis
  //    - PDF 3 (FMM)               : uniquement si motif = "fmm"
  await prisma.documentBundleItem.create({
    data: {
      bundleId: bundle.id,
      pdfFormId: pdfFormIds[0],
      order: 0,
      required: true,
    },
  });
  await prisma.documentBundleItem.create({
    data: {
      bundleId: bundle.id,
      pdfFormId: pdfFormIds[1],
      order: 1,
      required: true,
    },
  });
  // Pour PDF 3 : condition cross-form référencée par le motif. Comme le motif
  // est une eligibilityQuestion (pas un champ de PDF), on laisse `condition`
  // à `null` pour le pilote — le filtrage par motif sera ajouté en PR suivante
  // quand l'évaluateur saura lire eligibilityAnswers.
  await prisma.documentBundleItem.create({
    data: {
      bundleId: bundle.id,
      pdfFormId: pdfFormIds[2],
      order: 2,
      required: false,
    },
  });

  return {
    ok: true,
    created: true,
    bundleId: bundle.id,
    bundleSlug: bundle.slug,
    pdfFormIds,
    message: "Bundle pilote « Chômage temporaire » créé avec 3 PdfForms.",
  };
}
