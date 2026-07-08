"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCwIcon, Loader2Icon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { UseFormData } from "../use-form-data";

/// Onglet admin « Preview live » — Feature #7 des ameliorations post-plan
/// bindings-canonical-ux.
///
/// Iframe PDF a droite d'un editeur de payload (JSON monospace). Regen
/// automatique 500ms apres la derniere edition (schema OU payload) —
/// evite le download + open PDF apres chaque petit ajustement de champ.
///
/// Perf : les URL.createObjectURL sont revoques a chaque regen pour ne
/// pas fuiter en memoire (chaque PDF genere est de ~100kb - 1mb).
///
/// Fallback : si `test-generate` echoue (payload invalide, schema qui
/// throw), on garde le dernier PDF valide et on signale l'erreur au dessus
/// de l'iframe.
export function TabPreview({ data }: { data: UseFormData }) {
  const t = useTranslations("admin.pdf");
  const { form } = data;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payloadStr, setPayloadStr] = useState("{}");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const lastUrlRef = useRef<string | null>(null);

  // On memoise le hash JSON des fields pour ne debouncer que sur les
  // vraies modifications, pas sur chaque re-render.
  const fieldsHash = useMemo(
    () => (form ? JSON.stringify(form.fields ?? []) : ""),
    [form]
  );

  async function generate() {
    if (!form) return;
    let payload: unknown = {};
    if (payloadStr.trim()) {
      try {
        payload = JSON.parse(payloadStr);
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          setError(t("previewPayloadNotObject"));
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return;
      }
    }
    setError(null);
    const mySeq = ++seq.current;
    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/pdf/forms/${form.id}/test-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: form.fields, payload }),
      });
      if (mySeq !== seq.current) return; // reponse obsolete
      if (!res.ok) {
        setError(t("previewGenerateFail"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = url;
      setPdfUrl(url);
    } finally {
      if (mySeq === seq.current) setGenerating(false);
    }
  }

  // Auto-generate au mount + a chaque changement significatif (schema ou
  // payload), avec un debounce de 500ms.
  useEffect(() => {
    if (!autoRefresh || !form) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(generate, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldsHash, payloadStr, autoRefresh, form?.id]);

  // Cleanup final : revoque la derniere URL au demontage.
  useEffect(() => {
    return () => {
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
    };
  }, []);

  if (!form) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Colonne gauche : editeur payload + toggles + status */}
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t("previewHelp")}</p>
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>{t("previewAutoRefresh")}</span>
          </label>
          <div className="ml-auto flex items-center gap-2">
            {generating && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2Icon className="size-3 animate-spin" />
                {t("previewGenerating")}
              </span>
            )}
            <Button size="sm" variant="secondary" onClick={generate} disabled={generating}>
              {generating ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-4" />
              )}
              {t("previewRegenNow")}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("previewPayloadLabel")}</Label>
          <Textarea
            className="font-mono text-xs"
            rows={20}
            value={payloadStr}
            onChange={(e) => setPayloadStr(e.target.value)}
            placeholder='{"niss": "80.10.15-123.45"}'
          />
          {error && <span className="text-[11px] text-destructive">{error}</span>}
        </div>
      </div>

      {/* Colonne droite : iframe PDF */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">
          {t("previewIframeLabel", { title: form.title })}
        </Label>
        <div className="relative aspect-[210/297] w-full overflow-hidden rounded-lg border bg-muted/20">
          {pdfUrl ? (
            <iframe
              key={pdfUrl}
              src={pdfUrl}
              className="size-full"
              title={t("previewIframeLabel", { title: form.title })}
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <PlayIcon className="size-8 opacity-40" />
              <span>{t("previewEmpty")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
