"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Locale } from "@/lib/pdf-forms/types";

interface SettingsForm {
  title: string;
  description: string | null;
  issuer: string | null;
  organismeId: string | null;
  defaultLocale: Locale;
  locales: Locale[];
  allowDownload: boolean;
  allowDoccle: boolean;
  allowItsme: boolean;
}

interface OrganismeOption {
  id: string;
  name: string;
  shortName: string | null;
  color: string;
}

export function FormSettings({
  form,
  onChange,
}: {
  form: SettingsForm;
  onChange: (p: Partial<SettingsForm>) => void;
}) {
  const t = useTranslations("admin.pdf");
  const [organismes, setOrganismes] = useState<OrganismeOption[]>([]);

  // Charge la liste des organismes pour le sélecteur. Fail-soft : si l'API
  // n'est pas dispo, on laisse l'admin saisir un issuer libre.
  useEffect(() => {
    let active = true;
    fetch("/api/documents/organismes")
      .then((r) => (r.ok ? r.json() : []))
      .then((j: unknown) => {
        if (!active) return;
        const arr = Array.isArray(j) ? (j as OrganismeOption[]) : [];
        setOrganismes(arr.filter((o) => o && o.id && o.name));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function toggleLocale(l: Locale) {
    if (l === "fr") return;
    const next = form.locales.includes(l) ? form.locales.filter((x) => x !== l) : [...form.locales, l];
    onChange({ locales: next });
  }

  return (
    <Card>
      <CardContent className="grid gap-4 py-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("titleLabel")}</Label>
          <Input value={form.title} onChange={(e) => onChange({ title: e.target.value })} />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("issuerLabel")}</Label>
          {organismes.length > 0 ? (
            <Select
              value={form.organismeId ?? "__none__"}
              onValueChange={(v) => {
                const id = v === "__none__" ? null : v;
                const org = organismes.find((o) => o.id === id);
                onChange({
                  organismeId: id,
                  // Garde aussi `issuer` en miroir (compat fallback historique).
                  issuer: org ? org.shortName ?? org.name : null,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("noneDashed")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("noneDashed")}</SelectItem>
                {organismes.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.shortName ? `${o.shortName} — ${o.name}` : o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={form.issuer ?? ""}
              placeholder={t("issuerFreePlaceholder")}
              onChange={(e) => onChange({ issuer: e.target.value || null })}
            />
          )}
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">{t("descriptionLabel")}</Label>
          <Textarea rows={2} value={form.description ?? ""} onChange={(e) => onChange({ description: e.target.value || null })} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("availableLocales")}</Label>
          <div className="flex gap-3">
            {(["fr", "nl", "de"] as Locale[]).map((l) => (
              <label key={l} className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={form.locales.includes(l)} disabled={l === "fr"} onCheckedChange={() => toggleLocale(l)} />
                <span className="uppercase">{l}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">{t("deliveryModes")}</Label>
          <label className="flex items-center justify-between gap-2 text-sm">
            {t("deliveryDownload")}
            <Switch checked={form.allowDownload} onCheckedChange={(c) => onChange({ allowDownload: c })} />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            {t("deliveryDoccle")}
            <Switch checked={form.allowDoccle} onCheckedChange={(c) => onChange({ allowDoccle: c })} />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            {t("prefillItsme")}
            <Switch checked={form.allowItsme} onCheckedChange={(c) => onChange({ allowItsme: c })} />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
