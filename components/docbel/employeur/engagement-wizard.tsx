"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

const TRISTATE: Option[] = [
  { value: "yes", label: "Oui" },
  { value: "no", label: "Non" },
  { value: "unknown", label: "Je ne sais pas" },
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

export function EngagementWizard() {
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
      toast.error("Sélectionnez un type de travailleur.");
      return;
    }
    if (form.contractType === CHOOSE) {
      toast.error("Sélectionnez un type de contrat.");
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
      if (!res.ok || !data.id) throw new Error(data.error ?? "Échec");
      router.push(`/employeur/dossiers/${data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la création du dossier.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <ol className="flex items-center gap-2 text-sm">
        <li className={step === 1 ? "font-semibold text-foreground" : "text-muted-foreground"}>
          1. Profil employeur
        </li>
        <span className="text-muted-foreground">›</span>
        <li className={step === 2 ? "font-semibold text-foreground" : "text-muted-foreground"}>
          2. Travailleur envisagé
        </li>
      </ol>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Votre organisation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom de l'organisation" htmlFor="org">
              <Input
                id="org"
                value={form.organisationName}
                onChange={(e) => set("organisationName", e.target.value)}
                placeholder="Ex. Boulangerie Dupont SRL"
              />
            </Field>
            <Field label="Forme juridique">
              <SelectField
                value={form.legalForm}
                onChange={(v) => set("legalForm", v)}
                options={LEGAL_FORMS}
                placeholder="À préciser"
              />
            </Field>
            <Field label="Numéro BCE" htmlFor="bce" help="Numéro d'entreprise (10 chiffres).">
              <Input
                id="bce"
                value={form.enterpriseNumber}
                onChange={(e) => set("enterpriseNumber", e.target.value)}
                placeholder="0123.456.789"
              />
            </Field>
            <Field label="Région principale">
              <SelectField
                value={form.region}
                onChange={(v) => set("region", v)}
                options={REGIONS}
                placeholder="À préciser"
              />
            </Field>
            <Field
              label="Avez-vous déjà du personnel ?"
              help="Détermine s'il s'agit d'un premier engagement."
            >
              <SelectField
                value={form.hasEmployees}
                onChange={(v) => set("hasEmployees", v)}
                options={TRISTATE}
              />
            </Field>
            <Field
              label="Avez-vous déjà un numéro ONSS employeur ?"
              help="Sans numéro ONSS, une identification via WIDE peut être nécessaire."
            >
              <SelectField
                value={form.hasOnssNumber}
                onChange={(v) => set("hasOnssNumber", v)}
                options={TRISTATE}
              />
            </Field>
            {form.hasOnssNumber === "yes" ? (
              <Field label="Numéro ONSS" htmlFor="onss">
                <Input
                  id="onss"
                  value={form.onssNumber}
                  onChange={(e) => set("onssNumber", e.target.value)}
                />
              </Field>
            ) : null}
            <Field label="Secteur d'activité" htmlFor="sector">
              <Input
                id="sector"
                value={form.sector}
                onChange={(e) => set("sector", e.target.value)}
                placeholder="Ex. Horeca, commerce, construction…"
              />
            </Field>
            <Field label="Code NACE (si connu)" htmlFor="nace">
              <Input
                id="nace"
                value={form.naceCode}
                onChange={(e) => set("naceCode", e.target.value)}
              />
            </Field>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => setStep(2)}>
              Continuer <ArrowRight />
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Le travailleur envisagé</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Type de travailleur *">
              <SelectField
                value={form.workerType}
                onChange={(v) => set("workerType", v)}
                options={WORKER_TYPES}
                placeholder="— Choisir —"
              />
            </Field>
            <Field label="Type de contrat *">
              <SelectField
                value={form.contractType}
                onChange={(v) => set("contractType", v)}
                options={CONTRACT_TYPES}
                placeholder="— Choisir —"
              />
            </Field>
            <Field label="Fonction prévue" htmlFor="fct">
              <Input
                id="fct"
                value={form.functionTitle}
                onChange={(e) => set("functionTitle", e.target.value)}
              />
            </Field>
            <Field label="Date prévue d'entrée" htmlFor="start">
              <Input
                id="start"
                type="date"
                value={form.plannedStartDate}
                onChange={(e) => set("plannedStartDate", e.target.value)}
              />
            </Field>
            <Field label="Lieu de travail" htmlFor="wp">
              <Input
                id="wp"
                value={form.workplace}
                onChange={(e) => set("workplace", e.target.value)}
              />
            </Field>
            <Field
              label="Commission paritaire (si connue)"
              htmlFor="cp"
              help="Sans CP, le salaire minimum ne peut pas être vérifié précisément."
            >
              <Input
                id="cp"
                value={form.jointCommitteeNumber}
                onChange={(e) => set("jointCommitteeNumber", e.target.value)}
                placeholder="Ex. 200"
              />
            </Field>
            <Field label="Salaire brut mensuel (€)" htmlFor="salary">
              <Input
                id="salary"
                inputMode="decimal"
                value={form.grossMonthlySalary}
                onChange={(e) => set("grossMonthlySalary", e.target.value)}
                placeholder="Ex. 2500"
              />
            </Field>
            <Field label="Heures / semaine" htmlFor="wh">
              <Input
                id="wh"
                inputMode="decimal"
                value={form.weeklyHours}
                onChange={(e) => set("weeklyHours", e.target.value)}
                placeholder="Ex. 20"
              />
            </Field>
            <Field
              label="Heures temps plein de référence"
              htmlFor="ref"
              help="Généralement 38h. En-dessous → temps partiel."
            >
              <Input
                id="ref"
                inputMode="decimal"
                value={form.fullTimeReferenceHours}
                onChange={(e) => set("fullTimeReferenceHours", e.target.value)}
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

            <div className="space-y-2 sm:col-span-2">
              <Label>Conditions de travail</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {(
                  [
                    ["nightWork", "Travail de nuit"],
                    ["sundayWork", "Travail le dimanche"],
                    ["saturdayWork", "Travail le samedi"],
                    ["telework", "Télétravail"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={form[key]}
                      onCheckedChange={(c) => set(key, c === true)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
              <ArrowLeft /> Retour
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Générer mon dossier
            </Button>
          </CardFooter>
        </Card>
      )}

      <LegalDisclaimerBox context="general" />
    </div>
  );
}
