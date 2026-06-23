"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, Download, Loader2, Mail, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_CONFIG_LIST,
  DOCUMENT_CONFIGS,
  type DocumentField,
  type DocumentType,
  type DocumentValues,
} from "@/lib/employeur/documents/types";
import { buildDocumentText, documentTitle } from "@/lib/employeur/documents/render";
import { LegalDisclaimerBox } from "@/components/docbel/employeur/legal-disclaimer-box";

const SELECT_NONE = "_none";

export interface DocumentBuilderProps {
  /** Type initial sélectionné (par défaut la fiche travailleur). */
  initialType?: DocumentType;
  /** Préremplissage (ex. depuis un scénario d'engagement). */
  initialValues?: DocumentValues;
}

export function DocumentBuilder({ initialType, initialValues }: DocumentBuilderProps) {
  const t = useTranslations("public.pro");
  const router = useRouter();
  const [type, setType] = useState<DocumentType>(initialType ?? "fiche_travailleur");
  const [valuesByType, setValuesByType] = useState<Record<string, DocumentValues>>(() => ({
    [initialType ?? "fiche_travailleur"]: initialValues ?? {},
  }));
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const config = DOCUMENT_CONFIGS[type];
  const values = valuesByType[type] ?? {};

  const setValue = (key: string, value: string) =>
    setValuesByType((prev) => ({
      ...prev,
      [type]: { ...(prev[type] ?? {}), [key]: value },
    }));

  const bodyText = useMemo(() => buildDocumentText(type, values), [type, values]);
  const title = useMemo(() => documentTitle(type, values), [type, values]);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(bodyText);
      toast.success(t("docbuildCopied"));
    } catch {
      toast.error(t("docbuildCopyError"));
    }
  }

  function openInEmail() {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(bodyText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/employeur/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, content: values }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? t("docbuildErrShort"));
      toast.success(t("docbuildSaved"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("docbuildErrSave"));
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const res = await fetch("/api/employeur/documents/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, values }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? t("docbuildErrShort"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      // Libère l'URL après un court délai (l'onglet a eu le temps de la charger).
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("docbuildErrPdf"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("docbuildDocType")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={type}
            onValueChange={(v: string | null) => v && setType(v as DocumentType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_CONFIG_LIST.map((c) => (
                <SelectItem key={c.type} value={c.type}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("docbuildInfos")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {config.fields.map((field) => (
              <FieldInput
                key={field.key}
                field={field}
                value={values[field.key] ?? ""}
                onChange={(v) => setValue(field.key, v)}
              />
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("docbuildPreview")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
                {bodyText}
              </pre>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy /> {t("actCopy")}
                </Button>
                {config.emailable ? (
                  <Button variant="outline" size="sm" onClick={openInEmail}>
                    <Mail /> {t("docbuildOpenEmail")}
                  </Button>
                ) : null}
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />} {t("actSave")}
                </Button>
                <Button variant="outline" size="sm" onClick={exportPdf} disabled={exporting}>
                  {exporting ? <Loader2 className="animate-spin" /> : <Download />} {t("docbuildExportPdf")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <LegalDisclaimerBox context="document" />
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: DocumentField;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("public.pro");
  const id = `doc-field-${field.key}`;
  return (
    <div className={cn("space-y-1.5")}>
      <Label htmlFor={id}>{field.label}</Label>
      {field.type === "textarea" ? (
        <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "select" ? (
        <Select
          value={value === "" ? SELECT_NONE : value}
          onValueChange={(v: string | null) => {
            if (!v) return;
            onChange(v === SELECT_NONE ? "" : v);
          }}
        >
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SELECT_NONE}>{t("docbuildToPrecise")}</SelectItem>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={field.type === "date" ? "date" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
    </div>
  );
}
