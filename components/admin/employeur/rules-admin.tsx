"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WORKER_TYPES, CONTRACT_TYPES } from "@/lib/employeur/constants";

export interface AdminRule {
  id: string;
  code: string;
  title: string;
  severity: string;
  sourceCode: string | null;
  internalNote: string | null;
  active: boolean;
}

interface TestResult {
  firedRuleCodes: string[];
  items: { title: string; priority: string }[];
  alerts: { severity: string; message: string }[];
  reliability: string;
}

const TRI = [
  { value: "unknown", label: "Je ne sais pas" },
  { value: "yes", label: "Oui" },
  { value: "no", label: "Non" },
];
const triToBool = (v: string): boolean | null => (v === "yes" ? true : v === "no" ? false : null);

export function RulesAdmin({ rules }: { rules: AdminRule[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleActive(rule: AdminRule, next: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/employeur/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Échec");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    } finally {
      setBusy(false);
    }
  }

  // --- Testeur de règles -----------------------------------------------------
  const [test, setTest] = useState({
    hasEmployees: "unknown",
    hasOnssNumber: "unknown",
    workerType: "employe",
    contractType: "cdi",
    weeklyHours: "",
    fullTimeReferenceHours: "38",
    grossMonthlySalary: "",
    jointCommitteeNumber: "",
  });
  const [result, setResult] = useState<TestResult | null>(null);

  async function runTest() {
    setBusy(true);
    try {
      const num = (s: string) => {
        const n = parseFloat(s.replace(",", "."));
        return Number.isFinite(n) ? n : null;
      };
      const res = await fetch("/api/admin/employeur/rules/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hasEmployees: triToBool(test.hasEmployees),
          hasOnssNumber: triToBool(test.hasOnssNumber),
          workerType: test.workerType,
          contractType: test.contractType,
          weeklyHours: num(test.weeklyHours),
          fullTimeReferenceHours: num(test.fullTimeReferenceHours),
          grossMonthlySalary: num(test.grossMonthlySalary),
          jointCommitteeNumber: test.jointCommitteeNumber,
        }),
      });
      if (!res.ok) throw new Error("Échec du test");
      setResult((await res.json()) as TestResult);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {rules.map((r) => {
          const blocked = !r.sourceCode && !r.internalNote;
          return (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{r.code}</Badge>
                    <span className="font-medium">{r.title}</span>
                    <Badge variant={r.severity === "critical" ? "destructive" : r.severity === "warning" ? "warning" : "info"}>
                      {r.severity}
                    </Badge>
                    {r.sourceCode ? <Badge variant="secondary">{r.sourceCode}</Badge> : null}
                    {blocked ? (
                      <Badge variant="warning" className="gap-1">
                        <TriangleAlert className="size-3" /> Sans source — publication bloquée
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={r.active} onCheckedChange={(c) => toggleActive(r, c === true)} disabled={busy} />
                  Active
                </label>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="size-4" /> Testeur de règles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TestSelect label="A déjà du personnel" value={test.hasEmployees} onChange={(v) => setTest({ ...test, hasEmployees: v })} options={TRI} />
            <TestSelect label="A un n° ONSS" value={test.hasOnssNumber} onChange={(v) => setTest({ ...test, hasOnssNumber: v })} options={TRI} />
            <TestSelect label="Type travailleur" value={test.workerType} onChange={(v) => setTest({ ...test, workerType: v })} options={WORKER_TYPES} />
            <TestSelect label="Type contrat" value={test.contractType} onChange={(v) => setTest({ ...test, contractType: v })} options={CONTRACT_TYPES} />
            <TestInput label="Heures/sem" value={test.weeklyHours} onChange={(v) => setTest({ ...test, weeklyHours: v })} />
            <TestInput label="Réf. temps plein" value={test.fullTimeReferenceHours} onChange={(v) => setTest({ ...test, fullTimeReferenceHours: v })} />
            <TestInput label="Salaire brut" value={test.grossMonthlySalary} onChange={(v) => setTest({ ...test, grossMonthlySalary: v })} />
            <TestInput label="Commission paritaire" value={test.jointCommitteeNumber} onChange={(v) => setTest({ ...test, jointCommitteeNumber: v })} />
          </div>
          <Button onClick={runTest} disabled={busy}>
            Tester
          </Button>

          {result ? (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Règles déclenchées :</span>
                {result.firedRuleCodes.length ? (
                  result.firedRuleCodes.map((c) => <Badge key={c} variant="info">{c}</Badge>)
                ) : (
                  <span>aucune</span>
                )}
                <Badge variant="outline">Fiabilité : {result.reliability}</Badge>
              </div>
              <div>
                <p className="font-medium">Items ({result.items.length})</p>
                <ul className="ml-4 list-disc text-muted-foreground">
                  {result.items.map((i, idx) => (
                    <li key={idx}>
                      [{i.priority}] {i.title}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium">Alertes ({result.alerts.length})</p>
                <ul className="ml-4 list-disc text-muted-foreground">
                  {result.alerts.map((a, idx) => (
                    <li key={idx}>
                      [{a.severity}] {a.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function TestSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v: string | null) => v && onChange(v)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TestInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
