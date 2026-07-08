"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  SaveIcon, UploadCloudIcon, FileDownIcon, HistoryIcon,
  CheckCircle2Icon, Loader2Icon, ExternalLinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FormSettings } from "./form-settings";
import { VersionDialog } from "./version-dialog";
import { RevisionsDialog } from "./revisions-dialog";
import { useFormData } from "./use-form-data";
import { TabChamps } from "./tabs/tab-champs";
import { TabDocument } from "./tabs/tab-document";
import { TabPublication } from "./tabs/tab-publication";
import { TabTriggers } from "./tabs/tab-triggers";
import { TabMapping } from "./tabs/tab-mapping";
import { TabFixtures } from "./tabs/tab-fixtures";
import { SeedDiffBanner } from "./seed-diff-banner";

const TABS = ["champs", "document", "parametres", "declencheurs", "mapping", "fixtures", "publication"] as const;
type TabValue = (typeof TABS)[number];

export function PdfFormEditor({ formId }: { formId: string }) {
  const t = useTranslations("admin.pdf");
  const router = useRouter();
  const searchParams = useSearchParams();
  const data = useFormData(formId);
  const { form, issues, saving, busy, save, publish, unpublish, testPdf, patchForm, load, loadIssues } = data;
  const [versionOpen, setVersionOpen] = useState(false);
  const [revsOpen, setRevsOpen] = useState(false);

  const tabParam = searchParams.get("tab");
  const activeTab: TabValue = (TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as TabValue)
    : "champs";

  function onTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "champs") params.delete("tab");
    else params.set("tab", value);
    const qs = params.toString();
    router.push(`/admin/pdf/${formId}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  if (!form) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const errors = issues.filter((i) => i.level === "error");
  const publishDisabled = busy === "publish" || errors.length > 0;
  const publishReason =
    errors.length > 0
      ? t("publishReasonErrorsTab", { count: errors.length })
      : form.fields.length === 0
      ? t("publishReasonNoFields")
      : t("publishReasonReady");

  return (
    <div className="p-6">
      {/* Barre d'action persistante : indépendante de l'onglet courant. */}
      <div className="sticky top-0 z-30 -mx-6 flex flex-wrap items-center gap-2 border-b bg-background/95 px-6 py-3 backdrop-blur">
        <div className="mr-auto flex items-center gap-2">
          <button onClick={() => router.push("/admin/pdf")} className="text-sm text-muted-foreground hover:text-foreground">← {t("breadcrumbForms")}</button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{form.title}</span>
          <Badge variant={form.status === "published" ? "default" : "secondary"}>
            {t("status", { status: form.status })}
          </Badge>
          <span className="text-xs text-muted-foreground">v{form.version}</span>
          {form.status === "published" && (
            <a href={`/document/${form.slug}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
              <ExternalLinkIcon className="size-4" />
            </a>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={testPdf} disabled={busy === "test"}>
          {busy === "test" ? <Loader2Icon className="size-4 animate-spin" /> : <FileDownIcon className="size-4" />} {t("testPdf")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setRevsOpen(true)}><HistoryIcon className="size-4" /> {t("history")}</Button>
        <Button variant="outline" size="sm" onClick={() => setVersionOpen(true)}><UploadCloudIcon className="size-4" /> {t("replacePdf")}</Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />} {t("save")}
        </Button>
        {form.status === "published" ? (
          <Button variant="secondary" size="sm" onClick={unpublish} disabled={busy === "unpublish"}>{t("unpublish")}</Button>
        ) : (
          <Tooltip>
            {/* Un <button disabled> ne déclenche pas les events souris, donc le
                tooltip ne s'afficherait pas. On enveloppe d'un span focusable
                pour exposer l'explication même bouton désactivé. */}
            <TooltipTrigger render={<span tabIndex={publishDisabled ? 0 : -1} className="inline-flex" />}>
              <Button size="sm" onClick={publish} disabled={publishDisabled}>
                {busy === "publish" ? <Loader2Icon className="size-4 animate-spin" /> : <CheckCircle2Icon className="size-4" />} {t("publish")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{publishReason}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Banner "sync requis" si la DB derive du seed source. Se cache
          silencieusement quand tout est aligne ou quand le form n'a pas
          de seed. Cf. Feature #3 des ameliorations post-plan bindings. */}
      <SeedDiffBanner formId={formId} refreshKey={form.version} onSynced={load} />

      <Tabs value={activeTab} onValueChange={onTabChange} className="mt-4 w-full">
        {/* Rangée de tabs collante sous la barre d'action (py-3 + bordure ≈ 56px). */}
        <TabsList variant="line" className="sticky top-14 z-20 -mx-6 w-auto justify-start rounded-none border-b bg-background/95 px-6 py-2 backdrop-blur">
          <TabsTrigger value="champs">{t("tabFields")}</TabsTrigger>
          <TabsTrigger value="document">{t("tabDocument")}</TabsTrigger>
          <TabsTrigger value="parametres">{t("tabSettings")}</TabsTrigger>
          <TabsTrigger value="declencheurs">{t("tabTriggers")}</TabsTrigger>
          <TabsTrigger value="mapping">{t("tabMapping")}</TabsTrigger>
          <TabsTrigger value="fixtures">{t("tabFixtures")}</TabsTrigger>
          <TabsTrigger value="publication">{t("tabPublication")}</TabsTrigger>
        </TabsList>

        <TabsContent value="champs" className="pt-4">
          <TabChamps data={data} />
        </TabsContent>
        <TabsContent value="document" className="pt-4">
          <TabDocument data={data} />
        </TabsContent>
        <TabsContent value="parametres" className="pt-4">
          <FormSettings form={form} onChange={patchForm} />
        </TabsContent>
        <TabsContent value="declencheurs" className="pt-4">
          <TabTriggers data={data} />
        </TabsContent>
        <TabsContent value="mapping" className="pt-4">
          <TabMapping data={data} />
        </TabsContent>
        <TabsContent value="fixtures" className="pt-4">
          <TabFixtures data={data} />
        </TabsContent>
        <TabsContent value="publication" className="pt-4">
          <TabPublication data={data} />
        </TabsContent>
      </Tabs>

      <VersionDialog
        formId={formId}
        open={versionOpen}
        onOpenChange={setVersionOpen}
        onApplied={() => { load(); loadIssues(); }}
      />
      <RevisionsDialog
        formId={formId}
        open={revsOpen}
        onOpenChange={setRevsOpen}
        onRestored={() => { load(); loadIssues(); }}
      />
    </div>
  );
}
