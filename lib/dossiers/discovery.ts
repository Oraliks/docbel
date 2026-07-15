import { parseStringArray } from "@/lib/bundles/types";
import type { DossierDefinition } from "./types";

export interface DiscoveryPdfForm {
  slug: string;
  title: string;
  issuer: string | null;
  status: string;
  active: boolean;
}

export interface DossierDiscoveryInput {
  organism: string | null;
  vocabularyTags: unknown;
  requiredDocuments: unknown;
  items: Array<{
    required: boolean;
    pdfForm: DiscoveryPdfForm | null;
  }>;
}

export interface DossierDiscoveryMetadata {
  organism: string | null;
  vocabularyTags: string[];
  requiredDocuments: string[];
  documentCount: number;
}

function unique(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("fr-BE");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

/**
 * Construit les informations de découverte affichées dans `/mon-dossier`.
 *
 * Les métadonnées éditoriales de la DB restent prioritaires, mais un dossier
 * piloté par code apporte ses documents et synonymes quand les anciennes
 * lignes DB n'ont jamais été enrichies. Pour un dossier no-code, les PdfForms
 * publiés constituent le repli. Cette fonction ne modifie aucune donnée.
 */
export function deriveDossierDiscoveryMetadata(
  input: DossierDiscoveryInput,
  dossier: DossierDefinition | null,
): DossierDiscoveryMetadata {
  const availableForms = input.items
    .map((item) => item.pdfForm)
    .filter(
      (form): form is DiscoveryPdfForm =>
        Boolean(form && form.status === "published" && form.active),
    );
  const codeDocuments = dossier?.documents ?? [];
  const documentTitles =
    codeDocuments.length > 0
      ? codeDocuments.map((document) => document.title)
      : availableForms.map((form) => form.title);
  const documentSlugs =
    codeDocuments.length > 0
      ? codeDocuments.map((document) => document.slug)
      : availableForms.map((form) => form.slug);
  const documentIssuers =
    codeDocuments.length > 0
      ? codeDocuments.map((document) => document.issuer)
      : availableForms.map((form) => form.issuer);

  const requiredDocuments = unique([
    ...parseStringArray(input.requiredDocuments),
    ...documentTitles,
  ]);
  const vocabularyTags = unique([
    ...parseStringArray(input.vocabularyTags),
    ...(dossier?.vocabularyTags ?? []),
    ...documentTitles,
    ...documentSlugs,
    ...documentIssuers,
  ]);
  const preferredCodeIssuer = codeDocuments.find(
    (document) =>
      !document.responsibility || document.responsibility === "user",
  )?.issuer;

  return {
    organism:
      input.organism ?? preferredCodeIssuer ?? availableForms[0]?.issuer ?? null,
    vocabularyTags,
    requiredDocuments,
    documentCount: unique(documentSlugs).length,
  };
}
