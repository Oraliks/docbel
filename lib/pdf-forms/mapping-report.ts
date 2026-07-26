// Rapport de mapping AcroForm — Phase 6 du plan bindings-canonical-ux.
//
// Fonction PURE : à partir du schéma technique brut (AcroFieldRaw[]), du
// schéma enrichi (PdfFormField[]) et des règles de bindings serveur
// (MappingRule[]) déclarées pour le formulaire, produit une vue « widget par
// widget » qui indique QUI le stampe, PAR QUEL mécanisme, et signale les
// widgets orphelins (aucune claim) ou en conflit (2+ sources différentes).
//
// Consommé par l'onglet admin « Mapping AcroForm » (§6.2 du plan). Isolé
// pour rester testable indépendamment de tout rendu React.

import type { AcroFieldRaw, PdfFormField } from "./types";
import type { MappingRule } from "./bindings/types";

/// Origine d'une claim sur un widget donné.
///   - "field"          : `PdfFormField.pdfFieldName` direct (1 widget).
///   - "pipe-option"    : une option d'un radio pipe-séparé
///                        ("w1|w2|w3") — 1 claim par segment.
///   - "array-template" : `pdfFieldNameTemplate` d'un sous-champ `array`,
///                        étendu 1..maxRows.
///   - "first-match"    : `firstMatchMapping.fields[subId]` d'un `array`.
///   - "rule"           : `StampEntry.widget` d'une `MappingRule`
///                        déclarative (statique OU déclarée via
///                        `declaredWidgets` pour un `stampFn`).
export type WidgetClaimSource =
  | "field"
  | "pipe-option"
  | "array-template"
  | "first-match"
  | "rule";

export interface WidgetClaim {
  /// Le champ porteur est `hidden` : il ne sera jamais rendu NI stampe.
  hidden?: boolean;
  source: WidgetClaimSource;
  /// ID côté schéma enrichi (PdfFormField.id) — vide pour les claims
  /// d'origine "rule" (elles n'ont pas de champ, elles ont un nom de règle).
  fieldId?: string;
  /// Libellé (FR par défaut, on prend la clé fr du Localized) pour affichage
  /// admin — évite au consommateur de reconstruire le loc côté UI.
  fieldLabel?: string;
  /// Nom de la règle (uniquement pour source="rule").
  ruleName?: string;
  /// Détail contextuel : option value pour pipe-option, index pour
  /// array-template, sous-champ pour first-match.
  detail?: string;
}

/// `hidden` : un champ revendique bien ce widget, mais il est `hidden` — le
/// filler le saute (cf. filler.ts), donc la case part VIERGE sur le document
/// officiel. Distinct de `orphan` (aucune revendication) : le remede n'est pas
/// le meme, et l'action « creer un champ pour chaque orphelin » de l'admin en
/// creerait un SECOND par-dessus celui qui existe deja.
export type WidgetStatus = "bound" | "hidden" | "orphan" | "conflict";

export interface WidgetReportRow {
  pdfFieldName: string;
  acroType: AcroFieldRaw["acroType"];
  page?: number;
  rect?: AcroFieldRaw["rect"];
  maxLen?: number;
  claims: WidgetClaim[];
  status: WidgetStatus;
}

export interface MappingReportSummary {
  total: number;
  bound: number;
  /// Revendiques uniquement par des champs masques → jamais ecrits.
  hidden: number;
  orphan: number;
  conflict: number;
}

export interface MappingReport {
  rows: WidgetReportRow[];
  summary: MappingReportSummary;
}

// ---------------------------------------------------------------------------
// Extraction des claims par champ enrichi.
// ---------------------------------------------------------------------------

/// Étend un template positionnel "{index} 1" en "1 1","2 1",…,"N 1".
function expandTemplate(tpl: string, maxRows: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= maxRows; i++) out.push(tpl.replace(/\{index\}/g, String(i)));
  return out;
}

function labelOf(f: PdfFormField): string | undefined {
  return f.label?.fr || f.label?.nl || f.label?.de;
}

