"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  LEGAL_FORMS,
  REGIONS,
  WORKER_TYPES,
  CONTRACT_TYPES,
  BENEFIT_TYPES,
  type Option,
} from "@/lib/employeur/constants";
import { LegalDisclaimerBox } from "./legal-disclaimer-box";

// Sentinelle unique pour l'état « non choisi » d'un Select. RÈGLE base-ui :
// toute valeur (sentinelle comprise) DOIT avoir un <SelectItem> correspondant,
// sinon le trigger affiche la valeur brute (« _none ») au lieu du libellé.
const CHOOSE = "_choose";

interface FormState {
  organisationName: string;
  legalForm: string;
  enterpriseNumber: string;
  hasEmployees: string;
  hasOnssNumber: string;
  onssNumber: string;
  region: string;
  sector: string;
  naceCode: string;
  workerType: string;
  contractType: string;
  plannedStartDate: string;
  functionTitle: string;
  workplace: string;
  weeklyHours: string;
  fullTimeReferenceHours: string;
  grossMonthlySalary: string;
  jointCommitteeNumber: string;
  benefits: string[];
  nightWork: boolean;
  sundayWork: boolean;
  saturdayWork: boolean;
  telework: boolean;
}

const INITIAL: FormState = {
  organisationName: "",
  legalForm: CHOOSE,
  enterpriseNumber: "",
  hasEmployees: "unknown",
  hasOnssNumber: "unknown",
  onssNumber: "",
  region: CHOOSE,
  sector: "",
  naceCode: "",
  workerType: CHOOSE,
  contractType: CHOOSE,
  plannedStartDate: "",
  functionTitle: "",
  workplace: "",
  weeklyHours: "",
  fullTimeReferenceHours: "38",
  grossMonthlySalary: "",
  jointCommitteeNumber: "",
  benefits: [],
  nightWork: false,
  sundayWork: false,
  saturdayWork: false,
  telework: false,
};

const TRISTATE: { value: string; labelKey: string }[] = [
  { value: "yes", labelKey: "wizTristateYes" },
  { value: "no", labelKey: "wizTristateNo" },
  { value: "unknown", labelKey: "wizTristateUnknown" },
];

