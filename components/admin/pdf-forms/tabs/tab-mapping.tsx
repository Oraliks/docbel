"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { EyeOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildMappingReport, type WidgetClaimSource } from "@/lib/pdf-forms/mapping-report";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { makeId, humanize } from "@/lib/pdf-forms/field-inference";
import type { PdfFormField, AcroFieldType } from "@/lib/pdf-forms/types";
import type { UseFormData } from "../use-form-data";

/// Génère un `id` unique pour un nouveau champ « masqué » sans collision
/// avec les ids déjà utilisés. Le suffixe numérique commence à _2 (comme la
/// convention buildEnrichedSchema).
function nextUniqueId(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}_${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}_${Date.now()}`;
}

/// Fabrique un champ enrichi « caché » à poser sur un widget orphelin. La
/// sémantique du champ = « widget reconnu mais non exposé au citoyen » :
/// hidden=true (ne va pas dans le PublicField, jamais rendu), required=false
/// (le validator Zod skip), label auto humanisé depuis le nom du widget.
function orphanFieldForWidget(
  widgetName: string,
  acroType: AcroFieldType,
  usedIds: Set<string>
): PdfFormField {
  const id = nextUniqueId(makeId(widgetName), usedIds);
  usedIds.add(id);
  // Match du type sémantique le plus simple selon l'acroType — pas
  // d'inférence sophistiquée : ces champs ne s'affichent jamais, seul
  // le stamping compte (ou l'absence de stamping, ici).
  const type = acroType === "checkbox" ? "checkbox" : "text";
  return {
    id,
    pdfFieldName: widgetName,
    type,
    required: false,
    label: { fr: `[Masqué] ${humanize(widgetName)}` },
    hidden: true,
    acroType,
  };
}

/// Onglet admin « Mapping AcroForm » — Phase 6 du plan bindings-canonical-ux.
///
/// Affiche pour CHAQUE widget technique du PDF :
///   - qui le stampe (champ schéma, pipe-option, template array, first-match
///     ou règle serveur du registry) ;
///   - son statut : bound / orphan (aucune claim) / conflict (2+ sources
///     hétérogènes sur un même widget texte, OU règle ciblant un widget
///     absent du technicalSchema).
///
/// Filtres : recherche texte + statut. Le tri prime les conflits, puis les
/// orphelins, puis les liés — pratique pour un triage rapide en admin.
export function TabMapping({ data }: { data: UseFormData }) {
  const t = useTranslations("admin.pdf");
  const { form, setFields } = data;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  // Sélection multi-lignes pour actions bulk. Clé = pdfFieldName (unique
  // par ligne). N'inclut QUE les orphelins réels (acroType != unknown) —
  // les conflits et les widgets fantômes ne peuvent pas être masqués via
  // ce mécanisme.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const report = useMemo(() => {
    if (!form) return null;
    const rules = getRulesForSlug(form.slug);
    return buildMappingReport(form.fields ?? [], form.technicalSchema ?? [], rules);
  }, [form]);

  if (!form || !report) return null;

  const q = query.trim().toLowerCase();
  const rows = report.rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (q) {
      const hit =
        r.pdfFieldName.toLowerCase().includes(q) ||
        r.claims.some(
          (c) =>
            c.fieldLabel?.toLowerCase().includes(q) ||
            c.fieldId?.toLowerCase().includes(q) ||
            c.ruleName?.toLowerCase().includes(q)
        );
      if (!hit) return false;
    }
    return true;
  });

  const s = report.summary;

  // Widgets « sélectionnables » = orphelins réels visibles après filtres,
  // acroType != unknown. Un widget « fantôme » (règle qui cible un widget
  // absent du PDF) n'est PAS masquable — il faut plutôt corriger la règle.
  const selectableRows = rows.filter((r) => r.status === "orphan" && r.acroType !== "unknown");
  const allSelectableChecked =
    selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.pdfFieldName));

  function toggleRow(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAllSelectable() {
    setSelected((prev) => {
      if (allSelectableChecked) {
        const next = new Set(prev);
        for (const r of selectableRows) next.delete(r.pdfFieldName);
        return next;
      }
      const next = new Set(prev);
      for (const r of selectableRows) next.add(r.pdfFieldName);
      return next;
    });
  }

  function bulkHideSelected() {
    if (selected.size === 0) return;
    const existingFields = (form!.fields ?? []) as PdfFormField[];
    const usedIds = new Set(existingFields.map((f) => f.id));
    const newFields: PdfFormField[] = [];
    // On itère sur `report.rows` pour retrouver l'acroType (info non
    // stockée dans la sélection).
    for (const row of report!.rows) {
      if (!selected.has(row.pdfFieldName)) continue;
      if (row.status !== "orphan" || row.acroType === "unknown") continue;
      newFields.push(orphanFieldForWidget(row.pdfFieldName, row.acroType, usedIds));
    }
    if (newFields.length === 0) return;
    setFields([...existingFields, ...newFields]);
    setSelected(new Set());
    toast.success(t("mappingBulkHideDone", { count: newFields.length }));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Compteurs */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-4">
          <StatBlock label={t("mappingTotal")} value={s.total} tone="muted" />
          <StatBlock label={t("mappingBound")} value={s.bound} tone="success" />
          <StatBlock label={t("mappingOrphan")} value={s.orphan} tone="warning" />
          <StatBlock label={t("mappingConflict")} value={s.conflict} tone="danger" />
        </CardContent>
      </Card>

      {/* Barre bulk actions — visible seulement si au moins une ligne
          orpheline est sélectionnée. Sauvegarde requise pour persister. */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {t("mappingBulkSelectedCount", { count: selected.size })}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              {t("mappingBulkClearSelection")}
            </Button>
            <Button size="sm" variant="secondary" onClick={bulkHideSelected}>
              <EyeOffIcon className="size-3.5" />
              {t("mappingBulkHideSelected", { count: selected.size })}
            </Button>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("mappingSearchPlaceholder")}
          className="sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("mappingFilterAll")}</SelectItem>
            <SelectItem value="conflict">{t("mappingFilterConflict")}</SelectItem>
            <SelectItem value="orphan">{t("mappingFilterOrphan")}</SelectItem>
            <SelectItem value="bound">{t("mappingFilterBound")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2 text-left">
                {selectableRows.length > 0 && (
                  <Checkbox
                    checked={allSelectableChecked}
                    onCheckedChange={toggleAllSelectable}
                    aria-label={t("mappingBulkSelectAllOrphans")}
                  />
                )}
              </th>
              <th className="px-3 py-2 text-left">{t("mappingColWidget")}</th>
              <th className="px-3 py-2 text-left">{t("mappingColType")}</th>
              <th className="px-3 py-2 text-left">{t("mappingColPage")}</th>
              <th className="px-3 py-2 text-left">{t("mappingColMaxLen")}</th>
              <th className="px-3 py-2 text-left">{t("mappingColBoundTo")}</th>
              <th className="px-3 py-2 text-left">{t("mappingColSource")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rowClass =
                r.status === "conflict"
                  ? "bg-destructive/5"
                  : r.status === "orphan"
                  ? "bg-amber-500/5"
                  : "";
              const isSelectable = r.status === "orphan" && r.acroType !== "unknown";
              return (
                <tr key={r.pdfFieldName} className={`border-t ${rowClass}`}>
                  <td className="px-3 py-2">
                    {isSelectable && (
                      <Checkbox
                        checked={selected.has(r.pdfFieldName)}
                        onCheckedChange={() => toggleRow(r.pdfFieldName)}
                        aria-label={t("mappingBulkSelectRow", { widget: r.pdfFieldName })}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.pdfFieldName}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {r.acroType}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {typeof r.page === "number" ? r.page + 1 : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {typeof r.maxLen === "number" ? r.maxLen : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.claims.length === 0 ? (
                      <span className="text-muted-foreground">
                        {t("mappingCellNoClaim")}
                      </span>
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {r.claims.map((c, i) => (
                          <li key={i} className="text-xs">
                            {c.fieldLabel ?? c.ruleName ?? c.fieldId ?? "—"}
                            {c.detail && (
                              <span className="text-muted-foreground"> ({c.detail})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.claims.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {Array.from(new Set(r.claims.map((c) => c.source))).map((src) => (
                          <SourceBadge key={src} source={src} />
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                  {t("mappingEmpty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "muted" | "success" | "warning" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "danger"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function SourceBadge({ source }: { source: WidgetClaimSource }) {
  const t = useTranslations("admin.pdf");
  const label =
    source === "field"
      ? t("mappingSourceField")
      : source === "pipe-option"
      ? t("mappingSourcePipe")
      : source === "array-template"
      ? t("mappingSourceArray")
      : source === "first-match"
      ? t("mappingSourceFirstMatch")
      : t("mappingSourceRule");
  return (
    <Badge variant="secondary" className="text-[10px]">
      {label}
    </Badge>
  );
}
