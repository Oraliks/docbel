import { AcroFieldRaw, PdfFormField, Locale, loc } from "./types";
import { anchoredRegex } from "./validation";

export interface PublishIssue {
  level: "error" | "warning";
  fieldId?: string;
  message: string;
}

/// Vérifie qu'un formulaire est publiable. Les `error` bloquent la
/// publication ; les `warning` sont informatifs.
export function checkPublishable(
  fields: PdfFormField[],
  technical: AcroFieldRaw[],
  locales: Locale[]
): PublishIssue[] {
  const issues: PublishIssue[] = [];
  const techNames = new Set(technical.map((t) => t.pdfFieldName));
  const seenIds = new Set<string>();

  if (fields.length === 0) {
    issues.push({ level: "error", message: "Le formulaire ne contient aucun champ." });
  }

  for (const f of fields) {
    // id unique
    if (seenIds.has(f.id)) {
      issues.push({ level: "error", fieldId: f.id, message: `Identifiant de champ dupliqué : ${f.id}` });
    }
    seenIds.add(f.id);

    // label FR obligatoire
    if (!loc(f.label, "fr")) {
      issues.push({ level: "error", fieldId: f.id, message: `Libellé FR manquant pour « ${f.id} ».` });
    }

    // ancre vers un champ PDF existant
    if (f.pdfFieldName && !techNames.has(f.pdfFieldName)) {
      issues.push({
        level: "error",
        fieldId: f.id,
        message: `Le champ « ${f.id} » pointe vers un champ PDF inexistant (${f.pdfFieldName}).`,
      });
    }

    // regex valide une fois ancrée
    if (f.regex && !anchoredRegex(f.regex)) {
      issues.push({ level: "error", fieldId: f.id, message: `Regex invalide sur « ${f.id} ».` });
    }

    // options présentes pour select/radio
    if ((f.type === "select" || f.type === "radio") && (!f.options || f.options.length === 0)) {
      issues.push({ level: "warning", fieldId: f.id, message: `Aucune option définie pour « ${f.id} ».` });
    }

    // visibleIf pointe vers un champ existant
    if (f.visibleIf && !fields.some((o) => o.id === f.visibleIf!.fieldId)) {
      issues.push({
        level: "error",
        fieldId: f.id,
        message: `Condition de visibilité de « ${f.id} » référence un champ inconnu (${f.visibleIf.fieldId}).`,
      });
    }

    // traductions manquantes (warning) pour les locales déclarées
    for (const lng of locales) {
      if (lng === "fr") continue;
      if (!f.label[lng]) {
        issues.push({ level: "warning", fieldId: f.id, message: `Libellé ${lng.toUpperCase()} manquant pour « ${f.id} ».` });
      }
    }
  }

  // Champs PDF requis non couverts par le schéma enrichi
  const enrichedNames = new Set(fields.map((f) => f.pdfFieldName));
  for (const t of technical) {
    if (t.required && !enrichedNames.has(t.pdfFieldName)) {
      issues.push({
        level: "warning",
        message: `Le champ PDF requis « ${t.pdfFieldName} » n'est pas exposé dans le formulaire.`,
      });
    }
  }

  return issues;
}

export function hasBlockingIssues(issues: PublishIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}
