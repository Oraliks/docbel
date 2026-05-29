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
import { loc, Locale, FieldValue } from "@/lib/pdf-forms/types";
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

// Champs à valeur structurée → rendus en Geist Mono (tabular numerals,
// lisibilité d'identifiants). Donne l'impression d'un outil pro.
const MONO_TYPES = new Set(["niss", "iban", "bce", "tva_be", "postal_be", "phone_be", "number", "date"]);

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

  // Champs texte (text, niss, iban, date, number, email, phone…)
  const hint = INPUT_HINTS[field.type] || {};
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
        className={MONO_TYPES.has(field.type) ? "font-geist-mono" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {help && <FieldDescription>{help}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
