"use client";

/**
 * Module 2 — Simulateur de coût employeur (client).
 * Recalcule en direct via le moteur pur `estimateEmployerCost`.
 * Boutons : Comparer (2e formulaire côte à côte), Sauvegarder, Exporter PDF.
 */
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Calculator, GitCompare, Save, FileDown, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  WORKER_TYPES,
  CONTRACT_TYPES,
  BENEFIT_TYPES,
  type Option,
} from "@/lib/employeur/constants";
import {
  estimateEmployerCost,
  type CostReduction,
  type CostRegime,
  type EmployerCostInput,
  type EmployerCostResult,
} from "@/lib/employeur/cost/engine";
import { ReliabilityBadge } from "@/components/docbel/employeur/badges";
import { AlertCard } from "@/components/docbel/employeur/alert-card";
import { LegalDisclaimerBox } from "@/components/docbel/employeur/legal-disclaimer-box";

const CHOOSE = "_choose";

type LabelKeyOption = { value: string; labelKey: string };

const REGIME_OPTIONS: LabelKeyOption[] = [
  { value: "temps_plein", labelKey: "costsimRegimeFull" },
  { value: "temps_partiel", labelKey: "costsimRegimePartial" },
];

const REDUCTION_OPTIONS: LabelKeyOption[] = [
  { value: "a_verifier", labelKey: "costsimRedToCheck" },
  { value: "aucune", labelKey: "costsimRedNone" },
  { value: "premier_engagement", labelKey: "costsimRedFirstHire" },
  { value: "groupe_cible", labelKey: "costsimRedTargetGroup" },
  { value: "etudiant", labelKey: "costsimRedStudent" },
  { value: "flexi", labelKey: "costsimRedFlexi" },
];

interface FormState {
  grossMonthlySalary: string;
  regime: CostRegime;
  weeklyHours: string;
  fullTimeReferenceHours: string;
  workerType: string;
  contractType: string;
  jointCommitteeNumber: string;
  benefits: string[];
  thirteenthMonth: boolean;
  reductions: CostReduction;
}

const INITIAL: FormState = {
  grossMonthlySalary: "2500",
  regime: "temps_plein",
  weeklyHours: "",
  fullTimeReferenceHours: "38",
  workerType: "employe",
  contractType: "cdi",
  jointCommitteeNumber: "",
  benefits: [],
  thirteenthMonth: false,
  reductions: "a_verifier",
};

