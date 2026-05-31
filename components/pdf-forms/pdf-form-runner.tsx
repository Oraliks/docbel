"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  DownloadIcon,
  SendIcon,
  CheckCircle2Icon,
  Loader2Icon,
  FileTextIcon,
  PenLineIcon,
  EyeIcon,
  UserIcon,
  InfoIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PdfField } from "./pdf-field";
import { buildValidator, isFieldVisible } from "@/lib/pdf-forms/validation";
import { sectionLabel } from "@/lib/pdf-forms/section-labels";
import { Locale, FieldValue, FormPayload, PdfFormField, loc } from "@/lib/pdf-forms/types";
import { todayISO } from "@/lib/pdf-forms/system-values";
import type { PublicForm, PublicField } from "@/lib/pdf-forms/public-serializer";

const LOCALE_NAMES: Record<Locale, string> = { fr: "FR", nl: "NL", de: "DE" };

// Types de champ qui occupent toute la largeur dans la grille 2 colonnes.
const FULL_WIDTH_TYPES = new Set(["textarea", "signature", "fullname", "checkbox", "radio"]);

function defaultValues(form: PublicForm, bundlePrefill?: Record<string, string>): FormPayload {
  const v: FormPayload = {};
  for (const f of form.fields) {
    if (bundlePrefill && bundlePrefill[f.id] !== undefined && bundlePrefill[f.id] !== "") {
      v[f.id] = bundlePrefill[f.id];
    } else if (f.prefillFrom === "system.today") v[f.id] = todayISO();
    else if (f.defaultValue !== undefined) v[f.id] = f.defaultValue as FieldValue;
    else if (f.type === "checkbox") v[f.id] = false;
    else if (f.type === "fullname") v[f.id] = { first: "", last: "" };
    else if (f.type === "signature") v[f.id] = "";
  }
  return v;
}

type Step =
  | { kind: "fields"; id: string; title: string; subtitle: string; fields: PublicField[] }
  | { kind: "signature"; id: string; title: string; subtitle: string; fields: PublicField[] }
  | { kind: "summary"; id: string; title: string; subtitle: string };

interface PdfFormRunnerProps {
  form: PublicForm;
  bundlePrefill?: Record<string, string>;
  bundleRunId?: string;
  onValuesChange?: (values: FormPayload) => void;
  onLocaleChange?: (locale: Locale) => void;
}

