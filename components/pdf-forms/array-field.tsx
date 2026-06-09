"use client";

import { useMemo } from "react";
import { PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { PdfField } from "./pdf-field";
import { loc, type Locale, type FieldValue, type FieldValueRecord, isFieldValueRecordArray } from "@/lib/pdf-forms/types";
import type { PublicField } from "@/lib/pdf-forms/public-serializer";

interface Props {
  field: PublicField;
  value: FieldValue;
  locale: Locale;
  onChange: (value: FieldValue) => void;
  formId?: string;
  formSlug?: string;
}

/// Rendu d'un champ `array` : une carte par ligne, ajout / suppression de
/// lignes via boutons. Chaque ligne contient les sous-champs définis par
/// `field.itemFields` (eux-mêmes typés `PublicField` côté serveur).
///
/// La règle d'auto-remplissage spécifique cohabitants (Indépendant → 999999.99,
/// allocations familiales auto-non si > 35 ans) est centralisée dans
/// `applyAutoRules` ci-dessous — peut être étendue pour d'autres tableaux.
export function ArrayField({ field, value, locale, onChange, formId, formSlug }: Props) {
  const label = loc(field.label, locale);
  const help = loc(field.help, locale);
  const addLabel = loc(field.addRowLabel, locale) || "Ajouter une ligne";

  const itemFields = useMemo(
    () => (field.itemFields ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [field.itemFields]
  );

  const rows: FieldValueRecord[] = isFieldValueRecordArray(value) ? value : [];

  function addRow() {
    if (field.maxRows && rows.length >= field.maxRows) return;
    const empty: FieldValueRecord = {};
    for (const sf of itemFields) {
      if (sf.defaultValue !== undefined) empty[sf.id] = sf.defaultValue as FieldValueRecord[string];
    }
    onChange([...rows, empty]);
  }

  function removeRow(idx: number) {
    if (field.minRows && rows.length <= field.minRows) return;
    onChange(rows.filter((_, i) => i !== idx));
  }

  function patchRow(idx: number, next: FieldValueRecord) {
    onChange(rows.map((r, i) => (i === idx ? next : r)));
  }

  return (
    <Field>
      <FieldLabel>
        {label}
        {field.required && <span className="text-destructive"> *</span>}
      </FieldLabel>
      {help && <FieldDescription>{help}</FieldDescription>}

      <div className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            Aucune ligne. Clique sur « {addLabel} » pour en ajouter une.
          </div>
        ) : (
          rows.map((row, idx) => (
            <Card key={idx}>
              <CardContent className="grid gap-3 py-4 sm:grid-cols-2">
                <div className="sm:col-span-2 flex items-baseline justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Ligne {idx + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(idx)}
                    disabled={field.minRows ? rows.length <= field.minRows : false}
                    className="text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="size-4" />
                    Supprimer
                  </Button>
                </div>
                {itemFields.map((sub) => {
                  // visibleIf intra-ligne : on évalue contre la ligne courante,
                  // pas contre le payload global.
                  if (sub.visibleIf) {
                    const ref = row[sub.visibleIf.fieldId];
                    if (!evaluateRowVisibility(ref, sub.visibleIf.op, sub.visibleIf.value)) {
                      return null;
                    }
                  }
                  return (
                    <PdfField
                      key={sub.id}
                      field={sub}
                      value={row[sub.id] ?? null}
                      locale={locale}
                      formId={formId}
                      formSlug={formSlug}
                      onChange={(v) => {
                        const next = { ...row, [sub.id]: v as FieldValueRecord[string] };
                        patchRow(idx, applyAutoRules(field.id, sub.id, next));
                      }}
                    />
                  );
                })}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addRow}
        disabled={field.maxRows ? rows.length >= field.maxRows : false}
        className="self-start"
      >
        <PlusIcon className="size-4" />
        {addLabel}
      </Button>
    </Field>
  );
}

/// Visibilité intra-ligne — version simplifiée du `visibleIf` global, qui
/// ne regarde QUE les champs de la même ligne.
function evaluateRowVisibility(
  refValue: unknown,
  op: "equals" | "notEquals" | "in" | "notIn",
  expected: string | number | boolean | Array<string | number>
): boolean {
  switch (op) {
    case "equals":
      return refValue === expected;
    case "notEquals":
      return refValue !== expected;
    case "in":
      return Array.isArray(expected) && expected.includes(refValue as string | number);
    case "notIn":
      return Array.isArray(expected) && !expected.includes(refValue as string | number);
  }
}

/// Règles d'auto-remplissage spécifiques à la grille cohabitants C1. Idempotent —
/// retourne le record patché. Ajouter d'autres règles ici quand le besoin
/// se présente pour d'autres tableaux.
///
/// 1. Si le « lien » devient « FAC » et que `c1PartenaireStatus` est vide,
///    pré-sélectionner « première fois » (le user pourra changer).
/// 2. Si le type de revenu professionnel devient « independant », pré-remplir
///    le montant à 999999.99 (impact statut cohabitant pour conjoint/partenaire).
/// 3. Si la date de naissance indique > 35 ans révolus, forcer
///    `allocationsFamiliales` à « non » (sauf valeur déjà saisie par l'user).
function applyAutoRules(
  arrayFieldId: string,
  changedSubFieldId: string,
  row: FieldValueRecord
): FieldValueRecord {
  if (arrayFieldId !== "cohabitants") return row;

  const out = { ...row };

  if (changedSubFieldId === "lien" && out.lien === "FAC" && !out.c1PartenaireStatus) {
    out.c1PartenaireStatus = "premiere-fois";
  }

  if (
    changedSubFieldId === "typeRevenuPro" &&
    out.typeRevenuPro === "independant" &&
    (out.montantRevenuPro === undefined || out.montantRevenuPro === null || out.montantRevenuPro === "")
  ) {
    out.montantRevenuPro = 999999.99;
  }

  if (changedSubFieldId === "dateNaissance" && typeof out.dateNaissance === "string" && out.dateNaissance) {
    const dob = new Date(out.dateNaissance);
    if (!Number.isNaN(dob.getTime())) {
      const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age > 35 && out.allocationsFamiliales !== "oui") {
        out.allocationsFamiliales = "non";
      }
    }
  }

  return out;
}
