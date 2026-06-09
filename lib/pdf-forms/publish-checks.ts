import { AcroFieldRaw, PdfFormField, Locale, loc } from "./types";
import { anchoredRegex } from "./validation";
import { parseVisualFieldsDoc } from "./visual/types";
import { isDocDirtyVsMaterialized } from "./visual/validation";

export interface PublishIssue {
  level: "error" | "warning";
  fieldId?: string;
  message: string;
}

export interface PublishContext {
  /// Wrapper VisualFieldsDoc lu depuis PdfForm.visualFields (Json).
  visualFieldsRaw?: unknown;
  /// Date de dernière matérialisation (ISO ou Date) — null si jamais.
  visualFieldsMaterializedAt?: Date | string | null;
  /// Date de dernière sauvegarde du form (updatedAt). Sert à détecter une
  /// matérialisation antérieure à la dernière édition visuelle.
  updatedAt?: Date | string;
}

/// Vérifie qu'un formulaire est publiable. Les `error` bloquent la
/// publication ; les `warning` sont informatifs.
export function checkPublishable(
  fields: PdfFormField[],
  technical: AcroFieldRaw[],
  locales: Locale[],
  ctx: PublishContext = {}
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

    // ancre vers un champ PDF existant. Convention : `pdfFieldName` peut être
    // pipe-séparé (ex. "oui_8|non_8") pour cibler une paire de checkboxes —
    // chaque partie doit alors exister dans le schéma technique.
    if (f.pdfFieldName) {
      const parts = f.pdfFieldName.includes("|")
        ? f.pdfFieldName.split("|").map((s) => s.trim()).filter(Boolean)
        : [f.pdfFieldName];
      const missing = parts.filter((p) => !techNames.has(p));
      if (missing.length > 0) {
        issues.push({
          level: "error",
          fieldId: f.id,
          message: `Le champ « ${f.id} » pointe vers un champ PDF inexistant (${missing.join(", ")}).`,
        });
      }
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

  // Champs PDF requis non couverts par le schéma enrichi. On éclate les
  // ancres pipe-séparées pour qu'une paire `oui_N|non_N` couvre bien chaque
  // widget individuel.
  const enrichedNames = new Set<string | undefined>();
  for (const f of fields) {
    if (!f.pdfFieldName) continue;
    if (f.pdfFieldName.includes("|")) {
      for (const p of f.pdfFieldName.split("|").map((s) => s.trim()).filter(Boolean)) {
        enrichedNames.add(p);
      }
    } else {
      enrichedNames.add(f.pdfFieldName);
    }
  }
  for (const t of technical) {
    if (t.required && !enrichedNames.has(t.pdfFieldName)) {
      issues.push({
        level: "warning",
        message: `Le champ PDF requis « ${t.pdfFieldName} » n'est pas exposé dans le formulaire.`,
      });
    }
  }

  // Éditeur visuel : champs en attente de matérialisation.
  if (ctx.visualFieldsRaw !== undefined) {
    const vdoc = parseVisualFieldsDoc(ctx.visualFieldsRaw);
    if (vdoc.fields.length > 0) {
      const matAt = ctx.visualFieldsMaterializedAt
        ? new Date(ctx.visualFieldsMaterializedAt)
        : null;
      const updAt = ctx.updatedAt ? new Date(ctx.updatedAt) : null;
      if (!matAt) {
        issues.push({
          level: "warning",
          message: `${vdoc.fields.length} champ(s) visuel(s) en brouillon — cliquez sur « Appliquer au PDF » pour les matérialiser.`,
        });
      } else if (isDocDirtyVsMaterialized(vdoc)) {
        issues.push({
          level: "warning",
          message: `Le brouillon visuel diffère du dernier PDF matérialisé — re-matérialisez pour synchroniser.`,
        });
      } else if (updAt && updAt.getTime() > matAt.getTime() + 1000) {
        issues.push({
          level: "warning",
          message: `Modifications visuelles sauvegardées sans matérialisation depuis le ${matAt.toLocaleString("fr-BE")}.`,
        });
      }
    }
  }

  return issues;
}

export function hasBlockingIssues(issues: PublishIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}
