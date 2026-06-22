"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, TrashIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { PdfFormTrigger } from "@/lib/pdf-forms/types";
import type { UseFormData } from "../use-form-data";

interface AvailableForm {
  slug: string;
  title: string;
}

/// Onglet « Déclencheurs » de l'éditeur PdfForm.
///
/// Permet à l'admin de configurer la liste de PdfFormTrigger d'un formulaire :
/// quand telle réponse est donnée (et éventuellement sous condition d'un
/// follow-up), un autre PdfForm (référencé par slug) est ajouté au parcours
/// utilisateur. Cf. lib/pdf-forms/triggers.ts pour l'évaluation runtime.
export function TabTriggers({ data }: { data: UseFormData }) {
  const t = useTranslations("admin.pdf");
  const { form, patchForm } = data;
  const [availableForms, setAvailableForms] = useState<AvailableForm[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/pdf/forms")
      .then((r) => (r.ok ? r.json() : []))
      .then((items: Array<{ slug: string; title: string }>) => {
        if (cancelled) return;
        setAvailableForms(items.map((i) => ({ slug: i.slug, title: i.title })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!form) return null;

  const triggers = form.triggers;

  async function persist(next: PdfFormTrigger[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pdf/forms/${form!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggers: next }),
      });
      if (!res.ok) return;
      patchForm({ triggers: next });
    } finally {
      setSaving(false);
    }
  }

  function addTrigger() {
    const next: PdfFormTrigger[] = [
      ...triggers,
      {
        whenFieldId: "",
        whenValue: "oui",
        requiresFormSlug: "",
      },
    ];
    void persist(next);
  }

  function updateTrigger(idx: number, patch: Partial<PdfFormTrigger>) {
    const next = triggers.map((tr, i) => (i === idx ? { ...tr, ...patch } : tr));
    void persist(next);
  }

  function removeTrigger(idx: number) {
    const next = triggers.filter((_, i) => i !== idx);
    void persist(next);
  }

  // Filtre les champs qui peuvent servir de déclencheur : tout sauf
  // signatures, fullname et types purement textuels libres. On garde radio,
  // select, checkbox, et text car les triggers peuvent matcher n'importe
  // quelle valeur.
  const fieldChoices = form.fields.map((f) => ({
    id: f.id,
    label: f.label?.fr || f.label?.nl || f.label?.de || f.id,
  }));

  // Slugs de tous les PdfForms — exclut le formulaire courant (un form ne
  // peut pas déclencher lui-même).
  const slugChoices = availableForms.filter((f) => f.slug !== form.slug);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-2 py-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 text-foreground">
            <ZapIcon className="size-4 text-amber-500" />
            <span className="font-medium">{t("triggersHeading")}</span>
          </div>
          <p>
            {t.rich("triggersIntro", {
              em: (chunks) => <em>{chunks}</em>,
              code: (chunks) => <code>{chunks}</code>,
            })}
          </p>
        </CardContent>
      </Card>

      {triggers.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {t("noTriggers")}
        </div>
      ) : (
        triggers.map((tr, idx) => (
          <Card key={idx}>
            <CardContent className="grid gap-3 py-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">{t("whenField")}</Label>
                <Select value={tr.whenFieldId || undefined} onValueChange={(v) => updateTrigger(idx, { whenFieldId: v ?? "" })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("chooseFieldPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldChoices.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}{" "}
                        <span className="text-xs text-muted-foreground">({f.id})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">{t("equalsLabel")}</Label>
                <Input
                  value={String(tr.whenValue)}
                  onChange={(e) => updateTrigger(idx, { whenValue: e.target.value })}
                  placeholder={t("valuePlaceholder")}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">{t("unlessField")}</Label>
                <Select
                  value={tr.unlessFieldId || "__none__"}
                  onValueChange={(v) => {
                    const safe = v ?? "__none__";
                    updateTrigger(idx, {
                      unlessFieldId: safe === "__none__" ? undefined : safe,
                      unlessValue: safe === "__none__" ? undefined : (tr.unlessValue ?? "oui"),
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("noneOption")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("noneDashed")}</SelectItem>
                    {fieldChoices.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}{" "}
                        <span className="text-xs text-muted-foreground">({f.id})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">{t("equalsLabel")}</Label>
                <Input
                  value={tr.unlessValue !== undefined ? String(tr.unlessValue) : ""}
                  onChange={(e) => updateTrigger(idx, { unlessValue: e.target.value })}
                  disabled={!tr.unlessFieldId}
                  placeholder={t("valuePlaceholder")}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label className="text-xs">{t("thenAddForm")}</Label>
                <Select
                  value={tr.requiresFormSlug || undefined}
                  onValueChange={(v) => updateTrigger(idx, { requiresFormSlug: v ?? "" })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("chooseFormPlaceholder")}>
                      {(v) => {
                        const match = slugChoices.find((s) => s.slug === v);
                        return match ? `${match.title} (${match.slug})` : v || t("chooseFormPlaceholder");
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {slugChoices.map((s) => (
                      <SelectItem key={s.slug} value={s.slug}>
                        {s.title}{" "}
                        <span className="text-xs text-muted-foreground">({s.slug})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label className="text-xs">{t("triggerReasonLabel")}</Label>
                <Input
                  value={tr.reason?.fr ?? ""}
                  onChange={(e) =>
                    updateTrigger(idx, {
                      reason: { ...(tr.reason ?? {}), fr: e.target.value },
                    })
                  }
                  placeholder={t("triggerReasonPlaceholder")}
                />
              </div>

              <div className="sm:col-span-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTrigger(idx)}
                  disabled={saving}
                  className="text-destructive hover:text-destructive"
                >
                  <TrashIcon className="size-4" />
                  {t("removeTrigger")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Button onClick={addTrigger} disabled={saving} variant="outline" className="self-start">
        <PlusIcon className="size-4" />
        {t("addTrigger")}
      </Button>
    </div>
  );
}
