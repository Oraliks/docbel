"use client";

import { ArrowLeft, FileCheck } from "lucide-react";
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-primary" />
          {lang === "nl" ? "Controleer uw informatie" : "Vérifiez vos informations"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border divide-y">
          {visibleFields.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {lang === "nl" ? "Geen gegevens ingevuld." : "Aucune donnée saisie."}
            </p>
          ) : (
            visibleFields.map((f) => {
              let display = "";
              const v = payload[f.id];
              if (v === null || v === undefined || v === "") {
                display = "—";
              } else if (f.type === "checkbox") {
                display = v ? (lang === "nl" ? "Ja" : "Oui") : lang === "nl" ? "Nee" : "Non";
              } else if (f.type === "select" && f.options) {
                const opt = f.options.find((o) => o.value === String(v));
                display = opt ? getOptionLabel(opt, lang) : String(v);
              } else {
                display = String(v);
              }
              return (
                <div key={f.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3">
                  <div className="text-sm font-medium">{getFieldLabel(f, lang)}</div>
                  <div className="sm:col-span-2 text-sm text-muted-foreground break-words">
                    {display}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={onBack} disabled={generating}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            {lang === "nl" ? "Wijzigen" : "Modifier"}
          </Button>
          <Button onClick={onConfirm} disabled={generating}>
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
