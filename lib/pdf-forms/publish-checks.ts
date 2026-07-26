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

    // Convention pipe : autant de segments que d'options, sinon le stamping
    // ABANDONNE en silence. `stampPipeRadio` exige l'égalité stricte ; à
    // défaut il rend la main, le repli scalaire cherche un widget nommé
    // « a|b|c » qui n'existe pas, et l'exception est avalée. Résultat : aucune
    // case cochée, aucun log, un document officiel qui part vierge sur cette
    // rubrique. Aucun formulaire n'est en défaut aujourd'hui — ce contrôle est
    // là pour que ça ne PUISSE pas arriver au prochain.
    // Volontairement PAS conditionné à `f.type === "radio"` : c'est justement
    // en basculant un champ pipe vers `select` depuis l'admin qu'on désactivait
    // toute la question. `stampPipeRadio` ne traite que les `radio` ; un pipe
    // sur un autre type ne coche donc jamais rien, en silence.
    if (f.pdfFieldName.includes("|") && f.options) {
      if (f.type !== "radio") {
        issues.push({
          level: "error",
          fieldId: f.id,
          message: `Le champ « ${f.id} » utilise la convention pipe (plusieurs cases PDF) mais n'est pas de type radio : rien ne serait coché.`,
        });
      }
      const segments = f.pdfFieldName.split("|").length;
      if (segments !== f.options.length) {
        issues.push({
          level: "error",
          fieldId: f.id,
          message: `Le champ « ${f.id} » déclare ${segments} case(s) PDF pour ${f.options.length} option(s) : rien ne serait coché. Utilise une entrée vide pour une option sans case.`,
        });
      }
    }

    // Les ancres des champs `array` — jamais vérifiées jusqu'ici, alors qu'une
    // seule faute de frappe y rend CINQ cases blanches (une par ligne de la
    // grille cohabitants), publication acceptée et génération muette.
    if (f.type === "array") {
      const rows = typeof f.maxRows === "number" ? Math.max(1, f.maxRows) : 5;
      for (const sub of f.itemFields ?? []) {
        // Template positionnel : on contrôle chaque ligne, car rien ne garantit
        // que le PDF numérote ses widgets sans trou.
        if (sub.pdfFieldNameTemplate) {
          const absents: string[] = [];
          for (let i = 1; i <= rows; i++) {
            const name = sub.pdfFieldNameTemplate.replace(/\{index\}/g, String(i));
            for (const part of name.split("|").map((s) => s.trim()).filter(Boolean)) {
              if (!techNames.has(part)) absents.push(part);
            }
          }
          if (absents.length > 0) {
            issues.push({
              level: "error",
              fieldId: `${f.id}.${sub.id}`,
              message: `La colonne « ${sub.id} » de « ${f.id} » pointe vers ${absents.length} champ(s) PDF inexistant(s) (${absents.slice(0, 3).join(", ")}${absents.length > 3 ? "…" : ""}).`,
            });
          }
        }
        if (sub.pdfFieldName) {
          const absents = sub.pdfFieldName
            .split("|")
            .map((s) => s.trim())
            .filter((p) => p && !techNames.has(p));
          if (absents.length > 0) {
            issues.push({
              level: "error",
              fieldId: `${f.id}.${sub.id}`,
              message: `La colonne « ${sub.id} » de « ${f.id} » pointe vers un champ PDF inexistant (${absents.join(", ")}).`,
            });
          }
        }
      }
      // Widgets uniques alimentés par la première ligne satisfaisant `where`.
      for (const [subId, widget] of Object.entries(f.firstMatchMapping?.fields ?? {})) {
        const absents = String(widget)
          .split("|")
          .map((s) => s.trim())
          .filter((p) => p && !techNames.has(p));
        if (absents.length > 0) {
          issues.push({
            level: "error",
            fieldId: `${f.id}.${subId}`,
            message: `Le report de « ${subId} » (${f.id}) pointe vers un champ PDF inexistant (${absents.join(", ")}).`,
          });
        }
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
        level: "error",
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
    // Widgets revendiqués UNIQUEMENT par des champs masqués : le filler saute
    // les champs `hidden`, donc ces cases partent vierges sur le document
    // officiel. Le rapport les comptait « couverts » — c'était le seul endroit
    // où on pouvait le voir, et il affirmait le contraire. Avertissement et
    // non erreur : masquer un champ est parfois délibéré (rubrique hors
    // périmètre d'un dossier), mais l'admin doit le savoir.
    const masques = report.rows.filter((r) => r.status === "hidden");
    if (masques.length > 0) {
      issues.push({
        level: "warning",
        message: `${masques.length} widget(s) ne seront jamais remplis : leur seul champ est masqué — ${masques
          .slice(0, 5)
          .map((r) => `« ${r.pdfFieldName} »`)
          .join(", ")}${masques.length > 5 ? `, +${masques.length - 5}` : ""}.`,
      });
    }

    // Conflits explicites (widget cible par plusieurs sources heterogenes,
    // OU règle qui vise un widget absent du PDF) : toujours signalés, un
    // par un, pour que l'admin sache exactement quoi corriger.
    for (const row of report.rows) {
      if (row.status !== "conflict") continue;
      if (row.acroType === "unknown") {
        // Une ancre de champ absente est déjà signalée plus haut avec son
        // identifiant. Ne la présenter comme une erreur de règle serveur que
        // lorsqu'une règle est réellement concernée.
        if (!row.claims.some((claim) => claim.source === "rule")) continue;
        issues.push({
          level: "error",
          message: `Règle serveur cible un widget absent du PDF : « ${row.pdfFieldName} ».`,
        });
      } else {
        issues.push({
          level: "error",
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
          level: "error",
          message: `${vdoc.fields.length} champ(s) visuel(s) en brouillon — cliquez sur « Appliquer au PDF » pour les matérialiser.`,
        });
      } else if (isDocDirtyVsMaterialized(vdoc)) {
        issues.push({
          level: "error",
          message: `Le brouillon visuel diffère du dernier PDF matérialisé — re-matérialisez pour synchroniser.`,
        });
      } else if (updAt && updAt.getTime() > matAt.getTime() + 1000) {
        issues.push({
          level: "error",
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
