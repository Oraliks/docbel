"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import {
  CheckCircleIcon,
  HelpCircleIcon,
  Loader2Icon,
  SearchIcon,
} from "lucide-react";
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
import { GLASS_INPUT, GLASS_LABEL } from "@/lib/glass-classes";
import { AIHelpPopover } from "./ai-help-popover";

interface DynamicFieldProps {
  field: DocumentField;
  allFields?: DocumentField[];
  serverError?: string;
  lang: Lang;
  templateName?: string;
  organisme?: string | null;
  /// Activer le bouton ✨ d'aide IA. Désactivé par défaut pour le grand public ;
  /// peut être activé globalement via /admin/documents/settings.
  aiHelpEnabled?: boolean;
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
  aiHelpEnabled = false,
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
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={inputId}
        className={`${GLASS_LABEL} flex items-center gap-1.5`}
      >
        {label}
        {required ? (
          <span style={{ color: "#b8324a" }}>*</span>
        ) : null}
        {field.helpUrl ? (
          <a
            href={field.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-[color:var(--glass-ink-faint)] transition-colors hover:text-[color:var(--glass-ink)]"
            title={lang === "nl" ? "Meer informatie" : "Plus d'informations"}
          >
            <HelpCircleIcon className="size-3.5" />
          </a>
        ) : null}
        {aiHelpEnabled ? (
          <AIHelpPopover
            templateName={templateName}
            organisme={organisme}
            fieldId={field.id}
            fieldLabel={label}
            fieldHelp={helpText}
            lang={lang}
          />
        ) : null}
      </Label>

      {field.type === "textarea" ? (
        <Textarea
          id={inputId}
          {...register(field.id)}
          placeholder={field.placeholder || helpText}
          rows={4}
          maxLength={field.maxLength || 5000}
          className={GLASS_INPUT}
          aria-required={required || undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={
            [
              helpText ? `${inputId}-help` : null,
              error ? `${inputId}-error` : null,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
      ) : null}

      {field.type === "checkbox" ? (
        <Checkbox
          id={inputId}
          checked={value === true}
          onCheckedChange={(c) =>
            setValue(field.id, c === true, { shouldValidate: true })
          }
          aria-required={required || undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
      ) : null}

      {field.type === "select" ? (
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) =>
            setValue(field.id, v, { shouldValidate: true })
          }
        >
          <SelectTrigger
            id={inputId}
            className={`${GLASS_INPUT} w-full`}
            aria-required={required || undefined}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
          >
            <SelectValue
              placeholder={lang === "nl" ? "Selecteer…" : "Sélectionnez…"}
            />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {getOptionLabel(opt, lang)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {field.type === "date" ? (
        <Input
          id={inputId}
          type="date"
          {...register(field.id)}
          className={GLASS_INPUT}
          aria-required={required || undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
      ) : null}

      {field.type === "number" ? (
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          {...register(field.id)}
          className={GLASS_INPUT}
          aria-required={required || undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
      ) : null}

      {field.type === "text" ||
      field.type === "niss" ||
      field.type === "iban" ||
      field.type === "postal_be" ||
      field.type === "tva_be" ||
      field.type === "bce" ||
      field.type === "phone_be" ? (
        <div className="flex gap-2">
          <Input
            id={inputId}
            type="text"
            className={`${GLASS_INPUT} flex-1`}
            {...register(field.id)}
            maxLength={field.maxLength || 500}
            aria-required={required || undefined}
            aria-invalid={!!error || undefined}
            aria-describedby={
              [
                helpText ? `${inputId}-help` : null,
                error ? `${inputId}-error` : null,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
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
          {field.type === "bce" || field.type === "tva_be" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={lookupBce}
              disabled={bceLooking || !value}
              title={
                lang === "nl"
                  ? "Gegevens uit KBO ophalen"
                  : "Récupérer les infos depuis la BCE"
              }
              className="rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55"
            >
              {bceLooking ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : bceFilled ? (
                <CheckCircleIcon
                  className="size-4"
                  style={{ color: "#1d6b3e" }}
                />
              ) : (
                <>
                  <SearchIcon className="size-4" />
                  BCE
                </>
              )}
            </Button>
          ) : null}
        </div>
      ) : null}

      {helpText && field.type !== "textarea" ? (
        <p
          id={`${inputId}-help`}
          className="text-[12px] text-[color:var(--glass-ink-soft)]"
        >
          {helpText}
        </p>
      ) : null}

      {error ? (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-[12px] font-semibold"
          style={{ color: "#b8324a" }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
