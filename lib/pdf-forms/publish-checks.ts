import { AcroFieldRaw, PdfFormField, Locale, loc } from "./types";
import type { MappingRule } from "./bindings/types";
import { anchoredRegex } from "./validation";
import { parseVisualFieldsDoc } from "./visual/types";
import { isDocDirtyVsMaterialized } from "./visual/validation";
import { buildMappingReport } from "./mapping-report";

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
  /// Règles serveur (bindings) applicables à ce formulaire (cf.
  /// `getRulesForSlug`). Utilisées pour le check de couverture AcroForm :
  /// un widget stampé par une règle serveur compte comme couvert, même
  /// s'il n'a aucune claim dans le schéma enrichi.
  bindingRules?: readonly MappingRule[];
}

/// Seuil au-delà duquel le pourcentage de widgets orphelins déclenche un
/// warning à la publication. 25% = tolérance raisonnable pour les templates
/// ONEM qui contiennent souvent des widgets « junk » (dates auto, en-têtes
/// de page 2 dupliqués, signature) qu'on masque intentionnellement.
///
/// Au-dessus de ce seuil, l'admin est notifié qu'il devrait passer par
/// l'onglet Mapping AcroForm pour arbitrer.
const ORPHAN_COVERAGE_WARN_THRESHOLD_PCT = 25;

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

  // Couverture AcroForm (Phase 6+10 du plan bindings-canonical-ux) :
  // warning si trop de widgets techniques sont orphelins (aucune claim
  // dans le schéma enrichi ni dans les règles serveur). On n'agrège pas
  // ici les widgets « inconnus » signalés en conflit — ce sont des
  // widgets référencés par une règle mais absents du PDF, sémantique
  // différente d'un orphelin.
  if (technical.length > 0) {
    const report = buildMappingReport(fields, technical, ctx.bindingRules ?? []);
    // On ne compte comme orphelins QUE les rangées présentes dans le
    // technicalSchema — les lignes « unknown » (widget référencé mais
    // absent) sont capturées ailleurs en conflict.
    const technicalTotal = technical.length;
    const orphanCount = report.rows.filter(
      (r) => r.status === "orphan" && r.acroType !== "unknown"
    ).length;
    if (technicalTotal > 0) {
      const pct = Math.round((orphanCount / technicalTotal) * 100);
      if (pct >= ORPHAN_COVERAGE_WARN_THRESHOLD_PCT) {
        issues.push({
          level: "warning",
          message: `Couverture AcroForm : ${orphanCount}/${technicalTotal} widget(s) orphelin(s) (${pct}%). Ouvrez l'onglet Mapping AcroForm pour les arbitrer ou les masquer.`,
        });
      }
    }
    // Conflits explicites (widget cible par plusieurs sources heterogenes,
    // OU règle qui vise un widget absent du PDF) : toujours signalés, un
    // par un, pour que l'admin sache exactement quoi corriger.
    for (const row of report.rows) {
      if (row.status !== "conflict") continue;
      if (row.acroType === "unknown") {
        issues.push({
          level: "warning",
          message: `Règle serveur cible un widget absent du PDF : « ${row.pdfFieldName} ».`,
        });
      } else {
        issues.push({
          level: "warning",
          message: `Conflit de mapping sur « ${row.pdfFieldName} » — plusieurs sources écrivent la même case.`,
        });
      }
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
