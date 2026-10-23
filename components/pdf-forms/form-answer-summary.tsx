"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/i18n/format";
import { isFieldVisible } from "@/lib/pdf-forms/validation";
import { isAutoField, isSignatureField } from "@/lib/pdf-forms/auto-fields";
import { isFullNameValue, loc, type FieldValue, type FormPayload, type Locale } from "@/lib/pdf-forms/types";
import { FIELD_DERIVATIONS } from "@/lib/pdf-forms/field-derivations";
import type { PublicField } from "@/lib/pdf-forms/public-serializer";

/** Read the existing payload and schema only. This component never derives answers. */
export function FormAnswerSummary({ fields, values, locale, editableFieldIds = [], onEdit }: {
  fields: PublicField[];
  values: FormPayload;
  locale: Locale;
  editableFieldIds?: string[];
  onEdit?: (id: string) => void;
}) {
  const t = useTranslations("public.design");
  const renderValue = (field: PublicField, value: FieldValue): React.ReactNode => {
    if (Array.isArray(value)) return <ol className="grid gap-3">{value.map((row,index) => <li key={index} className="rounded-xl border p-3"><p className="mb-2 text-xs font-semibold">{t("answerRow",{number:index+1})}</p><dl className="grid gap-2">{(field.itemFields ?? []).filter(child => isFieldVisible(child.visibleIf,row) && isFieldVisible(child.visibleIfParent,values) && row[child.id] !== undefined && row[child.id] !== null && row[child.id] !== "").map(child => <div key={child.id}><dt className="text-xs text-muted-foreground">{loc(child.label,locale)}</dt><dd className="mt-1">{renderValue(child,row[child.id])}</dd></div>)}</dl></li>)}</ol>;
    if (isFullNameValue(value)) return field.nameOrder === "last-first" ? [value.last,value.first].filter(Boolean).join(" ") : [value.first,value.last].filter(Boolean).join(" ");
    if (typeof value === "boolean") return t(value ? "answerYes" : "answerNo");
    const option = field.options?.find(item => item.value === String(value));
    if (option) return loc(option.label,locale);
    if (field.type === "date" && value) return <bdi dir="ltr">{formatDate(String(value),locale)}</bdi>;
    return <bdi>{String(value ?? "")}</bdi>;
  };
  const canEdit = (field: PublicField) => editableFieldIds.includes(field.id) && !field.readOnly && !isAutoField(field) &&
    !(field.derivedFrom && FIELD_DERIVATIONS[field.derivedFrom.via](values[field.derivedFrom.fieldId] ?? "") !== null);
  const visible = fields.filter(field => !isSignatureField(field) && isFieldVisible(field.visibleIf,values) && values[field.id] !== undefined && values[field.id] !== null && values[field.id] !== "");
  return <section className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-5" aria-label={t("answersTitle")}>
    <h3 className="text-lg font-semibold">{t("answersTitle")}</h3>
    <dl className="mt-4 grid gap-4">{visible.map(field => <Fragment key={field.id}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-[color:var(--glass-border)] pb-4 last:border-0 last:pb-0">
        <div className="min-w-0 flex-1 basis-48"><dt className="text-sm font-medium text-muted-foreground">{loc(field.label,locale)}</dt><dd className="mt-2 break-words text-sm leading-relaxed">{renderValue(field,values[field.id])}</dd></div>
        {onEdit && canEdit(field) ? <Button type="button" variant="outline" className="min-h-11 whitespace-normal" onClick={() => onEdit(field.id)} aria-label={t("editAnswer",{label:loc(field.label,locale)})}><Pencil className="size-4" aria-hidden />{t("edit")}</Button> : null}
      </div>
    </Fragment>)}</dl>
  </section>;
}
