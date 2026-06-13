"use client";

/**
 * Module 2 — Simulateur de coût employeur (client).
 * Recalcule en direct via le moteur pur `estimateEmployerCost`.
 * Boutons : Comparer (2e formulaire côte à côte), Sauvegarder, Exporter PDF.
 */
import { useMemo, useState } from "react";
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

const REGIME_OPTIONS: Option[] = [
  { value: "temps_plein", label: "Temps plein" },
  { value: "temps_partiel", label: "Temps partiel" },
];

const REDUCTION_OPTIONS: Option[] = [
  { value: "a_verifier", label: "À vérifier" },
  { value: "aucune", label: "Aucune" },
  { value: "premier_engagement", label: "Premier engagement" },
  { value: "groupe_cible", label: "Groupe cible" },
  { value: "etudiant", label: "Étudiant" },
  { value: "flexi", label: "Flexi-job" },
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
  options: readonly Option[];
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={(v: string | null) => v && onChange(v)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {placeholder ? <SelectItem value={CHOOSE}>{placeholder}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
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
        <CardTitle className="text-base">{heading ?? "Paramètres"}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Salaire brut mensuel (€)" htmlFor="gross">
          <Input
            id="gross"
            inputMode="decimal"
            value={form.grossMonthlySalary}
            onChange={(e) => set("grossMonthlySalary", e.target.value)}
            placeholder="Ex. 2500"
          />
        </Field>
        <Field label="Régime">
          <SelectField
            value={form.regime}
            onChange={(v) => set("regime", v as CostRegime)}
            options={REGIME_OPTIONS}
          />
        </Field>
        {form.regime === "temps_partiel" ? (
          <>
            <Field label="Heures / semaine" htmlFor="wh">
              <Input
                id="wh"
                inputMode="decimal"
                value={form.weeklyHours}
                onChange={(e) => set("weeklyHours", e.target.value)}
                placeholder="Ex. 20"
              />
            </Field>
            <Field label="Heures temps plein de référence" htmlFor="ref">
              <Input
                id="ref"
                inputMode="decimal"
                value={form.fullTimeReferenceHours}
                onChange={(e) => set("fullTimeReferenceHours", e.target.value)}
              />
            </Field>
          </>
        ) : null}
        <Field label="Type de travailleur">
          <SelectField
            value={form.workerType}
            onChange={(v) => set("workerType", v)}
            options={WORKER_TYPES}
            placeholder="— Choisir —"
          />
        </Field>
        <Field label="Type de contrat">
          <SelectField
            value={form.contractType}
            onChange={(v) => set("contractType", v)}
            options={CONTRACT_TYPES}
            placeholder="— Choisir —"
          />
        </Field>
        <Field
          label="Commission paritaire"
          htmlFor="cp"
          help="Sans CP, le salaire minimum sectoriel ne peut être vérifié."
        >
          <Input
            id="cp"
            value={form.jointCommitteeNumber}
            onChange={(e) => set("jointCommitteeNumber", e.target.value)}
            placeholder="Ex. 200"
          />
        </Field>
        <Field label="Réductions de cotisations">
          <SelectField
            value={form.reductions}
            onChange={(v) => set("reductions", v as CostReduction)}
            options={REDUCTION_OPTIONS}
          />
        </Field>

        <div className="space-y-2 sm:col-span-2">
          <Label>Avantages prévus</Label>
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
            Prévoir un 13e mois (prime de fin d&apos;année)
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
  const rows: [string, string, boolean?][] = [
    ["Cotisations patronales (mensuel)", EUR(result.estimatedEmployerContributions)],
    ["Coût employeur mensuel total", EUR(result.estimatedMonthlyEmployerCost), true],
    ["Coût employeur annuel total", EUR(result.estimatedAnnualEmployerCost), true],
    ["Net salarié indicatif (mensuel)", EUR(result.estimatedNetSalary)],
  ];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{label ?? "Estimation"}</CardTitle>
          <ReliabilityBadge level={result.reliability} />
        </div>
        <CardDescription>Estimation structurelle, non certifiée.</CardDescription>
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
      title: `Simulation de coût employeur — ${EUR(input.grossMonthlySalary)} brut / mois`,
      reliability: result.reliability,
      facts: [
        ["Salaire brut mensuel", EUR(input.grossMonthlySalary)],
        ["Régime", form.regime === "temps_plein" ? "Temps plein" : "Temps partiel"],
        ["Type de travailleur", input.workerType || "—"],
        ["Type de contrat", input.contractType || "—"],
        ["Commission paritaire", input.jointCommitteeNumber || "—"],
        ["13e mois", form.thirteenthMonth ? "Oui" : "Non"],
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
      toast.error("Renseignez un salaire brut valide avant d'enregistrer.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/employeur/cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Simulation — ${EUR(input.grossMonthlySalary)} brut`,
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
      if (!res.ok || !data.id) throw new Error(data.error ?? "Échec");
      toast.success("Simulation enregistrée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf() {
    const input = toInput(formA);
    if (input.grossMonthlySalary <= 0) {
      toast.error("Renseignez un salaire brut valide avant l'export.");
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
        throw new Error(data.error ?? "Échec");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'export PDF.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calculator className="size-4 text-primary" aria-hidden />
          Recalcul en direct
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
            <GitCompare /> {comparing ? "Arrêter la comparaison" : "Comparer"}
          </Button>
          <Button variant="outline" size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Sauvegarder
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <FileDown />} Exporter PDF
          </Button>
        </div>
      </div>

      <div className={comparing ? "grid gap-4 lg:grid-cols-2" : "space-y-4"}>
        {/* Colonne A */}
        <div className="space-y-4">
          <SimForm form={formA} setForm={setFormA} heading={comparing ? "Scénario A" : "Paramètres"} />
          <ResultsCard result={resultA} label={comparing ? "Estimation — A" : "Estimation"} />
        </div>

        {/* Colonne B (comparaison) */}
        {comparing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <Button variant="ghost" size="sm" onClick={() => setComparing(false)}>
                <X /> Fermer
              </Button>
            </div>
            <SimForm form={formB} setForm={setFormB} heading="Scénario B" />
            <ResultsCard result={resultB} label="Estimation — B" />
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
              <CardTitle className="text-base">Hypothèses de calcul</CardTitle>
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
              <CardTitle className="text-base">Données manquantes / non chiffrées</CardTitle>
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
