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
import { Field, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import { NissInput } from "@/components/ui/niss-input";
import { loc, Locale, FieldValue, FullNameValue, isFullNameValue } from "@/lib/pdf-forms/types";
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
}

export function PdfField({ field, value, error, locale, onChange }: Props) {
  const label = loc(field.label, locale);
  const help = loc(field.help, locale);
  const placeholder = loc(field.placeholder, locale);
  const invalid = !!error;

  // Checkbox : disposition horizontale (case + libellé).
  if (field.type === "checkbox") {
    return (
      <Field orientation="horizontal" data-invalid={invalid}>
        <Checkbox
          id={field.id}
          checked={value === true}
          onCheckedChange={(c) => onChange(c === true)}
        />
        <FieldLabel htmlFor={field.id} className="font-normal">
          {label}
          {field.required && <span className="text-destructive"> *</span>}
        </FieldLabel>
        {help && <FieldDescription>{help}</FieldDescription>}
        <FieldError>{error}</FieldError>
      </Field>
    );
  }

  // Select / radio : liste déroulante (compact).
  if (field.type === "select" || field.type === "radio") {
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={field.id}>
          {label}
          {field.required && <span className="text-destructive"> *</span>}
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
        {help && <FieldDescription>{help}</FieldDescription>}
        <FieldError>{error}</FieldError>
      </Field>
    );
  }

  // Textarea
  if (field.type === "textarea") {
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={field.id}>
          {label}
          {field.required && <span className="text-destructive"> *</span>}
        </FieldLabel>
        <Textarea
          id={field.id}
          value={(value as string) ?? ""}
          placeholder={placeholder}
          maxLength={field.maxLength}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
        />
        {help && <FieldDescription>{help}</FieldDescription>}
        <FieldError>{error}</FieldError>
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
          {label}
          {field.required && <span className="text-destructive"> *</span>}
        </FieldLabel>
        <div className="flex flex-col gap-2 sm:flex-row">
          {lastFirst ? lastInput : firstInput}
          {lastFirst ? firstInput : lastInput}
        </div>
        {help && <FieldDescription>{help}</FieldDescription>}
        <FieldError>{error}</FieldError>
      </Field>
    );
  }

  // NISS : masque automatique AAMMJJ-SSS.CC
  if (field.type === "niss") {
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={field.id}>
          {label}
          {field.required && <span className="text-destructive"> *</span>}
        </FieldLabel>
        <NissInput
          id={field.id}
          value={(value as string) ?? ""}
          aria-invalid={invalid}
          onChange={(v) => onChange(v)}
        />
        {help && <FieldDescription>{help}</FieldDescription>}
        <FieldError>{error}</FieldError>
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
        {label}
        {field.required && <span className="text-destructive"> *</span>}
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
      {help && <FieldDescription>{help}</FieldDescription>}
      {autoToday && !help && (
        <FieldDescription>Date de génération du document (automatique).</FieldDescription>
      )}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