export function PdfFormRunner({ form, bundlePrefill, bundleRunId, onValuesChange, onLocaleChange }: PdfFormRunnerProps) {
  const [locale, setLocale] = useState<Locale>(form.defaultLocale);
  const [values, setValues] = useState<FormPayload>(() => defaultValues(form, bundlePrefill));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [delivery, setDelivery] = useState<"download" | "doccle">(form.allowDownload ? "download" : "doccle");
  const [doccleRef, setDoccleRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { mode: "download" | "doccle" }>(null);
  const [active, setActive] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onValuesChange?.(values); }, [values, onValuesChange]);
  useEffect(() => { onLocaleChange?.(locale); }, [locale, onLocaleChange]);

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
    let act = true;
    fetch(`/api/pdf/${form.slug}/draft`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (act && d?.draft && typeof d.draft === "object") {
          setValues((prev) => ({ ...prev, ...(d.draft as FormPayload) }));
          toast.info("Brouillon restauré");
        }
      })
      .catch(() => {});
    return () => { act = false; };
  }, [form.slug]);

  // ----- Construction des étapes (tabs) -----
  // Champs data (hors signature) groupés par section → une étape par section.
  // Puis une étape "Signature" si le form a des champs signature, puis "Résumé".
  const steps = useMemo<Step[]>(() => {
    const visible = form.fields.filter((f) => isFieldVisible(f.visibleIf, values));
    const dataFields = visible.filter((f) => f.type !== "signature");
    const signatureFields = visible.filter((f) => f.type === "signature");

    const groups: Array<{ key: string | undefined; fields: PublicField[] }> = [];
    for (const f of dataFields) {
      const last = groups[groups.length - 1];
      if (last && last.key === f.section) last.fields.push(f);
      else groups.push({ key: f.section, fields: [f] });
    }

    const out: Step[] = [];
    if (groups.length === 0) {
      out.push({ kind: "fields", id: "informations", title: "Informations", subtitle: "Renseignez les informations", fields: [] });
    } else {
      groups.forEach((g, i) => {
        out.push({
          kind: "fields",
          id: g.key ?? `section-${i}`,
          title: g.key ? sectionLabel(g.key, locale) : "Informations",
          subtitle: "Renseignez les informations",
          fields: g.fields,
        });
      });
    }
    if (signatureFields.length) {
      out.push({ kind: "signature", id: "signature", title: "Signature", subtitle: "Signer le document", fields: signatureFields });
    }
    out.push({ kind: "summary", id: "summary", title: "Résumé", subtitle: "Prévisualiser le document" });
    return out;
  }, [form.fields, values, locale]);

  // Clamp dérivé (le nombre d'étapes peut diminuer via visibleIf).
  const activeIndex = Math.min(active, steps.length - 1);

  // Map champ → index d'étape (pour sauter sur la 1ʳᵉ erreur).
  const fieldStepIndex = useMemo(() => {
    const m: Record<string, number> = {};
    steps.forEach((s, i) => {
      if (s.kind === "fields" || s.kind === "signature") s.fields.forEach((f) => (m[f.id] = i));
    });
    return m;
  }, [steps]);

  const setValue = useCallback(
    (id: string, value: FieldValue) => {
      setValues((prev) => ({ ...prev, [id]: value }));
      setErrors((prev) => (prev[id] ? { ...prev, [id]: "" } : prev));
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
    // Saute vers l'étape contenant la 1ʳᵉ erreur, puis scroll.
    const firstId = String(res.error.issues[0]?.path[0] ?? "");
    if (firstId) {
      const stepIdx = fieldStepIndex[firstId];
      if (stepIdx !== undefined) setActive(stepIdx);
      setTimeout(() => document.getElementById(firstId)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    }
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
          bundleRunId,
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
      <Card className="rounded-2xl border-0 bg-white shadow-sm dark:bg-card">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2Icon className="size-10 text-primary" />
          <p className="text-sm text-muted-foreground">
            {done.mode === "download"
              ? "Votre document a été généré et téléchargé. Il n'est pas conservé sur nos serveurs."
              : "Votre document a été envoyé vers votre espace Doccle de façon sécurisée."}
          </p>
          <Button variant="outline" size="sm" onClick={() => { setDone(null); setActive(0); }}>
            Générer un autre document
          </Button>
        </CardContent>
      </Card>
    );
  }

  const current = steps[activeIndex];
  const stepHasError = (s: Step) =>
    (s.kind === "fields" || s.kind === "signature") && s.fields.some((f) => errors[f.id]);

  const stepIcon = (s: Step, i: number) => {
    if (s.kind === "signature") return <PenLineIcon className="size-4" />;
    if (s.kind === "summary") return <EyeIcon className="size-4" />;
    return i === 0 ? <UserIcon className="size-4" /> : <FileTextIcon className="size-4" />;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Barre langue + itsme (au-dessus de la carte) */}
      {(form.locales.length > 1 || form.allowItsme) && (
        <div className="flex flex-wrap items-center gap-2">
          {form.locales.length > 1 &&
            form.locales.map((l) => (
              <Button key={l} size="sm" variant={l === locale ? "default" : "outline"} className="h-7 px-2.5" onClick={() => setLocale(l)}>
                {LOCALE_NAMES[l]}
              </Button>
            ))}
          {form.allowItsme && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => { window.location.href = `/api/pdf/${form.slug}/prefill/start`; }}
            >
              Pré-remplir avec itsme
            </Button>
          )}
        </div>
      )}

      {/* Carte blanche contenant les tabs + le contenu de l'étape */}
      <Card className="overflow-hidden rounded-2xl border-0 bg-white shadow-sm dark:bg-card">
        {/* Barre de tabs */}
        <div className="flex overflow-x-auto border-b">
          {steps.map((s, i) => {
            const activeTab = i === activeIndex;
            const err = stepHasError(s);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(i)}
                className={`flex min-w-[150px] flex-1 items-center gap-2.5 border-b-2 px-4 py-3.5 text-left transition-colors ${
                  activeTab
                    ? "border-[color:var(--glass-accent-deep,#7c3aed)] text-[color:var(--glass-accent-deep,#7c3aed)]"
                    : "border-transparent text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                    activeTab ? "bg-[color:var(--glass-pop-bg,#efe6ff)]" : "bg-muted"
                  }`}
                >
                  {stepIcon(s, i)}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {s.title}
                    {err && <span className="size-1.5 rounded-full bg-destructive" aria-label="erreurs" />}
                  </span>
                  <span className="truncate text-[11px] font-normal text-muted-foreground">{s.subtitle}</span>
                </span>
              </button>
            );
          })}
        </div>

        <CardContent className="p-5 sm:p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (current.kind === "summary") submit();
            }}
            className="flex flex-col gap-5"
          >
            {/* En-tête d'étape */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-semibold">{current.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {current.kind === "summary"
                    ? "Vérifiez puis générez votre document."
                    : current.kind === "signature"
                    ? "Signez dans le cadre ci-dessous."
                    : "Renseignez les informations nécessaires pour générer le document."}
                </p>
              </div>
              {current.kind === "fields" && current.fields.length > 0 && (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                  <InfoIcon className="size-3" />
                  {current.fields.every((f) => f.required) ? "Tous les champs sont requis" : "Les champs * sont requis"}
                </span>
              )}
            </div>

            {/* Contenu : champs (grille 2 col) ou résumé */}
            {current.kind !== "summary" ? (
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                {current.fields.map((f) => (
                  <div key={f.id} className={FULL_WIDTH_TYPES.has(f.type) ? "sm:col-span-2" : ""}>
                    <PdfField
                      field={f}
                      value={values[f.id] ?? ""}
                      error={errors[f.id]}
                      locale={locale}
                      onChange={(v) => setValue(f.id, v)}
                      formId={form.id}
                      formSlug={form.slug}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <SummaryStep form={form} values={values} locale={locale} />
            )}

            {/* Pied d'étape */}
            {current.kind === "summary" ? (
              <div className="flex flex-col gap-4">
                {form.allowDownload && form.allowDoccle && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Mode de réception</span>
                    <div className="flex gap-1.5">
                      <Button type="button" size="sm" variant={delivery === "download" ? "default" : "outline"} onClick={() => setDelivery("download")}>
                        <DownloadIcon className="size-4" /> Télécharger
                      </Button>
                      <Button type="button" size="sm" variant={delivery === "doccle" ? "default" : "outline"} onClick={() => setDelivery("doccle")}>
                        <SendIcon className="size-4" /> Envoyer via Doccle
                      </Button>
                    </div>
                  </div>
                )}
                {delivery === "doccle" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="doccle-ref">Destinataire Doccle</Label>
                    <Input id="doccle-ref" value={doccleRef} placeholder="NISS ou e-mail Doccle" onChange={(e) => setDoccleRef(e.target.value)} />
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
                <div className="flex items-center gap-2">
                  {activeIndex > 0 && (
                    <Button type="button" variant="outline" onClick={() => setActive(activeIndex - 1)}>
                      <ChevronLeftIcon className="size-4" /> Précédent
                    </Button>
                  )}
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? <Loader2Icon className="size-4 animate-spin" /> : delivery === "doccle" ? <SendIcon className="size-4" /> : <DownloadIcon className="size-4" />}
                    {submitting ? "Génération…" : delivery === "doccle" ? "Envoyer le document" : "Générer le document"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                {activeIndex > 0 ? (
                  <Button type="button" variant="outline" onClick={() => setActive(activeIndex - 1)}>
                    <ChevronLeftIcon className="size-4" /> Précédent
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="button" onClick={() => setActive(activeIndex + 1)}>
                  Continuer <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/// Récap lecture-seule affiché dans l'étape Résumé (en plus de la sidebar).
function SummaryStep({ form, values, locale }: { form: PublicForm; values: FormPayload; locale: Locale }) {
  return (
    <div className="flex flex-col divide-y rounded-xl border">
      {form.fields.map((f) => {
        const raw = values[f.id];
        let display = "";
        if (f.type === "checkbox") display = raw === true ? "Oui" : "Non";
        else if (f.type === "signature") display = typeof raw === "string" && raw.startsWith("data:image/") ? "✓ Signée" : "—";
        else if (f.type === "fullname" && raw && typeof raw === "object") {
          const o = raw as { first?: string; last?: string };
          display = [o.first, o.last].filter(Boolean).join(" ");
        } else display = raw === undefined || raw === null ? "" : String(raw);
        return (
          <div key={f.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">{loc(f.label, locale) || f.id}</span>
            <span className={`text-right font-medium ${display ? "" : "italic text-muted-foreground"}`}>
              {display || "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