/// Ajoute une claim à `claimsByWidget` (Map widget → claims).
function addClaim(
  claimsByWidget: Map<string, WidgetClaim[]>,
  widget: string,
  claim: WidgetClaim
): void {
  if (!widget) return;
  const arr = claimsByWidget.get(widget);
  if (arr) arr.push(claim);
  else claimsByWidget.set(widget, [claim]);
}

function collectFieldClaims(
  fields: readonly PdfFormField[],
  claimsByWidget: Map<string, WidgetClaim[]>
): void {
  for (const f of fields) {
    // Champ `array` : templates par sous-champ + firstMatchMapping. Le
    // `pdfFieldName` du parent est en général vide (les sous-champs
    // portent le mapping).
    if (f.type === "array") {
      const maxRows = typeof f.maxRows === "number" ? Math.max(0, f.maxRows) : 5;
      for (const sub of f.itemFields ?? []) {
        if (sub.pdfFieldNameTemplate) {
          const widgets = expandTemplate(sub.pdfFieldNameTemplate, maxRows);
          for (let i = 0; i < widgets.length; i++) {
            addClaim(claimsByWidget, widgets[i], {
              source: "array-template",
              hidden: f.hidden === true,
              fieldId: `${f.id}.${sub.id}`,
              fieldLabel: labelOf(sub),
              detail: `ligne ${i + 1}`,
            });
          }
        }
      }
      const fm = f.firstMatchMapping;
      if (fm) {
        for (const [subId, widgetName] of Object.entries(fm.fields)) {
          const sub = (f.itemFields ?? []).find((s) => s.id === subId);
          // Convention pipe (radio) sur first-match : chaque segment = 1 widget.
          for (const seg of widgetName.split("|")) {
            const s = seg.trim();
            if (!s) continue;
            addClaim(claimsByWidget, s, {
              source: "first-match",
              hidden: f.hidden === true,
              fieldId: `${f.id}.${subId}`,
              fieldLabel: sub ? labelOf(sub) : undefined,
              detail: `${fm.where.fieldId}=${String(fm.where.value)}`,
            });
          }
        }
      }
      continue;
    }

    if (!f.pdfFieldName) continue;
    // Champ scalaire : soit widget unique, soit pipe (radio N-options).
    if (f.pdfFieldName.includes("|")) {
      const segments = f.pdfFieldName.split("|");
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i].trim();
        if (!s) continue;
        const optValue = f.options?.[i]?.value;
        addClaim(claimsByWidget, s, {
          source: "pipe-option",
          hidden: f.hidden === true,
          fieldId: f.id,
          fieldLabel: labelOf(f),
          detail: optValue ? `option ${optValue}` : `option ${i + 1}`,
        });
      }
    } else {
      addClaim(claimsByWidget, f.pdfFieldName, {
        source: "field",
        hidden: f.hidden === true,
        fieldId: f.id,
        fieldLabel: labelOf(f),
      });
    }
  }
}

