"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UploadCloudIcon, RefreshCwIcon, Loader2Icon, FileTextIcon, CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VersionDialog } from "../version-dialog";
import type { UseFormData } from "../use-form-data";

export function TabDocument({ data }: { data: UseFormData }) {
  const t = useTranslations("admin.pdf");
  const { form, busy, hasForeignAcroForm, reparse, load, loadIssues } = data;
  const [versionOpen, setVersionOpen] = useState(false);
  if (!form) return null;

  const techCount = (form.technicalSchema ?? []).length;
  const recap: { label: string; value: React.ReactNode }[] = [
    { label: t("recapPages"), value: form.pageCount },
    { label: t("recapForeignAcroForm"), value: hasForeignAcroForm ? <Yes /> : <No /> },
    { label: t("recapTechFields"), value: techCount },
    { label: t("recapExposedFields"), value: form.fields.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setVersionOpen(true)}>
          <UploadCloudIcon className="size-4" /> {t("replacePdf")}
        </Button>
        <Button variant="outline" size="sm" onClick={reparse} disabled={busy === "reparse"}>
          {busy === "reparse" ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />} {t("reparse")}
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 py-5 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
            <FileTextIcon className="size-4" />
            <span className="font-medium text-foreground">{t("sourcePdf")}</span>
          </div>
          {recap.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-medium tabular-nums">{r.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{t("fieldPositionsHint")}</p>

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
  const t = useTranslations("admin.pdf");
  return (
    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
      <CheckIcon className="size-4" /> {t("yes")}
    </span>
  );
}
function No() {
  const t = useTranslations("admin.pdf");
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <XIcon className="size-4" /> {t("no")}
    </span>
  );
}
