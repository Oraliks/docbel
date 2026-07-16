"use client";

import {
  MapPinIcon,
  UsersIcon,
  IdCardIcon,
  LandmarkIcon,
  Building2Icon,
  CheckIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Field, FieldLegend, FieldSet } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { PdfField } from "./pdf-field";
import { loc, Locale, FieldValue } from "@/lib/pdf-forms/types";
import type { PublicField } from "@/lib/pdf-forms/public-serializer";
import type { FormPayload } from "@/lib/pdf-forms/types";

/// Icône du motif par champ — composant volontairement
/// spécifique à l'étape Motif du C1 changement-situation (pas un mécanisme
/// générique : les 5 champs et leur habillage sont propres à ce dossier).
const ROW_META: Record<string, { icon: LucideIcon }> = {
  modificationAdresse: { icon: MapPinIcon },
  modificationSituationFamiliale: { icon: UsersIcon },
  modificationPermisSejour: { icon: IdCardIcon },
  modificationCompte: { icon: LandmarkIcon },
  transfereOrganismePaiement: { icon: Building2Icon },
};

interface Props {
  fields: PublicField[];
  values: FormPayload;
  errors: Record<string, string>;
  locale: Locale;
  setValue: (id: string, value: FieldValue) => void;
  formId: string;
  formSlug: string;
}

/// Étape "Motif" du C1 changement-situation : liste des 5 situations à
/// cocher (multi-sélection préservée) façon liste avec icône, et
/// un panneau "Détails" pour les questions complémentaires (dates
/// conditionnelles) — cf. mockup Oraliks, 2026-07-07.
export function MotifSituationPicker({ fields, values, errors, locale, setValue, formId, formSlug }: Props) {
  const t = useTranslations("public.dossier");

  const listFields = fields.filter((f) => f.id in ROW_META);
  const detailFields = fields.filter((f) => !(f.id in ROW_META));
  // Erreur de la contrainte "au moins une situation" (cf. requiredGroup).
  const groupErrors = [...new Set(listFields.filter((f) => f.requiredGroup).map((f) => errors[f.id]).filter(Boolean))];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      {/* Colonne Motif : coche, icône puis libellé sur chaque ligne */}
      <FieldSet className="gap-0 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4 sm:p-5">
        <FieldLegend
          variant="label"
          className="mb-0 w-full border-b border-[color:var(--glass-border)] pb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-faint)]"
        >
          {t("runnerMotifColumnMotif")}
        </FieldLegend>
        <div data-slot="checkbox-group" className="divide-y divide-[color:var(--glass-border)]">
          {listFields.map((f) => {
            const meta = ROW_META[f.id];
            const Icon = meta.icon;
            const selected = values[f.id] === true;
            const label = loc(f.label, locale);
            return (
              <Field key={f.id} orientation="horizontal" className="gap-0">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  aria-invalid={Boolean(errors[f.id])}
                  onClick={() => setValue(f.id, !selected)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    selected && "bg-[color:var(--glass-pop-bg)]",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      selected
                        ? "border-[color:var(--glass-accent-deep,#5B46E5)] bg-[color:var(--glass-accent-deep,#5B46E5)] text-white"
                        : "border-[color:var(--glass-ink-faint)]",
                    )}
                  >
                    {selected && <CheckIcon className="size-3" strokeWidth={3} />}
                  </span>
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep,#5B46E5)]"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] font-medium text-[color:var(--glass-ink)]">
                    {label}
                  </span>
                </button>
              </Field>
            );
          })}
        </div>
        {groupErrors.map((msg) => (
          <p key={msg} role="alert" className="mt-2 text-sm font-normal text-destructive">
            {msg}
          </p>
        ))}
      </FieldSet>

      {/* Colonne Détails */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4 sm:p-5">
        <h3 className="text-[15px] font-bold text-[color:var(--glass-ink)]">{t("runnerMotifDetailsTitle")}</h3>
        {detailFields.map((f) => (
          <PdfField
            key={f.id}
            field={f}
            value={values[f.id] ?? ""}
            error={errors[f.id]}
            locale={locale}
            onChange={(v) => setValue(f.id, v)}
            formId={formId}
            formSlug={formSlug}
          />
        ))}
      </div>
    </div>
  );
}
