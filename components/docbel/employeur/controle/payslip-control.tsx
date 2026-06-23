"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WORKER_TYPES, BENEFIT_TYPES } from "@/lib/employeur/constants";
import {
  analysePayslip,
  type PayslipControlInput,
  type PayslipControlResult,
  type FindingLevel,
} from "@/lib/employeur/controle/engine";
import type { AlertSeverity } from "@/lib/employeur/constants";
import { AlertCard } from "@/components/docbel/employeur/alert-card";
import { LegalDisclaimerBox } from "@/components/docbel/employeur/legal-disclaimer-box";

const NONE = "_none";
const CHOOSE = "_choose";

const LEVEL_TO_SEVERITY: Record<FindingLevel, AlertSeverity> = {
  info: "info",
  attention: "warning",
  critique: "critical",
};

const VERDICT_KEY: Record<PayslipControlResult["verdict"], string> = {
  ok: "payslipVerdictOk",
  points_to_check: "payslipVerdictPoints",
  insufficient: "payslipVerdictInsufficient",
};

const VERDICT_CLASS: Record<PayslipControlResult["verdict"], string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
  points_to_check:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200",
  insufficient:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
};

const REGIME_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "temps_plein", labelKey: "payslipRegimeFull" },
  { value: "temps_partiel", labelKey: "payslipRegimePartial" },
];

interface FormState {
  period: string;
  workerType: string;
  regime: string;
  jointCommitteeNumber: string;
  grossMonthlySalary: string;
  netReceived: string;
  contributionsShown: string;
  prime: string;
  pecule: string;
  weeklyHours: string;
  fullTimeReferenceHours: string;
  benefits: string[];
  remarque: string;
}

const INITIAL: FormState = {
  period: "",
  workerType: CHOOSE,
  regime: NONE,
  jointCommitteeNumber: "",
  grossMonthlySalary: "",
  netReceived: "",
  contributionsShown: "",
  prime: "",
  pecule: "",
  weeklyHours: "",
  fullTimeReferenceHours: "38",
  benefits: [],
  remarque: "",
};

