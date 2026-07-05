// Construction pure des étapes du form-runner : regroupement par section
// (global, pas seulement consécutif — cf. commentaire historique dans
// pdf-form-runner.tsx), puis séparation core (étapes séquentielles
// obligatoires) vs optional (bloc replié en fin de parcours, sauf si déjà
// répondu). Aucune dépendance React : testable en isolation.

import { isFieldVisible } from "./validation";
import { sectionLabel } from "./section-labels";
import { isAutoField } from "./auto-fields";
import type { FormPayload, Locale } from "./types";
import type { PublicField } from "./public-serializer";

export interface CoreStep {
  kind: "fields";
  id: string;
  title: string;
  subtitle: string;
  fields: PublicField[];
}

export interface OptionalSection {
  key: string;
  title: string;
  fields: PublicField[];
  defaultOpen: boolean;
}

export interface BuildStepsResult {
  coreSteps: CoreStep[];
  optionalSections: OptionalSection[];
}

export interface BuildStepsLabels {
  fallbackTitle: string;
  fallbackSubtitle: string;
}

function hasAnyValue(fields: PublicField[], values: FormPayload): boolean {
  return fields.some((f) => {
    const v = values[f.id];
    if (v === undefined || v === null) return false;
    if (typeof v === "string") return v.trim() !== "";
    if (typeof v === "boolean") return v === true;
    return true;
  });
}

export function buildSteps(
  fields: PublicField[],
  values: FormPayload,
  locale: Locale,
  labels: BuildStepsLabels
): BuildStepsResult {
  const visible = fields.filter((f) => isFieldVisible(f.visibleIf, values) && !isAutoField(f));

  const groups: Array<{ key: string | undefined; fields: PublicField[] }> = [];
  const groupIndexByKey = new Map<string | undefined, number>();
  for (const f of visible) {
    const idx = groupIndexByKey.get(f.section);
    if (idx !== undefined) groups[idx].fields.push(f);
    else {
      groupIndexByKey.set(f.section, groups.length);
      groups.push({ key: f.section, fields: [f] });
    }
  }

  const coreSteps: CoreStep[] = [];
  const optionalSections: OptionalSection[] = [];

  groups.forEach((g, i) => {
    const isOptional = g.fields[0]?.stepPriority === "optional";
    const title = g.key ? sectionLabel(g.key, locale) : labels.fallbackTitle;
    if (isOptional && g.key) {
      optionalSections.push({
        key: g.key,
        title,
        fields: g.fields,
        defaultOpen: hasAnyValue(g.fields, values),
      });
    } else {
      coreSteps.push({
        kind: "fields",
        id: g.key ?? `section-${i}`,
        title,
        subtitle: labels.fallbackSubtitle,
        fields: g.fields,
      });
    }
  });

  return { coreSteps, optionalSections };
}

// ---------------------------------------------------------------------------
// Mode « macro-étapes » : regroupe plusieurs sections en un nombre restreint
// d'étapes (ex. C1 → 5 étapes), piloté par la propriété `stepGroup` des
// champs (posée en amont, cf. applyC1Improvements). Opt-in : si aucun champ
// n'a de `stepGroup`, `buildMacroSteps` renvoie null et le caller retombe sur
// `buildSteps` classique. Pas d'optional-collapse ni d'étape résumé ici.
// ---------------------------------------------------------------------------

export interface MacroStepSection {
  /// Clé de section (pour le sous-titre via sectionLabel). `undefined` = pas
  /// de section (rare en pratique, les champs sans section vont dans `advanced`).
  key: string | undefined;
  fields: PublicField[];
}

export interface MacroStep {
  /// Identifiant du groupe (valeur de `stepGroup` : "motif", "identite", …).
  id: string;
  /// Sous-sections de la macro-étape (sous-titres si plusieurs).
  sections: MacroStepSection[];
  /// Champs sans `stepGroup` (long-tail inféré non curé) — rattachés à la
  /// DERNIÈRE macro-étape uniquement, rendus dans un accordéon replié.
  advanced: PublicField[];
}

/// Ordre canonique des macro-étapes du C1 (les groupes hors de cette liste
/// sont ajoutés après, par ordre de première apparition). L'ordre des champs
/// dans le PDF ne correspond pas au parcours voulu (identité en tête sur le
/// papier), d'où cet ordre explicite.
const MACRO_STEP_ORDER = ["motif", "identite", "activites-revenus", "famille", "final"];

/// Construit les macro-étapes à partir de `stepGroup`. Renvoie null si aucun
/// champ visible ne porte de `stepGroup` (→ formulaire non-macro, comportement
/// classique). L'ordre des macro-étapes suit la PREMIÈRE apparition de chaque
/// `stepGroup` dans l'ordre des champs.
export function buildMacroSteps(
  fields: PublicField[],
  values: FormPayload
): MacroStep[] | null {
  const visible = fields.filter((f) => isFieldVisible(f.visibleIf, values) && !isAutoField(f));
  const hasGroup = visible.some((f) => f.stepGroup);
  if (!hasGroup) return null;

  // Ordre des groupes : ordre canonique d'abord (MACRO_STEP_ORDER), puis les
  // éventuels groupes hors-liste par première apparition. Ne garde que les
  // groupes réellement présents parmi les champs visibles.
  const present: string[] = [];
  const seen = new Set<string>();
  for (const f of visible) {
    if (f.stepGroup && !seen.has(f.stepGroup)) {
      seen.add(f.stepGroup);
      present.push(f.stepGroup);
    }
  }
  const order = [
    ...MACRO_STEP_ORDER.filter((g) => seen.has(g)),
    ...present.filter((g) => !MACRO_STEP_ORDER.includes(g)),
  ];

  const steps: MacroStep[] = order.map((id) => {
    const groupFields = visible.filter((f) => f.stepGroup === id);
    // Sous-groupe par section (première apparition), comme buildSteps.
    const secs: MacroStepSection[] = [];
    const secIdx = new Map<string | undefined, number>();
    for (const f of groupFields) {
      const idx = secIdx.get(f.section);
      if (idx !== undefined) secs[idx].fields.push(f);
      else {
        secIdx.set(f.section, secs.length);
        secs.push({ key: f.section, fields: [f] });
      }
    }
    return { id, sections: secs, advanced: [] };
  });

  // Champs sans stepGroup → « Autres informations » sur la dernière étape.
  const ungrouped = visible.filter((f) => !f.stepGroup);
  if (ungrouped.length > 0 && steps.length > 0) {
    steps[steps.length - 1].advanced = ungrouped;
  }

  return steps;
}
