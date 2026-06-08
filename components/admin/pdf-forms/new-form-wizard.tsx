"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, CheckIcon, XIcon, ArrowLeftIcon, ArrowRightIcon, FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Locale } from "@/lib/pdf-forms/types";
import { useFormData } from "./use-form-data";
import { FormSettings } from "./form-settings";
import { TabChamps } from "./tabs/tab-champs";
import { TabPublication } from "./tabs/tab-publication";
import { WizardSteps } from "./wizard-steps";

const STEP_LABELS = ["PDF source", "Champs", "Paramètres", "Publication"];

interface CreatedRecap {
  id: string;
  hasAcroForm: boolean;
  pageCount: number;
  fieldCount: number;
}

export function NewFormWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetSource = searchParams.get("source");
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState<CreatedRecap | null>(null);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        <button onClick={() => router.push("/admin/pdf")} className="text-sm text-muted-foreground hover:text-foreground">← Formulaires</button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">Nouveau formulaire</span>
      </div>

      <WizardSteps steps={STEP_LABELS} current={step} />

      {step === 0 ? (
        <SourceStep
          presetSource={presetSource}
          created={created}
          onCreated={(c) => setCreated(c)}
          onNext={() => setStep(1)}
        />
      ) : created ? (
        <ConfigureSteps
          formId={created.id}
          step={step}
          onPrev={() => setStep((s) => s - 1)}
          onNext={() => setStep((s) => Math.min(3, s + 1))}
          onFinish={() => router.push(`/admin/pdf/${created.id}`)}
        />
      ) : null}
    </div>
  );
}

function SourceStep({
  presetSource,
  created, onCreated, onNext,
}: {
  /// Si fourni (via ?source=…), le wizard utilise une source déjà déposée
  /// dans private/pdfs/ au lieu d'un upload manuel.
  presetSource: string | null;
  created: CreatedRecap | null;
  onCreated: (c: CreatedRecap) => void;
  onNext: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(presetSource ? presetSource.replace(/\.pdf$/i, "") : "");
  const [issuer, setIssuer] = useState("");
  const [locales, setLocales] = useState<Locale[]>(["fr"]);
  const [submitting, setSubmitting] = useState(false);

  function toggleLocale(l: Locale) {
    if (l === "fr") return; // FR toujours présent
    setLocales((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  }

  async function submit() {
    if (!presetSource && !file) {
      toast.error("Sélectionnez un PDF.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (presetSource) {
        fd.set("sourceFile", presetSource);
      } else if (file) {
        fd.set("file", file);
      }
      if (title.trim()) fd.set("title", title.trim());
      if (issuer.trim()) fd.set("issuer", issuer.trim());
      fd.set("locales", locales.join(","));
      const res = await fetch("/api/admin/pdf/forms", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || "Échec de l'import."); return; }
      toast.success("Formulaire créé. Champs détectés automatiquement.");
      onCreated({
        id: data.id,
        hasAcroForm: !!data.hasAcroForm,
        pageCount: data.pageCount ?? 0,
        fieldCount: data.fieldCount ?? 0,
      });
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          {presetSource ? (
            <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3 text-sm">
              <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col gap-0.5">
                <p>
                  Source pré-sélectionnée : <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">{presetSource}</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  Le PDF est déjà déposé dans <code>private/pdfs/</code>. Aucun upload nécessaire.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Importez un PDF officiel <strong>à champs (AcroForm)</strong> ou plat. Les champs sont extraits et pré-enrichis.
            </p>
          )}
          {!presetSource && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pdf-file">Fichier PDF</Label>
              <Input id="pdf-file" type="file" accept="application/pdf" disabled={!!created} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pdf-title">Titre (optionnel)</Label>
            <Input id="pdf-title" value={title} placeholder="Déduit du nom du fichier" disabled={!!created} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pdf-issuer">Organisme (optionnel)</Label>
            <Input id="pdf-issuer" value={issuer} placeholder="ONEM, CPAS…" disabled={!!created} onChange={(e) => setIssuer(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Langues disponibles</Label>
            <div className="flex gap-3">
              {(["fr", "nl", "de"] as Locale[]).map((l) => (
                <label key={l} className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={locales.includes(l)} disabled={l === "fr" || !!created} onCheckedChange={() => toggleLocale(l)} />
                  <span className="uppercase">{l}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {created && (
        <Card>
          <CardContent className="grid gap-2 py-4 text-sm sm:grid-cols-3">
            <Recap label="AcroForm" value={created.hasAcroForm ? <Yes /> : <No />} />
            <Recap label="Pages" value={created.pageCount} />
            <Recap label="Champs détectés" value={created.fieldCount} />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        {!created ? (
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2Icon className="size-4 animate-spin" />} Importer &amp; analyser
          </Button>
        ) : (
          <Button onClick={onNext}>
            Suivant <ArrowRightIcon className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/// Étapes 2-4 : montées seulement après création (id stable) pour appeler le
/// hook une seule fois et réutiliser les mêmes composants que l'édition.
function ConfigureSteps({
  formId, step, onPrev, onNext, onFinish,
}: {
  formId: string;
  step: number;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const data = useFormData(formId);
  const { form, save, saving } = data;

  if (!form) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="flex flex-col gap-6">
      {step === 1 && <TabChamps data={data} />}
      {step === 2 && <FormSettings form={form} onChange={data.patchForm} />}
      {step === 3 && <TabPublication data={data} />}

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={onPrev}>
          <ArrowLeftIcon className="size-4" /> Précédent
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={save} disabled={saving}>
            {saving && <Loader2Icon className="size-4 animate-spin" />} Enregistrer
          </Button>
          {step < 3 ? (
            <Button onClick={onNext}>
              Suivant <ArrowRightIcon className="size-4" />
            </Button>
          ) : (
            <Button onClick={onFinish}>
              Terminer <CheckIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Recap({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
function Yes() {
  return <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckIcon className="size-4" /> Oui</span>;
}
function No() {
  return <span className="inline-flex items-center gap-1 text-muted-foreground"><XIcon className="size-4" /> Non</span>;
}
