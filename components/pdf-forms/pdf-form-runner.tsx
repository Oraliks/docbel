"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { DownloadIcon, SendIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldGroup, FieldSet, FieldLegend } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { PdfField } from "./pdf-field";
import { buildValidator, isFieldVisible } from "@/lib/pdf-forms/validation";
import { sectionLabel } from "@/lib/pdf-forms/section-labels";
import { Locale, FieldValue, FormPayload, PdfFormField } from "@/lib/pdf-forms/types";
import type { PublicForm, PublicField } from "@/lib/pdf-forms/public-serializer";

const LOCALE_NAMES: Record<Locale, string> = { fr: "FR", nl: "NL", de: "DE" };

function defaultValues(form: PublicForm): FormPayload {
  const v: FormPayload = {};
  for (const f of form.fields) {
    if (f.defaultValue !== undefined) v[f.id] = f.defaultValue as FieldValue;
    else if (f.type === "checkbox") v[f.id] = false;
  }
  return v;
}

export function PdfFormRunner({ form }: { form: PublicForm }) {
  const [locale, setLocale] = useState<Locale>(form.defaultLocale);
  const [values, setValues] = useState<FormPayload>(() => defaultValues(form));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [delivery, setDelivery] = useState<"download" | "doccle">(
    form.allowDownload ? "download" : "doccle"
  );
  const [doccleRef, setDoccleRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { mode: "download" | "doccle" }>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Retour du flux itsme (?prefill=ok|error|unavailable).
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("prefill");
    if (!status) return;
    if (status === "ok") toast.success("Données itsme récupérées.");
    else if (status === "unavailable") toast.info("Pré-remplissage itsme bientôt disponible.");
    else toast.error("Échec du pré-remplissage itsme.");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // Charge un éventuel brouillon (best-effort, utilisateur connecté).
  useEffect(() => {
    let active = true;
    fetch(`/api/pdf/${form.slug}/draft`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.draft && typeof d.draft === "object") {
          setValues((prev) => ({ ...prev, ...(d.draft as FormPayload) }));
          toast.info("Brouillon restauré");
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [form.slug]);

  // Champs visibles (selon visibleIf), groupés par section dans l'ordre.
  const sections = useMemo(() => {
    const visible = form.fields.filter((f) => isFieldVisible(f.visibleIf, values));
    const groups: Array<{ key: string | undefined; fields: PublicField[] }> = [];
    for (const f of visible) {
      const last = groups[groups.length - 1];
      if (last && last.key === f.section) last.fields.push(f);
      else groups.push({ key: f.section, fields: [f] });
    }
    return groups;
  }, [form.fields, values]);

  const setValue = useCallback(
    (id: string, value: FieldValue) => {
      setValues((prev) => ({ ...prev, [id]: value }));
      setErrors((prev) => (prev[id] ? { ...prev, [id]: "" } : prev));
      // Autosave débounced (silencieux si non connecté).
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setValues((cur) => {
          fetch(`/api/pdf/${form.slug}/draft`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload: cur }),
          }).catch(() => {});
          return cur;
        });
      }, 1500);
    },
    [form.slug]
  );

  function validate(): boolean {
    const validator = buildValidator(form.fields as unknown as PdfFormField[], locale);
    const res = validator.safeParse(values);
    if (res.success) {
      setErrors({});
      return true;
    }
    const next: Record<string, string> = {};
    for (const issue of res.error.issues) {
      const id = String(issue.path[0] ?? "");
      if (id && !next[id]) next[id] = issue.message;
    }
    setErrors(next);
    const firstId = res.error.issues[0]?.path[0];
    if (firstId) document.getElementById(String(firstId))?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  async function submit() {
    if (!consent) {
      toast.error("Veuillez accepter le traitement de vos données.");
      return;
    }
    if (!validate()) {
      toast.error("Certains champs sont invalides.");
      return;
    }
    if (delivery === "doccle" && !doccleRef.trim()) {
      toast.error("Indiquez le destinataire Doccle.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/pdf/${form.slug}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: values,
          locale,
          delivery,
          consent: true,
          doccleRecipient: delivery === "doccle" ? { reference: doccleRef.trim() } : undefined,
        }),
      });

      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/pdf")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${form.slug}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        fetch(`/api/pdf/${form.slug}/draft`, { method: "DELETE" }).catch(() => {});
        setDone({ mode: "download" });
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.delivery === "doccle") {
        fetch(`/api/pdf/${form.slug}/draft`, { method: "DELETE" }).catch(() => {});
        setDone({ mode: "doccle" });
        return;
      }
      if (res.status === 422 && Array.isArray(data.issues)) {
        const next: Record<string, string> = {};
        for (const i of data.issues) if (i.field) next[i.field] = i.message;
        setErrors(next);
        toast.error("Validation échouée côté serveur.");
        return;
      }
      toast.error(data.error || "Échec de la génération.");
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2Icon className="size-10 text-primary" />
          <p className="text-sm text-muted-foreground">
            {done.mode === "download"
              ? "Votre document a été généré et téléchargé. Il n'est pas conservé sur nos serveurs."
              : "Votre document a été envoyé vers votre espace Doccle de façon sécurisée."}
          </p>
          <Button variant="outline" size="sm" onClick={() => setDone(null)}>
            Générer un autre document
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      {/* Sélecteur de langue (si plusieurs locales) */}
      {form.locales.length > 1 && (
        <div className="flex items-center gap-1.5">
          {form.locales.map((l) => (
            <Button
              key={l}
              size="sm"
              variant={l === locale ? "default" : "outline"}
              className="h-7 px-2.5"
              onClick={() => setLocale(l)}
            >
              {LOCALE_NAMES[l]}
            </Button>
          ))}
        </div>
      )}

      {/* Pré-remplissage itsme (si activé et configuré) */}
      {form.allowItsme && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => {
            window.location.href = `/api/pdf/${form.slug}/prefill/start`;
          }}
        >
          Pré-remplir avec itsme
        </Button>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        {sections.map((group, gi) => (
          <Card key={gi}>
            {group.key !== undefined && (
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {sectionLabel(group.key, locale)}
                </CardTitle>
              </CardHeader>
            )}
            <CardContent className="pt-5">
              <FieldGroup>
                {group.fields.map((f) => (
                  <PdfField
                    key={f.id}
                    field={f}
                    value={values[f.id] ?? ""}
                    error={errors[f.id]}
                    locale={locale}
                    onChange={(v) => setValue(f.id, v)}
                  />
                ))}
              </FieldGroup>
            </CardContent>
          </Card>
        ))}

        {/* Livraison + consentement + action */}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-5">
            {form.allowDownload && form.allowDoccle && (
              <FieldSet>
                <FieldLegend variant="label">Mode de réception</FieldLegend>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={delivery === "download" ? "default" : "outline"}
                    onClick={() => setDelivery("download")}
                  >
                    <DownloadIcon className="size-4" /> Télécharger
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={delivery === "doccle" ? "default" : "outline"}
                    onClick={() => setDelivery("doccle")}
                  >
                    <SendIcon className="size-4" /> Envoyer via Doccle
                  </Button>
                </div>
              </FieldSet>
            )}

            {delivery === "doccle" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doccle-ref">Destinataire Doccle</Label>
                <Input
                  id="doccle-ref"
                  value={doccleRef}
                  placeholder="NISS ou e-mail Doccle"
                  onChange={(e) => setDoccleRef(e.target.value)}
                />
              </div>
            )}

            <Separator />

            <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Checkbox checked={consent} onCheckedChange={(c) => setConsent(c === true)} className="mt-0.5" />
              <span>
                J&apos;accepte que mes données soient utilisées uniquement pour générer ce document.
                Le document n&apos;est pas conservé sur nos serveurs (RGPD).
              </span>
            </label>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : delivery === "doccle" ? (
                <SendIcon className="size-4" />
              ) : (
                <DownloadIcon className="size-4" />
              )}
              {submitting ? "Génération…" : delivery === "doccle" ? "Envoyer le document" : "Générer le document"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
