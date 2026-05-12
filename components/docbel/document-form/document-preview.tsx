"use client";

import { ArrowLeftIcon, FileCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DocumentField,
  GenerationPayload,
  Lang,
  getFieldLabel,
  getOptionLabel,
} from "@/lib/documents/types";
import { isFieldVisible } from "@/lib/documents/schema-zod";
import { GLASS_CARD, GLASS_PRIMARY_STYLE } from "@/lib/glass-classes";

interface DocumentPreviewProps {
  fields: DocumentField[];
  payload: GenerationPayload;
  onBack: () => void;
  onConfirm: () => void;
  generating: boolean;
  lang: Lang;
}

export function DocumentPreview({
  fields,
  payload,
  onBack,
  onConfirm,
  generating,
  lang,
}: DocumentPreviewProps) {
  const visibleFields = fields.filter((f) => isFieldVisible(f, payload));

  return (
    <Card className={GLASS_CARD}>
      <CardHeader className="px-7 pt-7 pb-3">
        <CardTitle className="glass-display flex items-center gap-2 text-[22px] font-semibold">
          <FileCheckIcon
            className="size-5"
            style={{ color: "var(--glass-accent-deep)" }}
          />
          {lang === "nl"
            ? "Controleer uw informatie"
            : "Vérifiez vos informations"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-7 pb-7">
        <div
          className="overflow-hidden rounded-2xl"
          style={{ background: "var(--glass-surface)" }}
        >
          {visibleFields.length === 0 ? (
            <p className="p-5 text-[13px] text-[color:var(--glass-ink-soft)]">
              {lang === "nl"
                ? "Geen gegevens ingevuld."
                : "Aucune donnée saisie."}
            </p>
          ) : (
            visibleFields.map((f, idx) => {
              let display = "";
              const v = payload[f.id];
              if (v === null || v === undefined || v === "") {
                display = "—";
              } else if (f.type === "checkbox") {
                display = v
                  ? lang === "nl"
                    ? "Ja"
                    : "Oui"
                  : lang === "nl"
                    ? "Nee"
                    : "Non";
              } else if (f.type === "select" && f.options) {
                const opt = f.options.find((o) => o.value === String(v));
                display = opt ? getOptionLabel(opt, lang) : String(v);
              } else {
                display = String(v);
              }
              return (
                <div
                  key={f.id}
                  className={`grid grid-cols-1 gap-2 p-3.5 sm:grid-cols-3 ${
                    idx < visibleFields.length - 1 ? "border-b" : ""
                  }`}
                  style={
                    idx < visibleFields.length - 1
                      ? { borderBottomColor: "var(--glass-ink-line)" }
                      : undefined
                  }
                >
                  <div className="text-[12.5px] font-bold text-[color:var(--glass-ink)]">
                    {getFieldLabel(f, lang)}
                  </div>
                  <div className="break-words text-[13px] text-[color:var(--glass-ink-soft)] sm:col-span-2">
                    {display}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={generating}
            className="rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            {lang === "nl" ? "Wijzigen" : "Modifier"}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={generating}
            className="rounded-full font-bold disabled:opacity-50"
            style={GLASS_PRIMARY_STYLE}
          >
            {generating
              ? lang === "nl"
                ? "Genereren…"
                : "Génération…"
              : lang === "nl"
                ? "Document genereren"
                : "Générer le document"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
