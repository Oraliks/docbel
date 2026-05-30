"use client";

import { useState } from "react";
import { UploadCloudIcon, RefreshCwIcon, Loader2Icon, FileTextIcon, CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VersionDialog } from "../version-dialog";
import type { UseFormData } from "../use-form-data";

export function TabDocument({ data }: { data: UseFormData }) {
  const { form, busy, hasForeignAcroForm, reparse, load, loadIssues } = data;
  const [versionOpen, setVersionOpen] = useState(false);
  if (!form) return null;

  const techCount = (form.technicalSchema ?? []).length;
  const recap: { label: string; value: React.ReactNode }[] = [
    { label: "Pages", value: form.pageCount },
    { label: "AcroForm tiers", value: hasForeignAcroForm ? <Yes /> : <No /> },
    { label: "Champs techniques", value: techCount },
    { label: "Champs exposés", value: form.fields.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setVersionOpen(true)}>
          <UploadCloudIcon className="size-4" /> Remplacer le PDF
        </Button>
        <Button variant="outline" size="sm" onClick={reparse} disabled={busy === "reparse"}>
          {busy === "reparse" ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />} Ré-analyser
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 py-5 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
            <FileTextIcon className="size-4" />
            <span className="font-medium text-foreground">PDF source</span>
          </div>
          {recap.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-medium tabular-nums">{r.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        L&apos;aperçu et l&apos;édition des positions de champs se font dans l&apos;onglet Champs › Visuel.
      </p>

      <VersionDialog
        formId={form.id}
        open={versionOpen}
        onOpenChange={setVersionOpen}
        onApplied={() => { load(); loadIssues(); }}
      />
    </div>
  );
}

function Yes() {
  return (
    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
      <CheckIcon className="size-4" /> Oui
    </span>
  );
}
function No() {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <XIcon className="size-4" /> Non
    </span>
  );
}
