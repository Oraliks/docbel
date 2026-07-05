"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { NissInput } from "@/components/ui/niss-input";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { YesNoSegmentedControl } from "@/components/ui/yes-no-segmented";
import { FieldErrorReport } from "./field-error-report";
import { ArrayField } from "./array-field";
import { loc, Locale, FieldValue, FullNameValue, isFullNameValue, FieldOption } from "@/lib/pdf-forms/types";
import type { PublicField } from "@/lib/pdf-forms/public-serializer";

// Type HTML + inputMode adaptés au type sémantique (clavier mobile pertinent).
const INPUT_HINTS: Record<string, { type?: string; inputMode?: "numeric" | "tel" | "email" | "text" }> = {
  number: { type: "number", inputMode: "numeric" },
  date: { type: "date" },
  email: { type: "email", inputMode: "email" },
  phone_be: { type: "tel", inputMode: "tel" },
  niss: { inputMode: "numeric" },
  postal_be: { inputMode: "numeric" },
  bce: { inputMode: "numeric" },
  tva_be: { inputMode: "text" },
};

interface Props {
  field: PublicField;
  value: FieldValue;
  error?: string;
  locale: Locale;
  onChange: (value: FieldValue) => void;
  /// Contexte (optionnel) pour permettre le signalement d'un faux positif
  /// avec la traçabilité du formulaire d'origine.
  formId?: string;
  formSlug?: string;
  /// Rendu « ligne compacte » (libellé à gauche, contrôle à droite) pour les
  /// champs binaires empilés dans un conteneur à séparateurs (nouveau
  /// form-runner). Opt-in — le chemin legacy ne le passe jamais, défaut
  /// false = rendu historique inchangé. Ne concerne que checkbox et radio à
  /// 2 options ; ignoré pour les autres types.
  rowLayout?: boolean;
}

/// Rend le label + une InfoTooltip si `help` est présent — remplace
/// l'ancien affichage systématique de `help` en <FieldDescription> visible
/// en permanence (objectif : compacité, cf. spec 2026-07-05).
function LabelWithTooltip({ label, help, required }: { label: string; help: string; required?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {label}
      {required && <span className="text-destructive"> *</span>}
      {help && <InfoTooltip text={help} />}
    </span>
  );
}