function num(s: string): number | null {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function pickEnum(v: string): string | undefined {
  return v === CHOOSE || v === "" ? undefined : v;
}

/** Champ avec label + aide. */
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
  options: readonly (Option | { value: string; labelKey: string })[];
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

export function EngagementWizard() {
  const t = useTranslations("public.pro");
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleBenefit = (value: string) =>
    setForm((f) => ({
      ...f,
      benefits: f.benefits.includes(value)
        ? f.benefits.filter((b) => b !== value)
        : [...f.benefits, value],
    }));

  async function submit() {
    if (form.workerType === CHOOSE) {
      toast.error(t("wizErrWorkerType"));
      return;
    }
    if (form.contractType === CHOOSE) {
      toast.error(t("wizErrContractType"));
      return;
    }

    setSubmitting(true);
    const payload = {
      profile: {
        organisationName: form.organisationName,
        legalForm: pickEnum(form.legalForm),
        enterpriseNumber: form.enterpriseNumber,
        hasEmployees: pickEnum(form.hasEmployees),
        hasOnssNumber: pickEnum(form.hasOnssNumber),
        onssNumber: form.onssNumber,
        region: pickEnum(form.region),
        sector: form.sector,
        naceCode: form.naceCode,
      },
      scenario: {
        workerType: form.workerType,
        contractType: form.contractType,
        plannedStartDate: form.plannedStartDate,
        functionTitle: form.functionTitle,
        workplace: form.workplace,
        weeklyHours: num(form.weeklyHours),
        fullTimeReferenceHours: num(form.fullTimeReferenceHours),
        grossMonthlySalary: num(form.grossMonthlySalary),
        jointCommitteeNumber: form.jointCommitteeNumber,
        region: pickEnum(form.region),
        benefits: form.benefits,
        nightWork: form.nightWork,
        sundayWork: form.sundayWork,
        saturdayWork: form.saturdayWork,
        telework: form.telework,
      },
    };

    try {
      const res = await fetch("/api/employeur/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? t("wizErrShort"));
      router.push(`/employeur/dossiers/${data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("wizErrCreate"));
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <ol className="flex items-center gap-2 text-sm">
        <li className={step === 1 ? "font-semibold text-foreground" : "text-muted-foreground"}>
          {t("wizStep1")}
        </li>
        <span className="text-muted-foreground">›</span>
        <li className={step === 2 ? "font-semibold text-foreground" : "text-muted-foreground"}>
          {t("wizStep2")}
        </li>
      </ol>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("wizOrgTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label={t("wizOrgName")} htmlFor="org">
              <Input
                id="org"
                value={form.organisationName}
                onChange={(e) => set("organisationName", e.target.value)}
                placeholder={t("wizOrgNamePlaceholder")}
              />
            </Field>
            <Field label={t("wizLegalForm")}>
              <SelectField
                value={form.legalForm}
                onChange={(v) => set("legalForm", v)}
                options={LEGAL_FORMS}
                placeholder={t("wizToPrecise")}
              />
            </Field>
            <Field label={t("wizBce")} htmlFor="bce" help={t("wizBceHelp")}>
              <Input
                id="bce"
                value={form.enterpriseNumber}
                onChange={(e) => set("enterpriseNumber", e.target.value)}
                placeholder="0123.456.789"
              />
            </Field>
            <Field label={t("wizRegion")}>
              <SelectField
                value={form.region}
                onChange={(v) => set("region", v)}
                options={REGIONS}
                placeholder={t("wizToPrecise")}
              />
            </Field>
            <Field
              label={t("wizHasEmployees")}
              help={t("wizHasEmployeesHelp")}
            >
              <SelectField
                value={form.hasEmployees}
                onChange={(v) => set("hasEmployees", v)}
                options={TRISTATE}
              />
            </Field>
            <Field
              label={t("wizHasOnss")}
              help={t("wizHasOnssHelp")}
            >
              <SelectField
                value={form.hasOnssNumber}
                onChange={(v) => set("hasOnssNumber", v)}
                options={TRISTATE}
              />
            </Field>
            {form.hasOnssNumber === "yes" ? (
              <Field label={t("wizOnssNumber")} htmlFor="onss">
                <Input
                  id="onss"
                  value={form.onssNumber}
                  onChange={(e) => set("onssNumber", e.target.value)}
                />
              </Field>
            ) : null}
            <Field label={t("wizSector")} htmlFor="sector">
              <Input
                id="sector"
                value={form.sector}
                onChange={(e) => set("sector", e.target.value)}
                placeholder={t("wizSectorPlaceholder")}
              />
            </Field>
            <Field label={t("wizNace")} htmlFor="nace">
              <Input
                id="nace"
                value={form.naceCode}
                onChange={(e) => set("naceCode", e.target.value)}
              />
            </Field>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => setStep(2)}>
              {t("wizContinue")} <ArrowRight />
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("wizWorkerTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label={t("wizWorkerType")}>
              <SelectField
                value={form.workerType}
                onChange={(v) => set("workerType", v)}
                options={WORKER_TYPES}
                placeholder={t("wizChoose")}
              />
            </Field>
            <Field label={t("wizContractType")}>
              <SelectField
                value={form.contractType}
                onChange={(v) => set("contractType", v)}
                options={CONTRACT_TYPES}
                placeholder={t("wizChoose")}
              />
            </Field>
            <Field label={t("wizFunction")} htmlFor="fct">
              <Input
                id="fct"
                value={form.functionTitle}
                onChange={(e) => set("functionTitle", e.target.value)}
              />
            </Field>
            <Field label={t("wizStartDate")} htmlFor="start">
              <Input
                id="start"
                type="date"
                value={form.plannedStartDate}
                onChange={(e) => set("plannedStartDate", e.target.value)}
              />
            </Field>
            <Field label={t("wizWorkplace")} htmlFor="wp">
              <Input
                id="wp"
                value={form.workplace}
                onChange={(e) => set("workplace", e.target.value)}
              />
            </Field>
            <Field
              label={t("wizCp")}
              htmlFor="cp"
              help={t("wizCpHelp")}
            >
              <Input
                id="cp"
                value={form.jointCommitteeNumber}
                onChange={(e) => set("jointCommitteeNumber", e.target.value)}
                placeholder={t("wizCpPlaceholder")}
              />
            </Field>
            <Field label={t("wizGrossSalary")} htmlFor="salary">
              <Input
                id="salary"
                inputMode="decimal"
                value={form.grossMonthlySalary}
                onChange={(e) => set("grossMonthlySalary", e.target.value)}
                placeholder={t("wizGrossSalaryPlaceholder")}
              />
            </Field>
            <Field label={t("wizWeeklyHours")} htmlFor="wh">
              <Input
                id="wh"
                inputMode="decimal"
                value={form.weeklyHours}
                onChange={(e) => set("weeklyHours", e.target.value)}
                placeholder={t("wizWeeklyHoursPlaceholder")}
              />
            </Field>
            <Field
              label={t("wizRefHours")}
              htmlFor="ref"
              help={t("wizRefHoursHelp")}
            >
              <Input
                id="ref"
                inputMode="decimal"
                value={form.fullTimeReferenceHours}
                onChange={(e) => set("fullTimeReferenceHours", e.target.value)}
              />
            </Field>

            <div className="space-y-2 sm:col-span-2">
              <Label>{t("wizBenefits")}</Label>
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

            <div className="space-y-2 sm:col-span-2">
              <Label>{t("wizConditions")}</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {(
                  [
                    ["nightWork", "wizCondNight"],
                    ["sundayWork", "wizCondSunday"],
                    ["saturdayWork", "wizCondSaturday"],
                    ["telework", "wizCondTelework"],
                  ] as const
                ).map(([key, labelKey]) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={form[key]}
                      onCheckedChange={(c) => set(key, c === true)}
                    />
                    {t(labelKey as Parameters<typeof t>[0])}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
              <ArrowLeft /> {t("wizBack")}
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              {t("wizGenerate")}
            </Button>
          </CardFooter>
        </Card>
      )}

      <LegalDisclaimerBox context="general" />
    </div>
  );
}
