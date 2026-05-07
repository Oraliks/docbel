"use client";

import { useFormContext } from "react-hook-form";
import { HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DocumentField,
  Lang,
  getFieldLabel,
  getFieldHelpText,
  getOptionLabel,
} from "@/lib/documents/types";

interface DynamicFieldProps {
  field: DocumentField;
  serverError?: string;
  lang: Lang;
}

export function DynamicField({ field, serverError, lang }: DynamicFieldProps) {
  const { register, setValue, watch, formState } = useFormContext();
  const value = watch(field.id);
  const fieldError = formState.errors[field.id]?.message as string | undefined;
  const error = fieldError || serverError;
  const inputId = `field_${field.id}`;
  const required = field.required;

  const label = getFieldLabel(field, lang);
  const helpText = getFieldHelpText(field, lang);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="flex items-center gap-1.5">
        {label}
        {required && <span className="text-destructive">*</span>}
        {field.helpUrl && (
          <a
            href={field.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
            title={lang === "nl" ? "Meer informatie" : "Plus d'informations"}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </a>
        )}
      </Label>

      {field.type === "textarea" && (
        <Textarea
          id={inputId}
          {...register(field.id)}
          placeholder={helpText}
          rows={4}
          maxLength={field.maxLength || 5000}
        />
      )}

      {field.type === "checkbox" && (
        <Checkbox
          id={inputId}
          checked={value === true}
          onCheckedChange={(c) => setValue(field.id, c === true, { shouldValidate: true })}
        />
      )}

      {field.type === "select" && (
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => setValue(field.id, v, { shouldValidate: true })}
        >
          <SelectTrigger id={inputId}>
            <SelectValue placeholder={lang === "nl" ? "Selecteer…" : "Sélectionnez…"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {getOptionLabel(opt, lang)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === "date" && <Input id={inputId} type="date" {...register(field.id)} />}

      {field.type === "number" && (
        <Input id={inputId} type="number" inputMode="decimal" {...register(field.id)} />
      )}

      {(field.type === "text" ||
        field.type === "niss" ||
        field.type === "iban" ||
        field.type === "postal_be" ||
        field.type === "tva_be" ||
        field.type === "bce" ||
        field.type === "phone_be") && (
        <Input
          id={inputId}
          type="text"
          {...register(field.id)}
          maxLength={field.maxLength || 500}
          inputMode={
            field.type === "niss" ||
            field.type === "postal_be" ||
            field.type === "phone_be"
              ? "numeric"
              : undefined
          }
          placeholder={
            field.type === "niss"
              ? "00.00.00-000.00"
              : field.type === "iban"
              ? "BE00 0000 0000 0000"
              : field.type === "postal_be"
              ? "1000"
              : field.type === "tva_be"
              ? "BE0123456789"
              : field.type === "bce"
              ? "0123456789"
              : field.type === "phone_be"
              ? "+32 2 123 45 67"
              : undefined
          }
        />
      )}

      {helpText && field.type !== "textarea" && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
