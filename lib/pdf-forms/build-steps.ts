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
