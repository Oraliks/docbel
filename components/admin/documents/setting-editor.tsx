"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Save, RotateCcw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Field {
  key: string;
  label: string;
  description?: string;
  type: "textarea" | "input";
  rows?: number;
  placeholders?: { token: string; description: string }[];
}

interface SettingEditorProps {
  title: string;
  subtitle: string;
  backHref: string;
  fields: Field[];
}

interface FieldState {
  value: string;
  defaultValue: string;
  loaded: boolean;
}

export function SettingEditor({ title, subtitle, backHref, fields }: SettingEditorProps) {
  const [state, setState] = useState<Record<string, FieldState>>(
    Object.fromEntries(fields.map((f) => [f.key, { value: "", defaultValue: "", loaded: false }]))
  );
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    fields.forEach(async (f) => {
      try {
        const res = await fetch(`/api/admin/settings/${f.key}`);
        if (!res.ok) throw new Error("Erreur de chargement");
        const data = await res.json();
        setState((s) => ({
          ...s,
          [f.key]: {
            value: data.value,
            defaultValue: data.default,
            loaded: true,
          },
        }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur de chargement");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(key: string, value: string) {
    setState((s) => ({ ...s, [key]: { ...s[key], value } }));
  }

  function resetToDefault(key: string) {
    if (!confirm("Restaurer le texte par défaut ? Vos modifications non sauvegardées seront perdues.")) {
      return;
    }
    setState((s) => ({ ...s, [key]: { ...s[key], value: s[key].defaultValue } }));
  }

  async function save() {
    setSaving(true);
    try {
      for (const f of fields) {
        const res = await fetch(`/api/admin/settings/${f.key}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: state[f.key].value }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Erreur sur ${f.label}`);
        }
      }
      toast.success("Paramètres sauvegardés");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  const allLoaded = fields.every((f) => state[f.key]?.loaded);

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-3">
        <Button render={<Link href={backHref} />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>

      {!allLoaded ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Chargement…</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Tabs horizontaux custom */}
          <div className="flex flex-wrap gap-1 border-b">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "edit"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="w-4 h-4" />
              Éditer
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "preview"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <EyeOff className="w-4 h-4" />
              Aperçu
            </button>
          </div>

          {activeTab === "edit" && (
            <div className="space-y-4">
              {fields.map((f) => (
                <Card key={f.key}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{f.label}</CardTitle>
                        {f.description && <CardDescription>{f.description}</CardDescription>}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => resetToDefault(f.key)}
                        title="Restaurer le texte par défaut"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Défaut
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {f.placeholders && f.placeholders.length > 0 && (
                      <Alert>
                        <AlertDescription>
                          <p className="text-xs font-medium mb-1.5">
                            Variables utilisables (remplacées à l&apos;envoi) :
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {f.placeholders.map((p) => (
                              <span
                                key={p.token}
                                className="inline-flex items-center gap-1 text-xs"
                                title={p.description}
                              >
                                <code className="px-1.5 py-0.5 rounded bg-muted font-mono">
                                  {p.token}
                                </code>
                                <span className="text-muted-foreground">{p.description}</span>
                              </span>
                            ))}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                    <div>
                      <Label htmlFor={`field-${f.key}`} className="sr-only">
                        {f.label}
                      </Label>
                      {f.type === "textarea" ? (
                        <Textarea
                          id={`field-${f.key}`}
                          value={state[f.key].value}
                          onChange={(e) => update(f.key, e.target.value)}
                          rows={f.rows || 8}
                          className="font-mono text-sm"
                        />
                      ) : (
                        <Input
                          id={`field-${f.key}`}
                          value={state[f.key].value}
                          onChange={(e) => update(f.key, e.target.value)}
                        />
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {state[f.key].value.length} caractères
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeTab === "preview" && (
            <div className="space-y-4">
              {fields.map((f) => (
                <Card key={f.key}>
                  <CardHeader>
                    <CardTitle className="text-base">{f.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border bg-muted/30 p-4">
                      <p className="text-sm whitespace-pre-line">{state[f.key].value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 sticky bottom-0 bg-background/95 backdrop-blur py-3 border-t">
        <Button render={<Link href={backHref} />} variant="outline">
          Annuler
        </Button>
        <Button onClick={save} disabled={saving || !allLoaded}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Sauvegarde…" : "Sauvegarder"}
        </Button>
      </div>
    </div>
  );
}
