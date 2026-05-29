"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Locale } from "@/lib/pdf-forms/types";

interface SettingsForm {
  title: string;
  description: string | null;
  issuer: string | null;
  defaultLocale: Locale;
  locales: Locale[];
  allowDownload: boolean;
  allowDoccle: boolean;
  allowItsme: boolean;
}

export function FormSettings({
  form, onChange,
}: {
  form: SettingsForm;
  onChange: (p: Partial<SettingsForm>) => void;
}) {
  function toggleLocale(l: Locale) {
    if (l === "fr") return;
    const next = form.locales.includes(l) ? form.locales.filter((x) => x !== l) : [...form.locales, l];
    onChange({ locales: next });
  }

  return (
    <Card>
      <CardContent className="grid gap-4 py-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Titre</Label>
          <Input value={form.title} onChange={(e) => onChange({ title: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Organisme</Label>
          <Input value={form.issuer ?? ""} placeholder="ONEM, CPAS…" onChange={(e) => onChange({ issuer: e.target.value || null })} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Description</Label>
          <Textarea rows={2} value={form.description ?? ""} onChange={(e) => onChange({ description: e.target.value || null })} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Langues disponibles</Label>
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
          <Label className="text-xs text-muted-foreground">Modes de réception</Label>
          <label className="flex items-center justify-between gap-2 text-sm">
            Téléchargement direct
            <Switch checked={form.allowDownload} onCheckedChange={(c) => onChange({ allowDownload: c })} />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            Envoi via Doccle
            <Switch checked={form.allowDoccle} onCheckedChange={(c) => onChange({ allowDoccle: c })} />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            Pré-remplissage itsme
            <Switch checked={form.allowItsme} onCheckedChange={(c) => onChange({ allowItsme: c })} />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