function num(s: string): number | null {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toInput(form: FormState): EmployerCostInput {
  return {
    grossMonthlySalary: num(form.grossMonthlySalary) ?? 0,
    regime: form.regime,
    weeklyHours: num(form.weeklyHours),
    fullTimeReferenceHours: num(form.fullTimeReferenceHours),
    workerType: form.workerType === CHOOSE ? "" : form.workerType,
    contractType: form.contractType === CHOOSE ? "" : form.contractType,
    jointCommitteeNumber: form.jointCommitteeNumber.trim(),
    benefits: form.benefits,
    thirteenthMonth: form.thirteenthMonth,
    reductions: form.reductions,
  };
}

const EUR = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n)
    ? "—"
    : `${n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function Field({
  label,
  help,
  htmlFor,
  children,
}: {
  label: string;
  help?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly (Option | LabelKeyOption)[];
  placeholder?: string;
}) {
  const t = useTranslations("public.pro");
  return (
    <Select value={value} onValueChange={(v: string | null) => v && onChange(v)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {placeholder ? <SelectItem value={CHOOSE}>{placeholder}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {"labelKey" in o ? t(o.labelKey as Parameters<typeof t>[0]) : o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Formulaire d'une colonne de simulation. */
function SimForm({
  form,
  setForm,
  heading,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  heading?: string;
}) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm({ ...form, [key]: value });

  const t = useTranslations("public.pro");

  const toggleBenefit = (value: string) =>
    setForm({
      ...form,
      benefits: form.benefits.includes(value)
        ? form.benefits.filter((b) => b !== value)
        : [...form.benefits, value],
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{heading ?? t("costsimParams")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label={t("costsimGrossSalary")} htmlFor="gross">
          <Input
            id="gross"
            inputMode="decimal"
            value={form.grossMonthlySalary}
            onChange={(e) => set("grossMonthlySalary", e.target.value)}
            placeholder={t("costsimGrossSalaryPlaceholder")}
          />
        </Field>
        <Field label={t("costsimRegime")}>
          <SelectField
            value={form.regime}
            onChange={(v) => set("regime", v as CostRegime)}
            options={REGIME_OPTIONS}
          />
        </Field>
        {form.regime === "temps_partiel" ? (
          <>
            <Field label={t("costsimWeeklyHours")} htmlFor="wh">
              <Input
                id="wh"
                inputMode="decimal"
                value={form.weeklyHours}
                onChange={(e) => set("weeklyHours", e.target.value)}
                placeholder={t("costsimWeeklyHoursPlaceholder")}
              />
            </Field>
            <Field label={t("costsimRefHours")} htmlFor="ref">
              <Input
                id="ref"
                inputMode="decimal"
                value={form.fullTimeReferenceHours}
                onChange={(e) => set("fullTimeReferenceHours", e.target.value)}
              />
            </Field>
          </>
        ) : null}
        <Field label={t("costsimWorkerType")}>
          <SelectField
            value={form.workerType}
            onChange={(v) => set("workerType", v)}
            options={WORKER_TYPES}
            placeholder={t("costsimChoose")}
          />
        </Field>
        <Field label={t("costsimContractType")}>
          <SelectField
            value={form.contractType}
            onChange={(v) => set("contractType", v)}
            options={CONTRACT_TYPES}
            placeholder={t("costsimChoose")}
          />
        </Field>
        <Field
          label={t("costsimCp")}
          htmlFor="cp"
          help={t("costsimCpHelp")}
        >
          <Input
            id="cp"
            value={form.jointCommitteeNumber}
            onChange={(e) => set("jointCommitteeNumber", e.target.value)}
            placeholder={t("costsimCpPlaceholder")}
          />
        </Field>
        <Field label={t("costsimReductions")}>
          <SelectField
            value={form.reductions}
            onChange={(v) => set("reductions", v as CostReduction)}
            options={REDUCTION_OPTIONS}
          />
        </Field>

        <div className="space-y-2 sm:col-span-2">
          <Label>{t("costsimBenefits")}</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {BENEFIT_TYPES.map((b) => (
              <label key={b.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={form.benefits.includes(b.value)}
                  onCheckedChange={() => toggleBenefit(b.value)}
                />
                {b.label}
              </label>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={form.thirteenthMonth}
              onCheckedChange={(c) => set("thirteenthMonth", c === true)}
            />
            {t("costsimThirteenth")}
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

/** Carte de résultats d'une simulation. */
function ResultsCard({
  result,
  label,
}: {
  result: EmployerCostResult;
  label?: string;
}) {
  const t = useTranslations("public.pro");
  const rows: [string, string, boolean?][] = [
    [t("costsimRowContributions"), EUR(result.estimatedEmployerContributions)],
    [t("costsimRowMonthlyCost"), EUR(result.estimatedMonthlyEmployerCost), true],
    [t("costsimRowAnnualCost"), EUR(result.estimatedAnnualEmployerCost), true],
    [t("costsimRowNet"), EUR(result.estimatedNetSalary)],
  ];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{label ?? t("costsimEstimation")}</CardTitle>
          <ReliabilityBadge level={result.reliability} />
        </div>
        <CardDescription>{t("costsimEstimationDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="space-y-2">
          {rows.map(([k, v, strong]) => (
            <div key={k} className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-muted-foreground">{k}</dt>
              <dd
                className={
                  strong
                    ? "text-base font-semibold tabular-nums text-foreground"
                    : "text-sm tabular-nums text-foreground"
                }
              >
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function CostSimulator() {
  const t = useTranslations("public.pro");
  const [formA, setFormA] = useState<FormState>(INITIAL);
  const [formB, setFormB] = useState<FormState>(INITIAL);
  const [comparing, setComparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const resultA = useMemo(() => estimateEmployerCost(toInput(formA)), [formA]);
  const resultB = useMemo(() => estimateEmployerCost(toInput(formB)), [formB]);

  function buildPdfData(form: FormState, result: EmployerCostResult) {
    const input = toInput(form);
    return {
      title: t("costsimPdfTitle", { amount: EUR(input.grossMonthlySalary) }),
      reliability: result.reliability,
      facts: [
        [t("costsimFactGross"), EUR(input.grossMonthlySalary)],
        [
          t("costsimFactRegime"),
          form.regime === "temps_plein" ? t("costsimRegimeFull") : t("costsimRegimePartial"),
        ],
        [t("costsimFactWorkerType"), input.workerType || "—"],
        [t("costsimFactContractType"), input.contractType || "—"],
        [t("costsimFactCp"), input.jointCommitteeNumber || "—"],
        [t("costsimFactThirteenth"), form.thirteenthMonth ? t("costsimYes") : t("costsimNo")],
      ] as [string, string][],
      estimatedEmployerContributions: result.estimatedEmployerContributions,
      estimatedMonthlyEmployerCost: result.estimatedMonthlyEmployerCost,
      estimatedAnnualEmployerCost: result.estimatedAnnualEmployerCost,
      estimatedNetSalary: result.estimatedNetSalary ?? null,
      assumptions: result.assumptions,
      missingData: result.missingData,
      warnings: result.warnings,
    };
  }

  async function save() {
    const input = toInput(formA);
    if (input.grossMonthlySalary <= 0) {
      toast.error(t("costsimErrGrossSave"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/employeur/cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t("costsimSaveTitle", { amount: EUR(input.grossMonthlySalary) }),
          inputs: input,
          result: {
            estimatedEmployerContributions: resultA.estimatedEmployerContributions,
            estimatedMonthlyEmployerCost: resultA.estimatedMonthlyEmployerCost,
            estimatedAnnualEmployerCost: resultA.estimatedAnnualEmployerCost,
            estimatedNetSalary: resultA.estimatedNetSalary ?? null,
            assumptions: resultA.assumptions,
            missingData: resultA.missingData,
            reliability: resultA.reliability,
            warnings: resultA.warnings,
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? t("costsimErrShort"));
      toast.success(t("costsimSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("costsimErrSave"));
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf() {
    const input = toInput(formA);
    if (input.grossMonthlySalary <= 0) {
      toast.error(t("costsimErrGrossExport"));
      return;
    }
    setExporting(true);
    try {
      const res = await fetch("/api/employeur/cost/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: buildPdfData(formA, resultA) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? t("costsimErrShort"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("costsimErrExport"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calculator className="size-4 text-primary" aria-hidden />
          {t("costsimLiveRecalc")}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={comparing ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setComparing((c) => {
                const next = !c;
                if (next) setFormB({ ...formA });
                return next;
              });
            }}
          >
            <GitCompare /> {comparing ? t("costsimStopCompare") : t("costsimCompare")}
          </Button>
          <Button variant="outline" size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} {t("costsimSave")}
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <FileDown />} {t("costsimExportPdf")}
          </Button>
        </div>
      </div>

      <div className={comparing ? "grid gap-4 lg:grid-cols-2" : "space-y-4"}>
        {/* Colonne A */}
        <div className="space-y-4">
          <SimForm form={formA} setForm={setFormA} heading={comparing ? t("costsimScenarioA") : t("costsimParams")} />
          <ResultsCard result={resultA} label={comparing ? t("costsimEstimationA") : t("costsimEstimation")} />
        </div>

        {/* Colonne B (comparaison) */}
        {comparing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <Button variant="ghost" size="sm" onClick={() => setComparing(false)}>
                <X /> {t("costsimClose")}
              </Button>
            </div>
            <SimForm form={formB} setForm={setFormB} heading={t("costsimScenarioB")} />
            <ResultsCard result={resultB} label={t("costsimEstimationB")} />
          </div>
        ) : null}
      </div>

      {/* Avertissements (sur le scénario A) */}
      {resultA.warnings.length > 0 ? (
        <div className="space-y-2">
          {resultA.warnings.map((w, i) => (
            <AlertCard
              key={i}
              severity={
                w.toLowerCase().includes("salaire minimum") || w.toLowerCase().includes("flexi")
                  ? "warning"
                  : "info"
              }
              message={w}
            />
          ))}
        </div>
      ) : null}

      {/* Hypothèses + données manquantes */}
      <div className="grid gap-4 sm:grid-cols-2">
        {resultA.assumptions.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("costsimAssumptions")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {resultA.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
        {resultA.missingData.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("costsimMissingData")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {resultA.missingData.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <LegalDisclaimerBox context="simulation" />
    </div>
  );
}