function collectRuleClaims(
  rules: readonly MappingRule[],
  claimsByWidget: Map<string, WidgetClaim[]>
): void {
  for (const rule of rules) {
    // stamp statique → chaque widget est traçable au parseur.
    for (const s of rule.stamp ?? []) {
      addClaim(claimsByWidget, s.widget, {
        source: "rule",
        ruleName: rule.name,
        detail: typeof s.value === "boolean" ? "checkbox" : "text",
      });
    }
    // stampFn : on ne peut pas exécuter la fonction sans payload — on lit
    // `declaredWidgets` fournis par l'auteur de la règle. Les règles qui
    // n'en déclarent pas sont invisibles pour ce rapport (accepté).
    for (const w of rule.declaredWidgets ?? []) {
      addClaim(claimsByWidget, w, {
        source: "rule",
        ruleName: rule.name,
        detail: "stampFn",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Statut d'une ligne.
// ---------------------------------------------------------------------------

/// Sources qui écrivent une VALEUR TEXTE (potentiellement en conflit sur un
/// même widget). Les sources `pipe-option` et `first-match` produisent des
/// checkboxes coché/décoché à partir d'un radio → cohabitation OK sur le
/// même widget (une seule case cochée par sélection, les autres décochées).
const TEXT_SOURCES: Set<WidgetClaimSource> = new Set(["field", "array-template"]);

function statusOf(
  acroType: AcroFieldRaw["acroType"],
  claims: WidgetClaim[]
): WidgetStatus {
  if (claims.length === 0) return "orphan";
  // Revendique UNIQUEMENT par des champs masques : le filler saute ces champs,
  // la case part vierge. Le rapport le disait « couvert » — c'etait le seul
  // endroit ou l'on pouvait s'en rendre compte, et il affirmait le contraire.
  if (claims.every((c) => c.hidden === true)) return "hidden";
  // Conflit détecté seulement sur les widgets TEXTE dont 2+ sources
  // hétérogènes écrivent SANS coordination (ex. un champ direct + un
  // template de ligne = collision explicite). Pour un checkbox, plusieurs
  // pipes/first-match sur le même widget = comportement voulu.
  if (acroType === "text") {
    // On compte les REVENDICATIONS, pas les sources distinctes : deux champs
    // visant la meme case texte ne formaient qu'une source (`field`) et
    // passaient donc pour « couverts ». Le filler ecrit le dernier, en
    // silence, et l'autre valeur disparait du document officiel.
    const ecritures = claims.filter((c) => TEXT_SOURCES.has(c.source));
    if (ecritures.length >= 2) return "conflict";
    const sources = new Set(ecritures.map((c) => c.source));
    // Deux règles peuvent cibler le même widget légitimement (dernier
    // gagnant du resolveStamps) → pas de conflit. Une règle + un champ
    // texte scalaire = conflit potentiel (la règle "override" écrase
    // silencieusement le champ) — on flag pour visibilité admin.
    if (sources.has("field") && claims.some((c) => c.source === "rule")) {
      return "conflict";
    }
  }
  return "bound";
}

// ---------------------------------------------------------------------------
// Point d'entrée.
// ---------------------------------------------------------------------------

/// Construit le rapport de mapping.
export function buildMappingReport(
  fields: readonly PdfFormField[],
  technicalSchema: readonly AcroFieldRaw[],
  rules: readonly MappingRule[] = []
): MappingReport {
  const claimsByWidget = new Map<string, WidgetClaim[]>();
  collectFieldClaims(fields, claimsByWidget);
  collectRuleClaims(rules, claimsByWidget);

  const seenTechnical = new Set<string>();
  const rows: WidgetReportRow[] = [];

  for (const t of technicalSchema) {
    seenTechnical.add(t.pdfFieldName);
    const claims = claimsByWidget.get(t.pdfFieldName) ?? [];
    rows.push({
      pdfFieldName: t.pdfFieldName,
      acroType: t.acroType,
      page: t.page,
      rect: t.rect,
      maxLen: t.maxLen,
      claims,
      status: statusOf(t.acroType, claims),
    });
  }

  // Claims qui référencent un widget NON présent dans le technicalSchema
  // (ex. règle qui vise un widget mal orthographié). Émis comme lignes de
  // type "unknown" avec status "conflict" pour visibilité — 0 rect / 0 page.
  for (const [widget, claims] of claimsByWidget) {
    if (seenTechnical.has(widget)) continue;
    rows.push({
      pdfFieldName: widget,
      acroType: "unknown",
      claims,
      // Un widget référencé mais absent du PDF est un problème plus grave
      // qu'un orphelin : on le flag en "conflict" (rouge) pour attirer
      // l'attention (le stamp échouera silencieusement à runtime).
      status: "conflict",
    });
  }

  // Tri stable : conflits en premier, puis orphelins, puis liés — par
  // pdfFieldName au sein d'un même statut. Facilite le triage admin.
  const order: Record<WidgetStatus, number> = { conflict: 0, orphan: 1, hidden: 2, bound: 3 };
  rows.sort((a, b) => {
    const s = order[a.status] - order[b.status];
    return s !== 0 ? s : a.pdfFieldName.localeCompare(b.pdfFieldName);
  });

  const summary: MappingReportSummary = {
    total: rows.length,
    bound: rows.filter((r) => r.status === "bound").length,
    hidden: rows.filter((r) => r.status === "hidden").length,
    orphan: rows.filter((r) => r.status === "orphan").length,
    conflict: rows.filter((r) => r.status === "conflict").length,
  };

  return { rows, summary };
}
