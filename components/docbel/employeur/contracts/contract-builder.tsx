"use client";

import { useMemo, useState } from "react";
import { Copy, Download, Info, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  generateContract,
  applicableFields,
  applicableOptionalClauses,
  isFieldRequired,
} from "@/lib/employeur/contracts/generate";
import {
  CONTRACT_TYPES,
  CONTRACT_DISCLAIMER,
  type ContractType,
  type WorkRegime,
  type ContractField,
} from "@/lib/employeur/contracts/legal-content";

export interface ContractBuilderProps {
  /** Préremplissage des champs employeur (depuis le profil). */
  initialValues?: Record<string, string>;
}

const GROUP_LABELS: Record<ContractField["group"], string> = {
  employeur: "Employeur",
  travailleur: "Travailleur",
  contrat: "Contrat",
};

const GROUP_ORDER: ContractField["group"][] = ["employeur", "travailleur", "contrat"];

export function ContractBuilder({ initialValues }: ContractBuilderProps) {
  const [type, setType] = useState<ContractType>("cdi");
  const [regime, setRegime] = useState<WorkRegime>("temps_plein");
  const [values, setValues] = useState<Record<string, string>>(initialValues ?? {});
  const [optional, setOptional] = useState<string[]>([]);

  const setValue = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const toggleOptional = (id: string, checked: boolean) =>
    setOptional((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id),
    );

  const fields = useMemo(() => applicableFields(type), [type]);
  const clauses = useMemo(() => applicableOptionalClauses(type), [type]);
  const typeDef = useMemo(
    () => CONTRACT_TYPES.find((t) => t.type === type),
    [type],
  );

  const result = useMemo(
    () => generateContract({ type, regime, values, optionalClauseIds: optional }),
    [type, regime, values, optional],
  );

  const fieldsByGroup = useMemo(() => {
    const map = new Map<ContractField["group"], ContractField[]>();
    for (const f of fields) {
      const list = map.get(f.group) ?? [];
      list.push(f);
      map.set(f.group, list);
    }
    return map;
  }, [fields]);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(result.text);
      toast.success("Contrat copié dans le presse-papier.");
    } catch {
      toast.error("Impossible de copier (autorisez l'accès au presse-papier).");
    }
  }

  function download() {
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = result.title.replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim() || "contrat";
    a.download = `${safe}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function print() {
    window.print();
  }

  return (
    <div className="grid w-full gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ---------------------------- Formulaire ---------------------------- */}
      <div className="flex min-w-0 flex-col gap-4">
        {/* Type de contrat */}
        <Card>
          <CardHeader>
            <CardTitle>Type de contrat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {CONTRACT_TYPES.map((t) => {
                const active = t.type === type;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setType(t.type)}
                    aria-pressed={active}
                    className={cn(
                      "flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40",
                      active && "border-primary bg-primary/5",
                    )}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {t.label}
                      {t.writtenRequired ? (
                        <Badge variant="secondary" className="font-normal">
                          écrit obligatoire
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.description}</span>
                  </button>
                );
              })}
            </div>
            {typeDef?.note ? (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                {typeDef.note}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Régime */}
        <Card>
          <CardHeader>
            <CardTitle>Régime de travail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="inline-flex rounded-lg border border-border p-1">
              {(
                [
                  { value: "temps_plein", label: "Temps plein" },
                  { value: "temps_partiel", label: "Temps partiel" },
                ] as const
              ).map((r) => {
                const active = r.value === regime;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRegime(r.value)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Clauses optionnelles */}
        {clauses.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Clauses optionnelles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {clauses.map((c) => {
                const id = `clause-${c.id}`;
                const checked = optional.includes(c.id);
                return (
                  <label
                    key={c.id}
                    htmlFor={id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(value) => toggleOptional(c.id, value === true)}
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">{c.heading}</span>
                      {c.legalRef ? (
                        <span className="block text-xs text-muted-foreground">{c.legalRef}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        {/* Champs par groupe */}
        {GROUP_ORDER.map((group) => {
          const groupFields = fieldsByGroup.get(group);
          if (!groupFields || groupFields.length === 0) return null;
          return (
            <Card key={group}>
              <CardHeader>
                <CardTitle>{GROUP_LABELS[group]}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {groupFields.map((field) => (
                    <FieldInput
                      key={field.id}
                      field={field}
                      required={isFieldRequired(field, type, regime)}
                      value={values[field.id] ?? ""}
                      onChange={(v) => setValue(field.id, v)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ------------------------------ Aperçu ------------------------------ */}
      <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Aperçu du contrat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.missingRequired.length > 0 ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  Champs obligatoires à compléter
                </p>
                <p className="mt-0.5">
                  Le contrat reste généré avec des « …… » à compléter :
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                  {result.missingRequired.map((m) => (
                    <li key={m.id}>{m.label}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed text-foreground">
              {result.text}
            </pre>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                <Copy /> Copier
              </Button>
              <Button variant="outline" size="sm" onClick={download}>
                <Download /> Télécharger (.txt)
              </Button>
              <Button variant="outline" size="sm" onClick={print}>
                <Printer /> Imprimer
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>{CONTRACT_DISCLAIMER}</p>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  required,
  value,
  onChange,
}: {
  field: ContractField;
  required: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `contract-field-${field.id}`;
  const isTextarea = field.type === "textarea";
  return (
    <div className={cn("space-y-1.5", isTextarea && "sm:col-span-2")}>
      <Label htmlFor={id}>
        {field.label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {isTextarea ? (
        <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input
          id={id}
          type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
    </div>
  );
}
