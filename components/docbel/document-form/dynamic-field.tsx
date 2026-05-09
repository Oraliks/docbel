"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { HelpCircle, Search, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
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
import type { BCELookupResult } from "@/lib/documents/bce-lookup";
import { AIHelpPopover } from "./ai-help-popover";

interface DynamicFieldProps {
  field: DocumentField;
  allFields?: DocumentField[];
  serverError?: string;
  lang: Lang;
  templateName?: string;
  organisme?: string | null;
}

/// Mappe un résultat BCE vers les IDs de champs à remplir, par convention de nommage.
/// Si le champ BCE est "employer_bce", on remplit "employer_name", "employer_street", etc.
function buildBceFillMap(bceFieldId: string, allFieldIds: string[]): Record<string, string> {
  const prefix = bceFieldId.replace(/[._-]?(bce|tva|numero_entreprise)$/i, "");
  const sep = prefix ? (bceFieldId.match(/[._-]/)?.[0] ?? "_") : "";
  const candidates: Record<string, string[]> = {
    name: ["name", "nom", "denomination", "raison_sociale", "company_name"],
    street: ["street", "rue", "adresse", "address"],
    streetNumber: ["street_num", "numero", "num", "number"],
    postalCode: ["postal", "postal_code", "code_postal", "cp"],
    city: ["city", "ville", "commune"],
    legalForm: ["legal_form", "forme", "forme_legale"],
  };
  const map: Record<string, string> = {};
  for (const [resultKey, suffixes] of Object.entries(candidates)) {
    for (const suffix of suffixes) {
      const candidate = prefix ? `${prefix}${sep}${suffix}` : suffix;
      if (allFieldIds.includes(candidate)) {
        map[resultKey] = candidate;
        break;
      }
    }
  }
  return map;
}

export function DynamicField({
  field,
  allFields = [],
  serverError,
  lang,
  templateName = "",
  organisme = null,
}: DynamicFieldProps) {
  const { register, setValue, watch, formState } = useFormContext();
  const value = watch(field.id);
  const fieldError = formState.errors[field.id]?.message as string | undefined;
  const error = fieldError || serverError;
  const inputId = `field_${field.id}`;
  const required = field.required;
  const [bceLooking, setBceLooking] = useState(false);
  const [bceFilled, setBceFilled] = useState(false);

  const label = getFieldLabel(field, lang);
  const helpText = getFieldHelpText(field, lang);

  async function lookupBce() {
    const raw = String(value || "").trim();
    if (!raw) {
      toast.error(lang === "nl" ? "Vul eerst het nummer in" : "Saisissez d'abord le numéro");
      return;
    }
    setBceLooking(true);
    setBceFilled(false);
    try {
      const res = await fetch(`/api/documents/bce/${encodeURIComponent(raw)}`);
      const data: BCELookupResult & { error?: string; message?: string } = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur BCE");
      }
      if (data.source === "unavailable" || !data.name) {
        toast.warning(
          lang === "nl"
            ? "Geen gegevens gevonden in de KBO."
            : "Aucune donnée trouvée à la BCE pour ce numéro."
        );
        return;
      }
      // Auto-fill par convention
      const map = buildBceFillMap(field.id, allFields.map((f) => f.id));
      let filledCount = 0;
      const apply = (key: keyof BCELookupResult, fieldId: string | undefined) => {
        const v = data[key];
        if (fieldId && v) {
          setValue(fieldId, v as string, { shouldValidate: true, shouldDirty: true });
          filledCount++;
        }
      };
      apply("name", map.name);
      apply("street", map.street);
      apply("streetNumber", map.streetNumber);
      apply("postalCode", map.postalCode);
      apply("city", map.city);
      apply("legalForm", map.legalForm);
      // Met à jour la valeur du BCE elle-même au format propre
      setValue(field.id, data.bce, { shouldValidate: true, shouldDirty: true });
      setBceFilled(true);
      toast.success(
        lang === "nl"
          ? `${data.name} gevonden — ${filledCount} veld(en) ingevuld`
          : `${data.name} trouvé — ${filledCount} champ(s) rempli(s)`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBceLooking(false);
    }
  }

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
        <AIHelpPopover
          templateName={templateName}
          organisme={organisme}
          fieldId={field.id}
          fieldLabel={label}
          fieldHelp={helpText}
          lang={lang}
        />
      </Label>

      {field.type === "textarea" && (
        <Textarea
          id={inputId}
          {...register(field.id)}
          placeholder={field.placeholder || helpText}
          rows={4}
          maxLength={field.maxLength || 5000}
          aria-required={required || undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={[helpText ? `${inputId}-help` : null, error ? `${inputId}-error` : null]
            .filter(Boolean)
            .join(" ") || undefined}
        />
      )}

      {field.type === "checkbox" && (
        <Checkbox
          id={inputId}
          checked={value === true}
          onCheckedChange={(c) => setValue(field.id, c === true, { shouldValidate: true })}
          aria-required={required || undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
      )}

      {field.type === "select" && (
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => setValue(field.id, v, { shouldValidate: true })}
        >
          <SelectTrigger
            id={inputId}
            aria-required={required || undefined}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
          >
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

      {field.type === "date" && (
        <Input
          id={inputId}
          type="date"
          {...register(field.id)}
          aria-required={required || undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
      )}

      {field.type === "number" && (
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          {...register(field.id)}
          aria-required={required || undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
      )}

      {(field.type === "text" ||
        field.type === "niss" ||
        field.type === "iban" ||
        field.type === "postal_be" ||
        field.type === "tva_be" ||
        field.type === "bce" ||
        field.type === "phone_be") && (
        <div className="flex gap-2">
          <Input
            id={inputId}
            type="text"
            className="flex-1"
            {...register(field.id)}
            maxLength={field.maxLength || 500}
            aria-required={required || undefined}
            aria-invalid={!!error || undefined}
            aria-describedby={[helpText ? `${inputId}-help` : null, error ? `${inputId}-error` : null]
              .filter(Boolean)
              .join(" ") || undefined}
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
                ? "0123.456.789"
                : field.type === "phone_be"
                ? "+32 2 123 45 67"
                : undefined
            }
          />
          {(field.type === "bce" || field.type === "tva_be") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={lookupBce}
              disabled={bceLooking || !value}
              title={lang === "nl" ? "Gegevens uit KBO ophalen" : "Récupérer les infos depuis la BCE"}
            >
              {bceLooking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : bceFilled ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <>
                  <Search className="w-4 h-4 mr-1" />
                  {lang === "nl" ? "BCE" : "BCE"}
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {helpText && field.type !== "textarea" && (
        <p id={`${inputId}-help`} className="text-xs text-muted-foreground">
          {helpText}
        </p>
      )}

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