function num(s: string): number | null {
  if (!s.trim()) return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function pickEnum(v: string): string | null {
  return v === NONE || v === CHOOSE || v === "" ? null : v;
}

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

function buildInput(form: FormState): PayslipControlInput {
  const regime = pickEnum(form.regime);
  return {
    period: form.period.trim() || null,
    workerType: pickEnum(form.workerType),
    regime: regime === "temps_plein" || regime === "temps_partiel" ? regime : null,
    jointCommitteeNumber: form.jointCommitteeNumber.trim() || null,
    grossMonthlySalary: num(form.grossMonthlySalary),
    netReceived: num(form.netReceived),
    contributionsShown: num(form.contributionsShown),
    prime: num(form.prime),
    pecule: num(form.pecule),
    weeklyHours: num(form.weeklyHours),
    fullTimeReferenceHours: num(form.fullTimeReferenceHours),
    benefits: form.benefits,
    remarque: form.remarque.trim() || null,
  };
}

export function PayslipControl() {
  const t = useTranslations("public.pro");
  const [form, setForm] = useState<FormState>(INITIAL);
  const [result, setResult] = useState<PayslipControlResult | null>(null);
  const [exporting, setExporting] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleBenefit = (value: string) =>
    setForm((f) => ({
      ...f,
      benefits: f.benefits.includes(value)
        ? f.benefits.filter((b) => b !== value)
        : [...f.benefits, value],
    }));

  function analyse() {
    setResult(analysePayslip(buildInput(form)));
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const res = await fetch("/api/employeur/controle/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: buildInput(form) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? t("payslipErrPdf"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      // Libère l'URL après un court délai (laisse le temps à l'onglet de l'ouvrir).
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("payslipErrPdf"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("payslipDataTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t("payslipPeriod")} htmlFor="period" help={t("payslipPeriodHelp")}>
            <Input
              id="period"
              value={form.period}
              onChange={(e) => set("period", e.target.value)}
              placeholder={t("payslipPeriodPlaceholder")}
            />
          </Field>
          <Field label={t("payslipWorkerType")}>
            <Select
              value={form.workerType}
              onValueChange={(v: string | null) => v && set("workerType", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CHOOSE}>{t("payslipChoose")}</SelectItem>
                {WORKER_TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("payslipRegime")}>
            <Select
              value={form.regime}
              onValueChange={(v: string | null) => v && set("regime", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("payslipToPrecise")}</SelectItem>
                {REGIME_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {t(o.labelKey as Parameters<typeof t>[0])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={t("payslipCp")}
            htmlFor="cp"
            help={t("payslipCpHelp")}
          >
            <Input
              id="cp"
              value={form.jointCommitteeNumber}
              onChange={(e) => set("jointCommitteeNumber", e.target.value)}
              placeholder={t("payslipCpPlaceholder")}
            />
          </Field>
          <Field label={t("payslipGross")} htmlFor="brut">
            <Input
              id="brut"
              inputMode="decimal"
              value={form.grossMonthlySalary}
              onChange={(e) => set("grossMonthlySalary", e.target.value)}
              placeholder={t("payslipGrossPlaceholder")}
            />
          </Field>
          <Field label={t("payslipNet")} htmlFor="net">
            <Input
              id="net"
              inputMode="decimal"
              value={form.netReceived}
              onChange={(e) => set("netReceived", e.target.value)}
              placeholder={t("payslipNetPlaceholder")}
            />
          </Field>
          <Field label={t("payslipContributions")} htmlFor="cotis">
            <Input
              id="cotis"
              inputMode="decimal"
              value={form.contributionsShown}
              onChange={(e) => set("contributionsShown", e.target.value)}
            />
          </Field>
          <Field label={t("payslipPrime")} htmlFor="prime">
            <Input
              id="prime"
              inputMode="decimal"
              value={form.prime}
              onChange={(e) => set("prime", e.target.value)}
            />
          </Field>
          <Field label={t("payslipPecule")} htmlFor="pecule">
            <Input
              id="pecule"
              inputMode="decimal"
              value={form.pecule}
              onChange={(e) => set("pecule", e.target.value)}
            />
          </Field>
          <Field label={t("payslipWeeklyHours")} htmlFor="wh">
            <Input
              id="wh"
              inputMode="decimal"
              value={form.weeklyHours}
              onChange={(e) => set("weeklyHours", e.target.value)}
              placeholder={t("payslipWeeklyHoursPlaceholder")}
            />
          </Field>
          <Field
            label={t("payslipRefHours")}
            htmlFor="ref"
            help={t("payslipRefHoursHelp")}
          >
            <Input
              id="ref"
              inputMode="decimal"
              value={form.fullTimeReferenceHours}
              onChange={(e) => set("fullTimeReferenceHours", e.target.value)}
            />
          </Field>

          <div className="space-y-2 sm:col-span-2">
            <Label>{t("payslipBenefits")}</Label>
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

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rem">{t("payslipRemark")}</Label>
            <Textarea
              id="rem"
              value={form.remarque}
              onChange={(e) => set("remarque", e.target.value)}
              placeholder={t("payslipRemarkPlaceholder")}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={analyse}>
          <Search /> {t("payslipAnalyse")}
        </Button>
        {result ? (
          <Button variant="outline" onClick={exportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            {t("payslipExportPdf")}
          </Button>
        ) : null}
      </div>

      {result ? (
        <div className="space-y-3">
          <div
            className={`rounded-lg border px-4 py-3 text-base font-semibold ${VERDICT_CLASS[result.verdict]}`}
          >
            {t(VERDICT_KEY[result.verdict] as Parameters<typeof t>[0])}
          </div>
          {result.findings.length > 0 ? (
            <div className="space-y-2">
              {result.findings.map((f) => (
                <div key={f.code} className="space-y-1">
                  <AlertCard
                    severity={LEVEL_TO_SEVERITY[f.level]}
                    message={f.message}
                    sourceCode={f.sourceCode}
                  />
                  <p className="pl-3 text-xs text-muted-foreground">
                    {t("payslipRecommendation", { text: f.recommendation })}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <LegalDisclaimerBox context="controle" />
    </div>
  );
}
