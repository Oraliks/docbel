"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  DownloadIcon,
  SendIcon,
  CheckCircle2Icon,
  Loader2Icon,
  FileTextIcon,
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
import { buildValidator, isFieldComplete, findFirstInvalidStep } from "@/lib/pdf-forms/validation";
import { Locale, FieldValue, FormPayload, PdfFormField, loc } from "@/lib/pdf-forms/types";
import { todayISO } from "@/lib/pdf-forms/system-values";
import { resolveSignerName } from "@/lib/pdf-forms/signature";
import { isAutoField, isCreationDateField, isSignatureField } from "@/lib/pdf-forms/auto-fields";
import { applyMotifTransferOverride } from "@/lib/pdf-forms/c1-motif-transfer";
import { applyIbanCountryRouting } from "@/lib/pdf-forms/c1-iban-routing";
import { applyRemarqueSituationFamiliale } from "@/lib/pdf-forms/c1-remarque-derivation";
import { FIELD_DERIVATIONS, applyFieldDerivations } from "@/lib/pdf-forms/field-derivations";
import type { PublicForm, PublicField } from "@/lib/pdf-forms/public-serializer";
import { buildSteps, buildMacroSteps, type OptionalSection, type MacroStep } from "@/lib/pdf-forms/build-steps";
import { sectionLabel } from "@/lib/pdf-forms/section-labels";
import { FormStepper } from "./form-stepper";
import { FormShell } from "./form-shell";
import { ContextHelpPanel } from "./context-help-panel";
import { MotifSituationPicker } from "./motif-situation-picker";
import { CompactAccordionSection } from "./compact-accordion-section";
import { AutoSaveNotice } from "./auto-save-notice";
import { OptionCard } from "@/components/ui/option-card";

const LOCALE_NAMES: Record<Locale, string> = { fr: "FR", nl: "NL", de: "DE" };

// Types de champ qui occupent toute la largeur dans la grille 2 colonnes.
const FULL_WIDTH_TYPES = new Set(["textarea", "signature", "fullname", "checkbox", "radio", "array"]);

function defaultValues(form: PublicForm, bundlePrefill?: Record<string, string>): FormPayload {
  const v: FormPayload = {};
  for (const f of form.fields) {
    if (bundlePrefill && bundlePrefill[f.id] !== undefined && bundlePrefill[f.id] !== "") {
      v[f.id] = bundlePrefill[f.id];
    } else if (isCreationDateField(f)) v[f.id] = todayISO();
    else if (f.defaultValue !== undefined) v[f.id] = f.defaultValue as FieldValue;
    else if (f.type === "checkbox") v[f.id] = false;
    else if (f.type === "fullname") v[f.id] = { first: "", last: "" };
    else if (isSignatureField(f)) v[f.id] = "";
  }
  return v;
}

type Step =
  | { kind: "fields"; id: string; title: string; subtitle: string; fields: PublicField[] }
  | { kind: "optional-group"; id: string; title: string; subtitle: string; sections: OptionalSection[] }
  | { kind: "summary"; id: string; title: string; subtitle: string };

interface PdfFormRunnerProps {
  form: PublicForm;
  bundlePrefill?: Record<string, string>;
  bundleRunId?: string;
  onValuesChange?: (values: FormPayload) => void;
  onLocaleChange?: (locale: Locale) => void;
  /// Filet de sécurité : force l'ancien rendu (grille dense + résumé
  /// détaillé) si true. Piloté par un env var serveur, cf. Task 12. Défaut
  /// false (nouveau rendu).
  legacyLayout?: boolean;
}

