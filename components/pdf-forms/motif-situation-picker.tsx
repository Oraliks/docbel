"use client";

import {
  MapPinIcon,
  UsersIcon,
  IdCardIcon,
  LandmarkIcon,
  Building2Icon,
  GraduationCapIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { PdfField } from "./pdf-field";
import { loc, Locale, FieldValue } from "@/lib/pdf-forms/types";
import type { PublicField } from "@/lib/pdf-forms/public-serializer";
import type { FormPayload } from "@/lib/pdf-forms/types";

/// Icône + clé i18n du badge "Type" par champ — composant volontairement
/// spécifique à l'étape Motif du C1 changement-situation (pas un mécanisme
/// générique : les 6 champs et leur habillage sont propres à ce dossier).
const ROW_META: Record<string, { icon: LucideIcon; badgeKey: string }> = {
  modificationAdresse: { icon: MapPinIcon, badgeKey: "runnerMotifBadgeAdresse" },
  modificationSituationFamiliale: { icon: UsersIcon, badgeKey: "runnerMotifBadgeSituation" },
  modificationPermisSejour: { icon: IdCardIcon, badgeKey: "runnerMotifBadgePermis" },
  modificationCompte: { icon: LandmarkIcon, badgeKey: "runnerMotifBadgePaiements" },
  transfereOrganismePaiement: { icon: Building2Icon, badgeKey: "runnerMotifBadgeTransfert" },
  chomeurTemporaireAlternance: { icon: GraduationCapIcon, badgeKey: "runnerMotifBadgeFormation" },
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

/// Étape "Motif" du C1 changement-situation : liste des 6 motifs (5 situations
/// à cocher, multi-sélection préservée + la question chômeur temporaire en
/// alternance) façon tableau avec badge de type, et un panneau "Détails" pour
/// les questions complémentaires (chômeur temporaire alternance, dates
/// conditionnelles) — cf. mockup Oraliks, 2026-07-07.
export function MotifSituationPicker({ fields, values, errors, locale, setValue, formId, formSlug }: Props) {
  const t = useTranslations("public.dossier");

  const listFields = fields.filter((f) => f.id in ROW_META);
  const chomeurField = fields.find((f) => f.id === "chomeurTemporaireAlternance");
  const detailFields = fields.filter((f) => !(f.id in ROW_META));
  // Erreur de la contrainte "au moins une situation" (cf. requiredGroup) —
  // jamais celle de chomeurTemporaireAlternance (déjà affichée via son
  // propre PdfField dans le panneau Détails, pas la peine de la dupliquer.
  const groupErrors = [...new Set(listFields.filter((f) => f.requiredGroup).map((f) => errors[f.id]).filter(Boolean))];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      {/* Colonne Motif : tableau des 6 lignes */}
      <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4 sm:p-5">
        <div className="flex items-center justify-between border-b border-[color:var(--glass-border)] pb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-faint)]">
          <span>{t("runnerMotifColumnMotif")}</span>
          <span>{t("runnerMotifColumnType")}</span>
        </div>
        <div className="divide-y divide-[color:var(--glass-border)]">
          {listFields.map((f) => {
            const meta = ROW_META[f.id];
            const Icon = meta.icon;
            const isChomeur = f.id === "chomeurTemporaireAlternance";
            // La vraie réponse oui/non de "chomeur temporaire alternance" vit
            // dans le panneau Détails (question fermée, pas un simple "coché
            // si applicable") — cette ligne reflète juste son état courant.
            const selected = isChomeur ? values[f.id] === "oui" : values[f.id] === true;
            return (
              <button
                key={f.id}
                type="button"
                disabled={isChomeur}
                onClick={() => {
                  if (!isChomeur) setValue(f.id, values[f.id] !== true);
                }}
                className="flex w-full items-center gap-3 py-3 text-left disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    selected ? "border-[color:var(--glass-accent-deep,#5B46E5)]" : "border-[color:var(--glass-border)]"
                  }`}
                >
                  {selected && <span className="size-2 rounded-full bg-[color:var(--glass-accent-deep,#5B46E5)]" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[color:var(--glass-ink)]">
                  {loc(f.label, locale)}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--glass-pop-bg)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--glass-accent-deep,#5B46E5)]">
                  <Icon className="size-3.5" aria-hidden />
                  {t(meta.badgeKey as Parameters<typeof t>[0])}
                </span>
              </button>
            );
          })}
        </div>
        {groupErrors.map((msg) => (
          <p key={msg} role="alert" className="mt-2 text-sm font-normal text-destructive">
            {msg}
          </p>
        ))}
      </div>

      {/* Colonne Détails */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4 sm:p-5">
        <h3 className="text-[15px] font-bold text-[color:var(--glass-ink)]">{t("runnerMotifDetailsTitle")}</h3>
        {chomeurField && (
          <PdfField
            field={chomeurField}
            value={values[chomeurField.id] ?? ""}
            error={errors[chomeurField.id]}
            locale={locale}
            onChange={(v) => setValue(chomeurField.id, v)}
            formId={formId}
            formSlug={formSlug}
          />
        )}
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