export function PdfField({ field, value, error, locale, onChange, formId, formSlug, rowLayout = false }: Props) {
  const label = loc(field.label, locale);
  const help = loc(field.help, locale);
  const placeholder = loc(field.placeholder, locale);
  const invalid = !!error;

  // Helper local : évite de répéter les mêmes props 6 fois.
  const errorReport = (
    <FieldErrorReport
      error={error}
      fieldId={field.id}
      fieldType={field.type}
      rejectedValue={value}
      formId={formId}
      formSlug={formSlug}
      locale={locale}
    />
  );

  // Tableau de lignes (cohabitants etc.) — composant dédié.
  if (field.type === "array") {
    return (
      <ArrayField
        field={field}
        value={value}
        locale={locale}
        onChange={onChange}
        formId={formId}
        formSlug={formSlug}
      />
    );
  }

  // Checkbox : disposition horizontale (case + libellé).
  if (field.type === "checkbox") {
    // `readOnly` est porté côté schéma pour certaines cases qui ne doivent
    // PAS être modifiées côté UX (eg. cotisation syndicale, gérée par
    // l'organisme de paiement). On désactive l'interaction et on grise.
    const isReadOnly = field.readOnly === true;
    if (rowLayout) {
      return (
        <div className="flex flex-col gap-1 px-4 py-3" data-invalid={invalid}>
          <div className="flex items-center justify-between gap-4">
            <FieldLabel
              htmlFor={field.id}
              className={`min-w-0 flex-1 ${isReadOnly ? "font-normal text-muted-foreground" : "font-normal"}`}
            >
              <LabelWithTooltip label={label} help={help} required={field.required} />
            </FieldLabel>
            <Checkbox
              id={field.id}
              checked={value === true}
              onCheckedChange={(c) => !isReadOnly && onChange(c === true)}
              disabled={isReadOnly}
            />
          </div>
          {errorReport}
        </div>
      );
    }
    return (
      <Field orientation="horizontal" data-invalid={invalid}>
        <Checkbox
          id={field.id}
          checked={value === true}
          onCheckedChange={(c) => !isReadOnly && onChange(c === true)}
          disabled={isReadOnly}
        />
        <FieldLabel
          htmlFor={field.id}
          className={isReadOnly ? "font-normal text-muted-foreground" : "font-normal"}
        >
          <LabelWithTooltip label={label} help={help} required={field.required} />
        </FieldLabel>
        {errorReport}
      </Field>
    );
  }

  // Radio à exactement 2 options : bascule compacte au lieu d'une liste
  // déroulante (auto-appliqué, pas d'opt-in par champ nécessaire).
  if (field.type === "radio" && (field.options || []).length === 2) {
    const opts = field.options as unknown as [FieldOption, FieldOption];
    if (rowLayout) {
      return (
        <div className="flex flex-col gap-1 px-4 py-3" data-invalid={invalid}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <FieldLabel htmlFor={field.id} className="min-w-0 flex-1">
              <LabelWithTooltip label={label} help={help} required={field.required} />
            </FieldLabel>
            <YesNoSegmentedControl
              id={field.id}
              value={(value as string) ?? ""}
              onChange={onChange}
              options={opts}
              locale={locale}
              invalid={invalid}
            />
          </div>
          {errorReport}
        </div>
      );
    }
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={field.id}>
          <LabelWithTooltip label={label} help={help} required={field.required} />
        </FieldLabel>
        <YesNoSegmentedControl
          id={field.id}
          value={(value as string) ?? ""}
          onChange={onChange}
          options={opts}
          locale={locale}
          invalid={invalid}
        />
        {errorReport}
      </Field>
    );
  }

  // Select / radio (3+ options) : liste déroulante (compact), inchangé.
  if (field.type === "select" || field.type === "radio") {
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={field.id}>
          <LabelWithTooltip label={label} help={help} required={field.required} />
        </FieldLabel>
        <Select value={(value as string) ?? ""} onValueChange={(v) => onChange(v)}>
          <SelectTrigger id={field.id} className="w-full" aria-invalid={invalid}>
            <SelectValue placeholder={placeholder || "Sélectionner…"} />
          </SelectTrigger>
          <SelectContent>
            {!field.required && <SelectItem value="">—</SelectItem>}
            {(field.options || []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {loc(o.label, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errorReport}
      </Field>
    );
  }

  // Textarea
  if (field.type === "textarea") {
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={field.id}>
          <LabelWithTooltip label={label} help={help} required={field.required} />
        </FieldLabel>
        <Textarea
          id={field.id}
          value={(value as string) ?? ""}
          placeholder={placeholder}
          maxLength={field.maxLength}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
        />
        {errorReport}
      </Field>
    );
  }

  // Nom complet : deux inputs côté front (prénom + nom), une seule valeur PDF.
  if (field.type === "fullname") {
    const v: FullNameValue = isFullNameValue(value) ? value : {};
    const lastFirst = field.nameOrder === "last-first";
    const firstInput = (
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-muted-foreground">Prénom</span>
        <Input
          value={v.first ?? ""}
          placeholder={placeholder}
          aria-invalid={invalid}
          aria-label={`${label} — prénom`}
          onChange={(e) => onChange({ ...v, first: e.target.value })}
        />
      </div>
    );
    const lastInput = (
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-muted-foreground">Nom</span>
        <Input
          value={v.last ?? ""}
          aria-invalid={invalid}
          aria-label={`${label} — nom`}
          onChange={(e) => onChange({ ...v, last: e.target.value })}
        />
      </div>
    );
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={field.id}>
          <LabelWithTooltip label={label} help={help} required={field.required} />
        </FieldLabel>
        <div className="flex flex-col gap-2 sm:flex-row">
          {lastFirst ? lastInput : firstInput}
          {lastFirst ? firstInput : lastInput}
        </div>
        {errorReport}
      </Field>
    );
  }

  // NB : les champs `signature` sont rendus par <SignatureConfirm> dans le
  // runner (étape Signature dédiée), pas ici.

  // NISS : masque automatique AAMMJJ-SSS.CC
  if (field.type === "niss") {
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={field.id}>
          <LabelWithTooltip label={label} help={help} required={field.required} />
        </FieldLabel>
        <NissInput
          id={field.id}
          value={(value as string) ?? ""}
          aria-invalid={invalid}
          onChange={(v) => onChange(v)}
        />
        {errorReport}
      </Field>
    );
  }

  // Champs texte (text, iban, date, number, email, phone…)
  const hint = INPUT_HINTS[field.type] || {};
  // Date auto (date de génération) : pré-remplie et non éditable.
  const autoToday = field.prefillFrom === "system.today";
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.id}>
        <LabelWithTooltip label={label} help={help} required={field.required} />
      </FieldLabel>
      <Input
        id={field.id}
        type={hint.type ?? "text"}
        inputMode={hint.inputMode}
        value={(value as string | number) ?? ""}
        placeholder={placeholder}
        maxLength={field.maxLength}
        min={field.min}
        max={field.max}
        aria-invalid={invalid}
        disabled={autoToday}
        readOnly={autoToday}
        onChange={(e) => onChange(e.target.value)}
      />
      {autoToday && !help && (
        <FieldDescription>Date de génération du document (automatique).</FieldDescription>
      )}
      {errorReport}
    </Field>
  );
}