export function PdfFormRunner({ form, bundlePrefill, bundleRunId, onValuesChange, onLocaleChange, legacyLayout = false }: PdfFormRunnerProps) {
  const t = useTranslations("public.dossier");
  const [locale, setLocale] = useState<Locale>(form.defaultLocale);
  const [values, setValues] = useState<FormPayload>(() => defaultValues(form, bundlePrefill));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [delivery, setDelivery] = useState<"download" | "doccle">(form.allowDownload ? "download" : "doccle");
  const [doccleRef, setDoccleRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { mode: "download" | "doccle" }>(null);
  const [active, setActive] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onValuesChange?.(values); }, [values, onValuesChange]);
  useEffect(() => { onLocaleChange?.(locale); }, [locale, onLocaleChange]);

  // Retour du flux itsme (?prefill=ok|error|unavailable).
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("prefill");
    if (!status) return;
    if (status === "ok") toast.success(t("runnerItsmeOk"));
    else if (status === "unavailable") toast.info(t("runnerItsmeUnavailable"));
    else toast.error(t("runnerItsmeError"));
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charge un éventuel brouillon (best-effort, utilisateur connecté).
  useEffect(() => {
    let act = true;
    fetch(`/api/pdf/${form.slug}/draft`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (act && d?.draft && typeof d.draft === "object") {
          setValues((prev) => ({ ...prev, ...(d.draft as FormPayload) }));
          toast.info(t("runnerDraftRestored"));
        }
      })
      .catch(() => {});
    return () => { act = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.slug]);

  // ----- Construction des étapes -----
  // Étapes "core" (séquentielles) + un bloc "optionnel" replié (sections
  // stepPriority=optional) + l'étape résumé, dans cet ordre. Logique pure
  // extraite dans build-steps.ts (testée indépendamment).
  const dataFields = useMemo(
    () => form.fields.filter((f) => !isAutoField(f)),
    [form.fields]
  );
  const { coreSteps, optionalSections } = useMemo(
    () =>
      buildSteps(dataFields, values, locale, {
        fallbackTitle: t("runnerStepInfoTitle"),
        fallbackSubtitle: t("runnerStepInfoSubtitle"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataFields, values, locale]
  );

  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [...coreSteps];
    if (optionalSections.length > 0) {
      out.push({
        kind: "optional-group",
        id: "optional-group",
        title: t("runnerOptionalGroupTitle"),
        subtitle: t("runnerOptionalGroupSubtitle"),
        sections: optionalSections,
      });
    }
    out.push({ kind: "summary", id: "summary", title: t("runnerStepSummaryTitle"), subtitle: t("runnerStepSummarySubtitle") });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coreSteps, optionalSections, locale]);

  // Mode « macro-étapes » (ex. C1 → 5 étapes) : non-null si des champs portent
  // `stepGroup`. Supersède `steps` (pas de résumé, envoi sur la dernière
  // étape). Null pour les autres formulaires → rendu classique inchangé.
  const macroSteps = useMemo(() => buildMacroSteps(form.fields, values), [form.fields, values]);

  // Nom du signataire résolu depuis les champs saisis (pour la signature
  // numérique). "" si aucun nom exploitable.
  const signerName = useMemo(() => resolveSignerName(form.fields, values), [form.fields, values]);

  // Clamp dérivé (le nombre d'étapes peut diminuer via visibleIf).
  const stepCount = macroSteps ? macroSteps.length : steps.length;
  const activeIndex = Math.min(active, stepCount - 1);

  // Map champ → index d'étape (pour sauter sur la 1ʳᵉ erreur) — macro-aware.
  const fieldStepIndex = useMemo(() => {
    const m: Record<string, number> = {};
    if (macroSteps) {
      macroSteps.forEach((ms, i) => {
        ms.sections.forEach((sec) => sec.fields.forEach((f) => (m[f.id] = i)));
        ms.advanced.forEach((f) => (m[f.id] = i));
      });
    } else {
      steps.forEach((s, i) => {
        if (s.kind === "fields") s.fields.forEach((f) => (m[f.id] = i));
        if (s.kind === "optional-group") s.sections.forEach((sec) => sec.fields.forEach((f) => (m[f.id] = i)));
      });
    }
    return m;
  }, [steps, macroSteps]);

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
        setLastSavedAt(new Date());
      }, 1500);
    },
    [form.slug]
  );

  // Bloque l'avancée vers une étape ULTÉRIEURE tant que les champs REQUIS
  // d'une des étapes SURVOLÉES (celle qu'on quitte, ET toute étape qu'on
  // saute en cliquant plus loin dans le stepper) ne sont pas valides — un
  // clic direct sur une étape 2+ crans plus loin ne validait auparavant QUE
  // l'étape courante, laissant les étapes intermédiaires (ex. Identité)
  // passer sans jamais être vérifiées (bug remonté par Oraliks, 2026-07-07).
  // Reculer (étape déjà vue) reste toujours libre : cf. les appels à
  // `setActive` directement pour "Précédent" et pour un clic en arrière sur
  // le stepper.
  const attemptAdvance = useCallback(
    (stepsFieldsList: PublicField[][], startIndex: number, nextIndex: number) => {
      const invalid = findFirstInvalidStep(stepsFieldsList as unknown as PdfFormField[][], values, locale);
      if (invalid) {
        setErrors((prev) => ({ ...prev, ...invalid.errors }));
        setActive(startIndex + invalid.index);
        const firstInvalidFieldId = stepsFieldsList[invalid.index].find((f) => invalid.errors[f.id])?.id;
        if (firstInvalidFieldId) {
          setTimeout(() => document.getElementById(firstInvalidFieldId)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
        }
        return;
      }
      setActive(nextIndex);
    },
    [values, locale]
  );

  async function submit() {
    if (!consent) {
      toast.error(t("runnerConsentRequired"));
      return;
    }
    // Signature numérique automatique : on auto-confirme tous les champs
    // signature du formulaire si un nom de signataire est résolu depuis la
    // saisie. Le serveur produira le bloc "Signé numériquement par X" au
    // bon endroit dans le PDF.
    // applyMotifTransferOverride : no-op pour la plupart des formulaires ;
    // sur le C1 "changement de situation", corrige motifIntroduction si le
    // citoyen a coché "transfert vers un autre organisme de paiement" (case
    // PDF mutuellement exclusive avec "modification", jamais soumise en
    // même temps — cf. lib/pdf-forms/c1-motif-transfer.ts).
    // applyFieldDerivations : synchronise les champs `derivedFrom` (ex. date
    // de naissance ← NISS) sur leur valeur ACTUELLEMENT affichée (verrouillée
    // à l'écran), au cas où `values` garderait une saisie manuelle antérieure.
    // applyIbanCountryRouting : sur le C1, on n'expose qu'UN champ IBAN à
    // l'écran (accepte BE + étranger via `internationalIban`) ; au submit,
    // on route la valeur vers le bon widget PDF selon les 2 lettres de
    // préfixe pays (cf. lib/pdf-forms/c1-iban-routing.ts). No-op sur les
    // autres formulaires (l'IBAN étranger vit alors dans son champ propre).
    // applyRemarqueSituationFamiliale : injecte « cohousing » / « jugement
    // en cours » / « je n'ai pas encore reçu mon jugement » dans la remarque
    // situation familiale (autoAnswered), à partir des choix concrets pris
    // ailleurs — cf. lib/pdf-forms/c1-remarque-derivation.ts.
    const signedValues: FormPayload = applyFieldDerivations(
      applyRemarqueSituationFamiliale(
        applyIbanCountryRouting(applyMotifTransferOverride({ ...values }))
      ),
      form.fields
    );
    if (signerName) {
      for (const f of form.fields) {
        if (isSignatureField(f)) signedValues[f.id] = "confirmed";
      }
    } else {
      // Pas de nom exploitable : on annule pour ne pas générer un document
      // signé "anonyme".
      toast.error(t("runnerNameRequiredToSign"));
      return;
    }
    // Validation avec la version signée (sinon les champs signature requis
    // seraient signalés comme manquants).
    const validator = buildValidator(form.fields as unknown as PdfFormField[], locale);
    const res0 = validator.safeParse(signedValues);
    if (!res0.success) {
      const next: Record<string, string> = {};
      for (const issue of res0.error.issues) {
        const id = String(issue.path[0] ?? "");
        if (id && !next[id]) next[id] = issue.message;
      }
      setErrors(next);
      const firstId = String(res0.error.issues[0]?.path[0] ?? "");
      if (firstId) {
        const stepIdx = fieldStepIndex[firstId];
        if (stepIdx !== undefined) setActive(stepIdx);
        setTimeout(() => document.getElementById(firstId)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
      }
      toast.error(t("runnerSomeFieldsInvalid"));
      return;
    }
    setErrors({});
    if (delivery === "doccle" && !doccleRef.trim()) {
      toast.error(t("runnerDoccleRecipientRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pdf/${form.slug}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: signedValues,
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
        toast.error(t("runnerServerValidationFailed"));
        return;
      }
      toast.error(data.error || t("runnerGenerationFailed"));
    } catch {
      toast.error(t("runnerNetworkError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="rounded-2xl border-0 bg-card shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2Icon className="size-10 text-primary" />
          <p className="text-sm text-muted-foreground">
            {done.mode === "download"
              ? t("runnerDoneDownload")
              : t("runnerDoneDoccle")}
          </p>
          <Button variant="outline" size="sm" onClick={() => { setDone(null); setActive(0); }}>
            {t("runnerGenerateAnother")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (legacyLayout) {
    return (
      <LegacyRunnerBody
        form={form}
        steps={steps}
        activeIndex={activeIndex}
        setActive={setActive}
        attemptAdvance={attemptAdvance}
        locale={locale}
        values={values}
        errors={errors}
        setValue={setValue}
        signerName={signerName}
        consent={consent}
        setConsent={setConsent}
        delivery={delivery}
        setDelivery={setDelivery}
        doccleRef={doccleRef}
        setDoccleRef={setDoccleRef}
        submitting={submitting}
        submit={submit}
        t={t}
      />
    );
  }

  // Mode macro (C1) : rendu 5 étapes sans résumé, envoi sur la dernière.
  if (macroSteps) {
    return (
      <MacroRunnerBody
        form={form}
        macroSteps={macroSteps}
        activeIndex={activeIndex}
        setActive={setActive}
        attemptAdvance={attemptAdvance}
        locale={locale}
        setLocale={setLocale}
        values={values}
        errors={errors}
        setValue={setValue}
        signerName={signerName}
        consent={consent}
        setConsent={setConsent}
        delivery={delivery}
        setDelivery={setDelivery}
        doccleRef={doccleRef}
        setDoccleRef={setDoccleRef}
        submitting={submitting}
        submit={submit}
        lastSavedAt={lastSavedAt}
        bundleRunId={bundleRunId}
        t={t}
      />
    );
  }

  const current = steps[activeIndex];
  const stepHasError = (s: Step) =>
    (s.kind === "fields" && s.fields.some((f) => errors[f.id])) ||
    (s.kind === "optional-group" && s.sections.some((sec) => sec.fields.some((f) => errors[f.id])));
  const stepFieldsOf = (s: Step): PublicField[] =>
    s.kind === "fields" ? s.fields : s.kind === "optional-group" ? s.sections.flatMap((sec) => sec.fields) : [];
  // Navigation via le stepper : reculer reste toujours libre, avancer est
  // gaté sur la validité de TOUTES les étapes survolées (cf. attemptAdvance).
  const handleStepSelect = (targetIndex: number) => {
    if (targetIndex <= activeIndex) { setActive(targetIndex); return; }
    attemptAdvance(steps.slice(activeIndex, targetIndex).map(stepFieldsOf), activeIndex, targetIndex);
  };

  const activeSectionKey = current.kind === "fields" ? current.id : undefined;

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
              {t("runnerItsmePrefillCta")}
            </Button>
          )}
        </div>
      )}

      <FormShell
        helpPanel={<ContextHelpPanel sectionKey={activeSectionKey} locale={locale} />}
      >
        <Card className="overflow-hidden rounded-3xl border-0 bg-card shadow-sm">
          <div className="border-b border-[color:var(--glass-border)] px-3">
            <FormStepper
              steps={steps.map((s) => {
                const meta = computeStepMeta(stepFieldsOf(s), values, locale, (c) => t("runnerStepRemaining", { count: c }));
                return { id: s.id, label: s.title, hasError: stepHasError(s), ...meta };
              })}
              activeIndex={activeIndex}
              onSelect={handleStepSelect}
            />
          </div>

          <CardContent className="p-4 sm:p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (current.kind === "summary") submit();
              }}
              className="flex flex-col gap-4"
            >
              {/* En-tête d'étape */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h2
                    className="glass-display text-[18px] font-semibold leading-tight text-[color:var(--glass-ink)] sm:text-[20px]"
                    style={{ fontVariationSettings: "'WONK' 0, 'SOFT' 0", fontFeatureSettings: "'swsh' 0, 'salt' 0" }}
                  >
                    {current.title}
                  </h2>
                  {current.kind === "summary" && (
                    <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
                      {t("runnerSummaryStepHelp")}
                    </p>
                  )}
                </div>
                {current.kind === "fields" && current.fields.length > 0 && (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                    <InfoIcon className="size-3" />
                    {current.fields.every((f) => f.required) ? t("runnerAllFieldsRequired") : t("runnerStarFieldsRequired")}
                  </span>
                )}
              </div>

              {/* Contenu de l'étape */}
              {current.kind === "summary" ? (
                <ConfirmationCard hasSignature={form.fields.some(isSignatureField)} signerName={signerName} />
              ) : current.kind === "optional-group" ? (
                <CompactAccordionSection
                  sections={current.sections}
                  renderFields={(fields) => (
                    <FieldsCluster
                      fields={fields}
                      values={values}
                      errors={errors}
                      locale={locale}
                      setValue={setValue}
                      formId={form.id}
                      formSlug={form.slug}
                    />
                  )}
                />
              ) : (
                <FieldsCluster
                  fields={current.fields}
                  values={values}
                  errors={errors}
                  locale={locale}
                  setValue={setValue}
                  formId={form.id}
                  formSlug={form.slug}
                />
              )}

              {/* Pied d'étape */}
              {current.kind === "summary" ? (
                <div className="flex flex-col gap-4">
                  {form.allowDownload && form.allowDoccle && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{t("runnerDeliveryModeLabel")}</span>
                      <div className="flex gap-1.5">
                        <Button type="button" size="sm" variant={delivery === "download" ? "default" : "outline"} onClick={() => setDelivery("download")}>
                          <DownloadIcon className="size-4" /> {t("runnerDeliveryDownload")}
                        </Button>
                        <Button type="button" size="sm" variant={delivery === "doccle" ? "default" : "outline"} onClick={() => setDelivery("doccle")}>
                          <SendIcon className="size-4" /> {t("runnerDeliveryDoccle")}
                        </Button>
                      </div>
                    </div>
                  )}
                  {delivery === "doccle" && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="doccle-ref">{t("runnerDoccleRecipientLabel")}</Label>
                      <Input id="doccle-ref" value={doccleRef} placeholder={t("runnerDoccleRecipientPlaceholder")} onChange={(e) => setDoccleRef(e.target.value)} />
                    </div>
                  )}
                  <Separator />
                  {form.fields.some(isSignatureField) && (
                    <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t("runnerDigitalSignatureLabel")}
                      </div>
                      {signerName ? (
                        <>
                          <div className="mt-1 font-serif text-lg italic">{signerName}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {t("runnerDigitalSignatureAutoNote")}
                          </div>
                        </>
                      ) : (
                        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          {t("runnerDigitalSignatureNameRequired")}
                        </div>
                      )}
                    </div>
                  )}
                  <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Checkbox checked={consent} onCheckedChange={(c) => setConsent(c === true)} className="mt-0.5" />
                    <span>{t("runnerConsentText")}</span>
                  </label>
                  <AutoSaveNotice lastSavedAt={lastSavedAt} isPartOfBundle={!!bundleRunId} />
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--glass-border)] pt-4">
                    <StepProgress
                      current={activeIndex + 1}
                      total={steps.length}
                      label={t("runnerStepCounter", { current: activeIndex + 1, total: steps.length })}
                    />
                    <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
                      {activeIndex > 0 && (
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => setActive(activeIndex - 1)}>
                          <ChevronLeftIcon className="size-4" /> {t("previous")}
                        </Button>
                      )}
                      <Button type="submit" disabled={submitting} className="rounded-full px-6">
                        {submitting ? <Loader2Icon className="size-4 animate-spin" /> : delivery === "doccle" ? <SendIcon className="size-4" /> : <DownloadIcon className="size-4" />}
                        {submitting
                          ? t("runnerGenerating")
                          : delivery === "doccle"
                          ? t("runnerSubmitSignAndSend")
                          : t("runnerSubmitSignAndGenerate")}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 border-t border-[color:var(--glass-border)] pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <StepProgress
                      current={activeIndex + 1}
                      total={steps.length}
                      label={t("runnerStepCounter", { current: activeIndex + 1, total: steps.length })}
                    />
                    <div className="flex items-center gap-2">
                      {activeIndex > 0 && (
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => setActive(activeIndex - 1)}>
                          <ChevronLeftIcon className="size-4" /> {t("previous")}
                        </Button>
                      )}
                      <Button type="button" className="rounded-full px-6" onClick={() => attemptAdvance([stepFieldsOf(current)], activeIndex, activeIndex + 1)}>
                        {t("continue")} <ChevronRightIcon className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <AutoSaveNotice lastSavedAt={lastSavedAt} isPartOfBundle={!!bundleRunId} />
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </FormShell>
    </div>
  );
}

/// Regroupe les champs `renderAs: "chip"` en grille de OptionCard (au lieu
/// d'appeler PdfField pour ceux-là) ; le reste des champs suit le rendu
/// PdfField habituel. Single-select si le champ est "radio", multi-select
/// (indépendant) si "checkbox" — chaque champ garde sa propre valeur, ce
/// composant ne fait qu'aiguiller le rendu.
function FieldsCluster({
  fields,
  values,
  errors,
  locale,
  setValue,
  formId,
  formSlug,
}: {
  fields: PublicField[];
  values: FormPayload;
  errors: Record<string, string>;
  locale: Locale;
  setValue: (id: string, value: FieldValue) => void;
  formId: string;
  formSlug: string;
}) {
  // Trois familles de rendu : cartes de choix (chips), lignes binaires
  // compactes (oui/non + cases, empilées dans un conteneur à séparateurs),
  // et le reste en grille classique.
  const isRowField = (f: PublicField) =>
    f.renderAs !== "chip" &&
    (f.type === "checkbox" || (f.type === "radio" && (f.options || []).length === 2));
  const chipFields = fields.filter((f) => f.renderAs === "chip");
  const rowFields = fields.filter(isRowField);
  const otherFields = fields.filter((f) => f.renderAs !== "chip" && !isRowField(f));
  // Champ dérivé (ex. date de naissance ← NISS) : recalculé À CHAQUE RENDU
  // depuis le champ source, jamais stocké dans `values` (cf. PdfField.derivedValue).
  const deriveValueFor = (f: PublicField): string | null =>
    f.derivedFrom ? FIELD_DERIVATIONS[f.derivedFrom.via](values[f.derivedFrom.fieldId] ?? "") : null;
  // Code postal courant du champ désigné par `f.streetAutocomplete`, pour
  // prioriser les suggestions de rue correspondantes (cf. PdfField).
  const relatedPostalCodeFor = (f: PublicField): string | undefined => {
    const raw = f.streetAutocomplete ? values[f.streetAutocomplete.postalFieldId] : undefined;
    return typeof raw === "string" ? raw : undefined;
  };

  // Erreur(s) partagée(s) des champs chip : une contrainte de GROUPE
  // ("au moins un parmi N") s'attache à un seul champ (l'ancre), mais
  // concerne visuellement TOUT le groupe — on l'affiche donc comme message
  // sous la grille plutôt que de rougir une carte en particulier. Dédupliqué
  // (plusieurs champs pourraient en théorie partager le même message).
  const chipGroupErrors = [...new Set(chipFields.map((f) => errors[f.id]).filter(Boolean))];

  return (
    <div className="flex flex-col gap-4">
      {chipFields.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {chipFields.map((f) => {
              if (f.type === "radio") {
                return (f.options || []).map((o) => (
                  <OptionCard
                    key={`${f.id}-${o.value}`}
                    label={loc(o.label, locale)}
                    selected={values[f.id] === o.value}
                    onToggle={() => setValue(f.id, o.value)}
                    invalid={f.required === true && !!errors[f.id]}
                  />
                ));
              }
              // checkbox : une seule carte, toggle indépendant.
              return (
                <OptionCard
                  key={f.id}
                  label={loc(f.label, locale)}
                  selected={values[f.id] === true}
                  onToggle={() => setValue(f.id, values[f.id] !== true)}
                  invalid={f.required === true && !!errors[f.id]}
                />
              );
            })}
          </div>
          {chipGroupErrors.map((msg) => (
            <p key={msg} role="alert" className="text-sm font-normal text-destructive">
              {msg}
            </p>
          ))}
        </div>
      )}
      {rowFields.length > 0 && (
        <div className="divide-y divide-[color:var(--glass-border)] rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)]">
          {rowFields.map((f) => (
            <PdfField
              key={f.id}
              field={f}
              value={values[f.id] ?? ""}
              error={errors[f.id]}
              locale={locale}
              onChange={(v) => setValue(f.id, v)}
              formId={formId}
              formSlug={formSlug}
              rowLayout
              derivedValue={deriveValueFor(f)}
            />
          ))}
        </div>
      )}
      {otherFields.length > 0 && (
        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {otherFields.map((f) => (
            <div key={f.id} className={FULL_WIDTH_TYPES.has(f.type) ? "sm:col-span-2 xl:col-span-3" : ""}>
              <PdfField
                field={f}
                value={values[f.id] ?? ""}
                error={errors[f.id]}
                locale={locale}
                onChange={(v) => setValue(f.id, v)}
                formId={formId}
                formSlug={formSlug}
                derivedValue={deriveValueFor(f)}
                relatedPostalCode={relatedPostalCodeFor(f)}
                onSelectStreetSuggestion={(postalCode) => {
                  if (f.streetAutocomplete) setValue(f.streetAutocomplete.postalFieldId, postalCode);
                }}
                parentValues={values}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/// Métadonnées de complétion d'une étape pour le stepper : `complete` (tous
/// les champs REQUIS remplis et valides) + `subLabel` (« N champs restants »).
/// Une étape sans champ requis ne renvoie rien (ni coche, ni compteur).
function computeStepMeta(
  fields: PublicField[],
  values: FormPayload,
  locale: Locale,
  remainingLabel: (count: number) => string
): { complete?: boolean; subLabel?: string } {
  const required = fields.filter((f) => f.required);
  if (required.length === 0) return {};
  const filled = required.filter((f) => isFieldComplete(f, values[f.id], locale)).length;
  const remaining = required.length - filled;
  return { complete: remaining === 0, subLabel: remaining > 0 ? remainingLabel(remaining) : undefined };
}

/// Compteur d'étape + barre de progression fine + pourcentage (pied d'étape).
function StepProgress({ current, total, label }: { current: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="whitespace-nowrap text-xs font-semibold text-[color:var(--glass-ink-soft)]">{label}</span>
      <span className="relative h-1.5 w-24 overflow-hidden rounded-full bg-[color:var(--glass-pop-bg)] sm:w-36" aria-hidden>
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-[color:var(--glass-accent-deep,#5B46E5)] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-xs font-bold text-[color:var(--glass-accent-deep,#5B46E5)]">{pct}%</span>
    </div>
  );
}

/// Étape finale allégée : plus de liste détaillée des valeurs (ancien
/// SummaryStep, conservé plus bas pour le mode legacy). Le mode de
/// livraison/signature/consentement restent dans le pied d'étape appelant.
function ConfirmationCard({ hasSignature, signerName }: { hasSignature: boolean; signerName: string }) {
  const t = useTranslations("public.dossier");
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-5 text-sm text-[color:var(--glass-ink)]">
      <CheckCircle2Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-[color:var(--glass-accent-deep,#5B46E5)]" />
      <div className="min-w-0">
        {t("runnerConfirmationReady")}
        {hasSignature && !signerName && (
          <span className="mt-1 block text-amber-700 dark:text-amber-300">
            {t("runnerConfirmationNameForSignature")}
          </span>
        )}
      </div>
    </div>
  );
}

/// Titres i18n des 5 macro-étapes du C1 (repli sur l'id si clé absente).
const MACRO_TITLE_KEY: Record<string, string> = {
  motif: "runnerGroupMotif",
  identite: "runnerGroupIdentite",
  "activites-revenus": "runnerGroupActivitesRevenus",
  famille: "runnerGroupFamille",
  final: "runnerGroupFinal",
};

/// Description courte affichée sous le titre dans le nouveau stepper
/// (barre de progression + liste numérotée) — cf. FormStepperItem.description.
const MACRO_DESC_KEY: Record<string, string> = {
  motif: "runnerGroupMotifDesc",
  identite: "runnerGroupIdentiteDesc",
  "activites-revenus": "runnerGroupActivitesRevenusDesc",
  famille: "runnerGroupFamilleDesc",
  final: "runnerGroupFinalDesc",
};

interface MacroRunnerBodyProps {
  form: PublicForm;
  macroSteps: MacroStep[];
  activeIndex: number;
  setActive: (i: number) => void;
  attemptAdvance: (stepsFieldsList: PublicField[][], startIndex: number, nextIndex: number) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  values: FormPayload;
  errors: Record<string, string>;
  setValue: (id: string, value: FieldValue) => void;
  signerName: string;
  consent: boolean;
  setConsent: (c: boolean) => void;
  delivery: "download" | "doccle";
  setDelivery: (d: "download" | "doccle") => void;
  doccleRef: string;
  setDoccleRef: (v: string) => void;
  submitting: boolean;
  submit: () => void;
  lastSavedAt: Date | null;
  bundleRunId?: string;
  t: ReturnType<typeof useTranslations>;
}

/// Rendu « macro-étapes » (C1 → 5 étapes) : pas d'étape résumé, l'action
/// d'envoi (consentement + livraison + signature + génération) vit dans le
/// pied de la DERNIÈRE étape. Réutilise FieldsCluster / FormStepper /
/// ContextHelpPanel / StepProgress. Une macro-étape à plusieurs sections
/// affiche un sous-titre par section ; le long-tail non curé (`advanced`)
/// va dans un accordéon replié.
function MacroRunnerBody({
  form, macroSteps, activeIndex, setActive, attemptAdvance, locale, setLocale, values, errors,
  setValue, signerName, consent, setConsent, delivery, setDelivery, doccleRef,
  setDoccleRef, submitting, submit, lastSavedAt, bundleRunId, t,
}: MacroRunnerBodyProps) {
  const current = macroSteps[activeIndex];
  const isLast = activeIndex === macroSteps.length - 1;
  const multiSection = current.sections.length > 1;
  const titleFor = (id: string) => {
    const k = MACRO_TITLE_KEY[id];
    return k ? t(k) : id;
  };
  const descFor = (id: string) => {
    const k = MACRO_DESC_KEY[id];
    return k ? t(k) : undefined;
  };
  const stepHasError = (ms: MacroStep) =>
    ms.sections.some((sec) => sec.fields.some((f) => errors[f.id])) ||
    ms.advanced.some((f) => errors[f.id]);
  const stepFieldsOf = (ms: MacroStep): PublicField[] => [...ms.sections.flatMap((sec) => sec.fields), ...ms.advanced];
  // Reculer reste libre ; avancer est gaté sur la validité de TOUTES les
  // étapes survolées (cf. attemptAdvance).
  const handleStepSelect = (targetIndex: number) => {
    if (targetIndex <= activeIndex) { setActive(targetIndex); return; }
    attemptAdvance(macroSteps.slice(activeIndex, targetIndex).map(stepFieldsOf), activeIndex, targetIndex);
  };

  const cluster = (fields: PublicField[]) => (
    <FieldsCluster
      fields={fields}
      values={values}
      errors={errors}
      locale={locale}
      setValue={setValue}
      formId={form.id}
      formSlug={form.slug}
    />
  );

  const progress = (
    <StepProgress
      current={activeIndex + 1}
      total={macroSteps.length}
      label={t("runnerStepCounter", { current: activeIndex + 1, total: macroSteps.length })}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {(form.locales.length > 1 || form.allowItsme) && (
        <div className="flex flex-wrap items-center gap-2">
          {form.locales.length > 1 &&
            form.locales.map((l) => (
              <Button key={l} size="sm" variant={l === locale ? "default" : "outline"} className="h-7 px-2.5" onClick={() => setLocale(l)}>
                {LOCALE_NAMES[l]}
              </Button>
            ))}
          {form.allowItsme && (
            <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => { window.location.href = `/api/pdf/${form.slug}/prefill/start`; }}>
              {t("runnerItsmePrefillCta")}
            </Button>
          )}
        </div>
      )}

      <FormShell helpPanel={<ContextHelpPanel sectionKey={current.sections[0]?.key} locale={locale} />}>
        <Card className="overflow-hidden rounded-3xl border-0 bg-card shadow-sm">
          <div className="border-b border-[color:var(--glass-border)] px-3">
            <FormStepper
              steps={macroSteps.map((s) => {
                const meta = computeStepMeta(stepFieldsOf(s), values, locale, (c) => t("runnerStepRemaining", { count: c }));
                return { id: s.id, label: titleFor(s.id), description: descFor(s.id), hasError: stepHasError(s), ...meta };
              })}
              activeIndex={activeIndex}
              onSelect={handleStepSelect}
            />
          </div>

          <CardContent className="p-4 sm:p-5">
            <form
              onSubmit={(e) => { e.preventDefault(); if (isLast) submit(); }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1">
                <h2
                  className="glass-display text-[22px] font-semibold leading-tight text-[color:var(--glass-ink)] sm:text-[26px]"
                  style={{ fontVariationSettings: "'WONK' 0, 'SOFT' 0", fontFeatureSettings: "'swsh' 0, 'salt' 0" }}
                >
                  {titleFor(current.id)}
                </h2>
              </div>

              {current.sections.map((sec, i) => {
                // Étape "Motif" à contrainte de groupe (ex. les 5 situations
                // du C1 changement-situation) : rendu dédié tableau + panneau
                // Détails (cf. mockup Oraliks, 2026-07-07), au lieu de la
                // grille de chips générique. Détection par la présence d'un
                // champ `requiredGroup` — pas un id de dossier en dur, ce
                // rendu s'appliquerait à tout futur formulaire du même moule.
                if (sec.fields.some((f) => f.requiredGroup)) {
                  return (
                    <MotifSituationPicker
                      key={sec.key ?? `sec-${i}`}
                      fields={sec.fields}
                      values={values}
                      errors={errors}
                      locale={locale}
                      setValue={setValue}
                      formId={form.id}
                      formSlug={form.slug}
                    />
                  );
                }
                return (
                  <div
                    key={sec.key ?? `sec-${i}`}
                    className={
                      multiSection
                        ? "flex flex-col gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3.5 sm:p-4"
                        : "flex flex-col gap-3"
                    }
                  >
                    {multiSection && sec.key && (
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
                        {sectionLabel(sec.key, locale)}
                      </h3>
                    )}
                    {cluster(sec.fields)}
                  </div>
                );
              })}

              {current.advanced.length > 0 && (
                <CompactAccordionSection
                  sections={[{ key: "advanced", title: t("runnerAdvancedSectionTitle"), fields: current.advanced, defaultOpen: false }]}
                  renderFields={cluster}
                />
              )}

              {isLast ? (
                <div className="flex flex-col gap-4 border-t border-[color:var(--glass-border)] pt-4">
                  {form.allowDownload && form.allowDoccle && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{t("runnerDeliveryModeLabel")}</span>
                      <div className="flex gap-1.5">
                        <Button type="button" size="sm" variant={delivery === "download" ? "default" : "outline"} onClick={() => setDelivery("download")}>
                          <DownloadIcon className="size-4" /> {t("runnerDeliveryDownload")}
                        </Button>
                        <Button type="button" size="sm" variant={delivery === "doccle" ? "default" : "outline"} onClick={() => setDelivery("doccle")}>
                          <SendIcon className="size-4" /> {t("runnerDeliveryDoccle")}
                        </Button>
                      </div>
                    </div>
                  )}
                  {delivery === "doccle" && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="doccle-ref-macro">{t("runnerDoccleRecipientLabel")}</Label>
                      <Input id="doccle-ref-macro" value={doccleRef} placeholder={t("runnerDoccleRecipientPlaceholder")} onChange={(e) => setDoccleRef(e.target.value)} />
                    </div>
                  )}
                  {form.fields.some(isSignatureField) && (
                    <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("runnerDigitalSignatureLabel")}</div>
                      {signerName ? (
                        <>
                          <div className="mt-1 font-serif text-lg italic">{signerName}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">{t("runnerDigitalSignatureAutoNote")}</div>
                        </>
                      ) : (
                        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t("runnerDigitalSignatureNameRequired")}</div>
                      )}
                    </div>
                  )}
                  <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Checkbox checked={consent} onCheckedChange={(c) => setConsent(c === true)} className="mt-0.5" />
                    <span>{t("runnerConsentText")}</span>
                  </label>
                  <AutoSaveNotice lastSavedAt={lastSavedAt} isPartOfBundle={!!bundleRunId} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {progress}
                    <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
                      <Button type="button" variant="outline" className="rounded-full" onClick={() => setActive(activeIndex - 1)}>
                        <ChevronLeftIcon className="size-4" /> {t("previous")}
                      </Button>
                      <Button type="submit" disabled={submitting} className="rounded-full px-6">
                        {submitting ? <Loader2Icon className="size-4 animate-spin" /> : delivery === "doccle" ? <SendIcon className="size-4" /> : <DownloadIcon className="size-4" />}
                        {submitting ? t("runnerGenerating") : delivery === "doccle" ? t("runnerSubmitSignAndSend") : t("runnerSubmitSignAndGenerate")}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 border-t border-[color:var(--glass-border)] pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {progress}
                    <div className="flex items-center gap-2">
                      {activeIndex > 0 && (
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => setActive(activeIndex - 1)}>
                          <ChevronLeftIcon className="size-4" /> {t("previous")}
                        </Button>
                      )}
                      <Button type="button" className="rounded-full px-6" onClick={() => attemptAdvance([stepFieldsOf(current)], activeIndex, activeIndex + 1)}>
                        {t("continue")} <ChevronRightIcon className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <AutoSaveNotice lastSavedAt={lastSavedAt} isPartOfBundle={!!bundleRunId} />
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </FormShell>
    </div>
  );
}

interface LegacyRunnerBodyProps {
  form: PublicForm;
  steps: Step[];
  activeIndex: number;
  setActive: (i: number) => void;
  attemptAdvance: (stepsFieldsList: PublicField[][], startIndex: number, nextIndex: number) => void;
  locale: Locale;
  values: FormPayload;
  errors: Record<string, string>;
  setValue: (id: string, value: FieldValue) => void;
  signerName: string;
  consent: boolean;
  setConsent: (c: boolean) => void;
  delivery: "download" | "doccle";
  setDelivery: (d: "download" | "doccle") => void;
  doccleRef: string;
  setDoccleRef: (v: string) => void;
  submitting: boolean;
  submit: () => void;
  t: ReturnType<typeof useTranslations>;
}

/// Ancien rendu (grille dense 2 colonnes + résumé détaillé), conservé
/// verbatim pour le filet de sécurité PDF_FORM_LEGACY_LAYOUT (cf. Task 12).
/// Ne reçoit AUCUNE des nouvelles données (renderAs/stepPriority sont
/// ignorés ici par construction — un step "optional-group" est aplati en
/// simple liste de champs, comme un step "fields" classique).
function LegacyRunnerBody({
  form,
  steps,
  activeIndex,
  setActive,
  attemptAdvance,
  locale,
  values,
  errors,
  setValue,
  signerName,
  consent,
  setConsent,
  delivery,
  setDelivery,
  doccleRef,
  setDoccleRef,
  submitting,
  submit,
  t,
}: LegacyRunnerBodyProps) {
  const flatSteps = steps.map((s) =>
    s.kind === "optional-group"
      ? { kind: "fields" as const, id: s.id, title: s.title, subtitle: s.subtitle, fields: s.sections.flatMap((sec) => sec.fields) }
      : s
  );
  const activeIdx = Math.min(activeIndex, flatSteps.length - 1);
  const current = flatSteps[activeIdx];
  const stepHasError = (s: (typeof flatSteps)[number]) => s.kind === "fields" && s.fields.some((f) => errors[f.id]);
  const stepFieldsOf = (s: (typeof flatSteps)[number]): PublicField[] => (s.kind === "fields" ? s.fields : []);
  // Reculer reste libre ; avancer est gaté sur la validité de TOUTES les
  // étapes survolées (cf. attemptAdvance).
  const handleStepSelect = (targetIndex: number) => {
    if (targetIndex <= activeIdx) { setActive(targetIndex); return; }
    attemptAdvance(flatSteps.slice(activeIdx, targetIndex).map(stepFieldsOf), activeIdx, targetIndex);
  };

  const stepIcon = (s: (typeof flatSteps)[number], i: number) => {
    if (s.kind === "summary") return <EyeIcon className="size-4" />;
    return i === 0 ? <UserIcon className="size-4" /> : <FileTextIcon className="size-4" />;
  };

  return (
    <div className="flex flex-col gap-3">
      {(form.locales.length > 1 || form.allowItsme) && (
        <div className="flex flex-wrap items-center gap-2">
          {form.locales.length > 1 &&
            form.locales.map((l) => (
              <Button key={l} size="sm" variant={l === locale ? "default" : "outline"} className="h-7 px-2.5" onClick={() => {}}>
                {LOCALE_NAMES[l]}
              </Button>
            ))}
        </div>
      )}
      <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-sm">
        <div className="flex overflow-x-auto border-b">
          {flatSteps.map((s, i) => {
            const activeTab = i === activeIdx;
            const err = stepHasError(s);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStepSelect(i)}
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
                    {err && <span className="size-1.5 rounded-full bg-destructive" aria-label={t("runnerStepErrorsAria")} />}
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
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-semibold">{current.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {current.kind === "summary" ? t("runnerSummaryStepHelp") : t("runnerFieldsStepHelp")}
                </p>
              </div>
              {current.kind === "fields" && current.fields.length > 0 && (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                  <InfoIcon className="size-3" />
                  {current.fields.every((f) => f.required) ? t("runnerAllFieldsRequired") : t("runnerStarFieldsRequired")}
                </span>
              )}
            </div>

            {current.kind === "summary" ? (
              <SummaryStep form={form} values={values} locale={locale} signerName={signerName} />
            ) : (
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
                      derivedValue={f.derivedFrom ? FIELD_DERIVATIONS[f.derivedFrom.via](values[f.derivedFrom.fieldId] ?? "") : null}
                      relatedPostalCode={f.streetAutocomplete && typeof values[f.streetAutocomplete.postalFieldId] === "string" ? (values[f.streetAutocomplete.postalFieldId] as string) : undefined}
                      onSelectStreetSuggestion={(postalCode) => {
                        if (f.streetAutocomplete) setValue(f.streetAutocomplete.postalFieldId, postalCode);
                      }}
                      parentValues={values}
                    />
                  </div>
                ))}
              </div>
            )}

            {current.kind === "summary" ? (
              <div className="flex flex-col gap-4">
                {form.allowDownload && form.allowDoccle && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{t("runnerDeliveryModeLabel")}</span>
                    <div className="flex gap-1.5">
                      <Button type="button" size="sm" variant={delivery === "download" ? "default" : "outline"} onClick={() => setDelivery("download")}>
                        <DownloadIcon className="size-4" /> {t("runnerDeliveryDownload")}
                      </Button>
                      <Button type="button" size="sm" variant={delivery === "doccle" ? "default" : "outline"} onClick={() => setDelivery("doccle")}>
                        <SendIcon className="size-4" /> {t("runnerDeliveryDoccle")}
                      </Button>
                    </div>
                  </div>
                )}
                {delivery === "doccle" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="doccle-ref-legacy">{t("runnerDoccleRecipientLabel")}</Label>
                    <Input id="doccle-ref-legacy" value={doccleRef} placeholder={t("runnerDoccleRecipientPlaceholder")} onChange={(e) => setDoccleRef(e.target.value)} />
                  </div>
                )}
                <Separator />
                {form.fields.some(isSignatureField) && (
                  <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("runnerDigitalSignatureLabel")}</div>
                    {signerName ? (
                      <>
                        <div className="mt-1 font-serif text-lg italic">{signerName}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{t("runnerDigitalSignatureAutoNote")}</div>
                      </>
                    ) : (
                      <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t("runnerDigitalSignatureNameRequired")}</div>
                    )}
                  </div>
                )}
                <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Checkbox checked={consent} onCheckedChange={(c) => setConsent(c === true)} className="mt-0.5" />
                  <span>{t("runnerConsentText")}</span>
                </label>
                <div className="flex items-center gap-2">
                  {activeIdx > 0 && (
                    <Button type="button" variant="outline" onClick={() => setActive(activeIdx - 1)}>
                      <ChevronLeftIcon className="size-4" /> {t("previous")}
                    </Button>
                  )}
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? <Loader2Icon className="size-4 animate-spin" /> : delivery === "doccle" ? <SendIcon className="size-4" /> : <DownloadIcon className="size-4" />}
                    {submitting ? t("runnerGenerating") : delivery === "doccle" ? t("runnerSubmitSignAndSend") : t("runnerSubmitSignAndGenerate")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                {activeIdx > 0 ? (
                  <Button type="button" variant="outline" onClick={() => setActive(activeIdx - 1)}>
                    <ChevronLeftIcon className="size-4" /> {t("previous")}
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="button" onClick={() => attemptAdvance([stepFieldsOf(current)], activeIdx, activeIdx + 1)}>
                  {t("continue")} <ChevronRightIcon className="size-4" />
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
function SummaryStep({
  form,
  values,
  locale,
  signerName,
}: {
  form: PublicForm;
  values: FormPayload;
  locale: Locale;
  signerName: string;
}) {
  const t = useTranslations("public.dossier");
  return (
    <div className="flex flex-col divide-y rounded-xl border">
      {form.fields.map((f) => {
        const raw = values[f.id];
        let display = "";
        if (f.type === "checkbox") display = raw === true ? t("yes") : t("no");
        else if (isSignatureField(f))
          display = signerName
            ? t("runnerSummarySignedWithName", { name: signerName })
            : t("runnerSummarySigned");
        else if (isCreationDateField(f))
          display = todayISO();
        else if (f.type === "fullname" && raw && typeof raw === "object") {
          const o = raw as { first?: string; last?: string };
          display = [o.first, o.last].filter(Boolean).join(" ");
        } else display = raw === undefined || raw === null ? "" : String(raw);
        return (
          <div key={f.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">{loc(f.label, locale) || f.id}</span>
            <span className={`text-right font-medium ${display ? "" : "italic text-muted-foreground"}`}>
              {display || t("runnerEmptyDash")}
            </span>
          </div>
        );
      })}
    </div>
  );
}
