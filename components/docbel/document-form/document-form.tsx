"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SaveIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { DocumentField, GenerationPayload, Lang, getFieldLabel } from "@/lib/documents/types";
import { GLASS_CARD, GLASS_PRIMARY_STYLE } from "@/lib/glass-classes";
import { isFieldVisible } from "@/lib/documents/schema-zod";
import { IconDisplay } from "@/components/admin/documents/icon-picker";
import { RgpdConsent } from "./rgpd-consent";
import { DynamicField } from "./dynamic-field";
import { ConditionalWrapper } from "./conditional-wrapper";
import { DocumentPreview } from "./document-preview";
import { DownloadActions } from "./download-actions";
import { DraftResumeBanner } from "./draft-resume-banner";
import { SignatureStep } from "./signature-step";
import { trackFormEvent } from "@/lib/documents/analytics-client";

interface ApiResponse {
  tool: {
    id: string;
    name: string;
    slug: string;
    description: string;
    icon: string | null;
    sectionName: string;
  };
  template: {
    id: string;
    sourceType: string;
    schema: DocumentField[];
    rgpdNotice: string | null;
    outputFilenameTpl: string;
    version: number;
    requiresSignature?: boolean;
    officialRef?: string | null;
  };
  settings?: {
    aiHelpEnabled?: boolean;
  };
}

type Step = "loading" | "draft-prompt" | "rgpd" | "filling" | "preview" | "signature" | "done";

interface SignatureState {
  dataUrl: string;
  method: "drawn" | "typed" | "uploaded";
  signerName: string;
  signerEmail: string;
}

interface GeneratedInfo {
  id: string;
  filename: string;
  downloadUrl: string;
  expiresAt: string;
}

interface DocumentFormProps {
  slug: string;
}

interface SectionGroup {
  name: string;
  fields: DocumentField[];
}

function groupBySection(fields: DocumentField[]): SectionGroup[] {
  // Conserve l'ordre des sections selon leur première apparition
  const groups: SectionGroup[] = [];
  const map = new Map<string, SectionGroup>();
  for (const f of fields) {
    const name = f.section || "";
    if (!map.has(name)) {
      const g: SectionGroup = { name, fields: [] };
      map.set(name, g);
      groups.push(g);
    }
    map.get(name)!.fields.push(f);
  }
  return groups;
}

export function DocumentForm({ slug }: DocumentFormProps) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user?.id;

  // Si l'utilisateur arrive via un bundle, l'URL contient ?bundleRun=<id>&bundleSlug=<slug>
  // Lecture simple via window (évite import useSearchParams qui force suspense boundary)
  const urlParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const bundleRunId = urlParams?.get("bundleRun") || null;
  const bundleSlug = urlParams?.get("bundleSlug") || null;

  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [draft, setDraft] = useState<{ payload: GenerationPayload; updatedAt: string } | null>(null);
  const [generated, setGenerated] = useState<GeneratedInfo | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [lang, setLang] = useState<Lang>("fr");
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [signature, setSignature] = useState<SignatureState | null>(null);

  const methods = useForm<GenerationPayload>({ mode: "onSubmit", defaultValues: {} });

  const fields = data?.template.schema || [];
  const sections = useMemo(() => groupBySection(fields), [fields]);
  const isWizard = sections.length > 1 || (sections.length === 1 && sections[0].name !== "");
  const currentSection = sections[currentSectionIdx];

  // 1) Charger le template
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents/by-slug/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Erreur de chargement");
        return res.json();
      })
      .then((d: ApiResponse) => {
        if (cancelled) return;
        setData(d);
        const defaults: GenerationPayload = {};
        for (const f of d.template.schema) {
          if (f.defaultValue !== undefined) {
            defaults[f.id] = f.defaultValue as GenerationPayload[string];
          } else if (f.type === "checkbox") {
            defaults[f.id] = false;
          } else {
            defaults[f.id] = "";
          }
        }
        methods.reset(defaults);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erreur");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // 2) Charger le brouillon si connecté + data prête
  useEffect(() => {
    if (!data) return;
    if (!isLoggedIn) {
      setStep("rgpd");
      return;
    }
    let cancelled = false;
    fetch(`/api/documents/${data.template.id}/draft`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.draft) {
          setDraft({
            payload: d.draft.payload as GenerationPayload,
            updatedAt: d.draft.updatedAt,
          });
          setStep("draft-prompt");
        } else {
          setStep("rgpd");
        }
      })
      .catch(() => {
        if (!cancelled) setStep("rgpd");
      });
    return () => {
      cancelled = true;
    };
  }, [data, isLoggedIn]);

  // 3) Pré-remplissage utilisateur connecté quand on entre dans "filling"
  // Combine session.user (basic) + profil enrichi (Phase 8) si dispo
  useEffect(() => {
    if (step !== "filling" || !data || !isLoggedIn || !session?.user) return;
    const user = session.user;
    let cancelled = false;

    async function applyPrefill() {
      const current = methods.getValues();
      let profile: Record<string, unknown> | null = null;
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) profile = await res.json();
      } catch {
        // ignore — pas de profil
      }
      if (cancelled) return;

      let didUpdate = false;
      for (const f of data!.template.schema) {
        if (!f.prefillFrom) continue;
        const existing = current[f.id];
        if (existing && existing !== "") continue; // ne pas écraser

        let v: unknown = null;
        if (f.prefillFrom === "user.name") v = user.name;
        else if (f.prefillFrom === "user.email") v = user.email;
        else if (f.prefillFrom.startsWith("profile.") && profile) {
          const key = f.prefillFrom.slice("profile.".length);
          v = profile[key];
          // Format des dates ISO → YYYY-MM-DD pour input type=date
          if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
            v = v.slice(0, 10);
          }
        }

        if (v !== null && v !== undefined && v !== "") {
          methods.setValue(f.id, v as string);
          didUpdate = true;
        }
      }
      if (didUpdate) toast.success(lang === "nl" ? "Velden vooraf ingevuld" : "Champs pré-remplis");
    }

    void applyPrefill();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, data, isLoggedIn]);

  // Tracking : événement "started" quand on entre en filling pour la première fois
  useEffect(() => {
    if (step === "filling" && data) {
      trackFormEvent(data.template.id, "started");
    } else if (step === "preview" && data) {
      trackFormEvent(data.template.id, "preview");
    } else if (step === "signature" && data) {
      trackFormEvent(data.template.id, "signature_started");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Tracking : abandon si l'utilisateur quitte avant submit
  useEffect(() => {
    if (!data) return;
    function handleUnload() {
      if (step === "filling" || step === "preview" || step === "signature") {
        trackFormEvent(data!.template.id, "abandoned", {
          contextKey: step,
          metadata: { sectionIdx: currentSectionIdx },
        });
      }
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [step, data, currentSectionIdx]);

  // Tracking : section_completed quand on avance dans le wizard
  useEffect(() => {
    if (!data || !isWizard || step !== "filling") return;
    if (currentSectionIdx > 0) {
      const prevSection = sections[currentSectionIdx - 1];
      trackFormEvent(data.template.id, "section_completed", {
        contextKey: prevSection?.name || `section_${currentSectionIdx - 1}`,
      });
    }

    // a11y : focus le premier champ de la nouvelle section pour les lecteurs d'écran
    if (currentSection) {
      const firstField = currentSection.fields[0];
      if (firstField) {
        const el = document.getElementById(`field_${firstField.id}`);
        if (el && "focus" in el) {
          // Délai pour laisser le rendu se terminer
          setTimeout(() => (el as HTMLElement).focus(), 100);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSectionIdx]);

  function resumeDraft() {
    if (draft) methods.reset(draft.payload);
    setStep("filling");
    setCurrentSectionIdx(0);
  }

  async function discardDraft() {
    if (!data) return;
    if (isLoggedIn) {
      await fetch(`/api/documents/${data.template.id}/draft`, { method: "DELETE" }).catch(() => {});
    }
    setDraft(null);
    setStep("rgpd");
  }

  async function saveDraft() {
    if (!data || !isLoggedIn) return;
    setSavingDraft(true);
    try {
      const payload = methods.getValues();
      const res = await fetch(`/api/documents/${data.template.id}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      if (!res.ok) throw new Error("Échec");
      toast.success(lang === "nl" ? "Concept opgeslagen" : "Brouillon sauvegardé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingDraft(false);
    }
  }

  function nextSection() {
    methods.handleSubmit(() => {
      if (currentSectionIdx < sections.length - 1) {
        setCurrentSectionIdx((i) => i + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setStep("preview");
      }
    })();
  }

  function prevSection() {
    if (currentSectionIdx > 0) {
      setCurrentSectionIdx((i) => i - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goToPreview() {
    methods.handleSubmit(() => setStep("preview"))();
  }

  function goToSignatureOrGenerate() {
    if (data?.template.requiresSignature) {
      setStep("signature");
      return;
    }
    void generate();
  }

  async function generate() {
    if (!data) return;
    // Si le doc requiert signature, on doit avoir une signature
    if (data.template.requiresSignature && !signature) {
      setStep("signature");
      return;
    }
    setGenerating(true);
    setServerErrors({});
    try {
      const payload = methods.getValues();
      const body: Record<string, unknown> = { payload, consent: true, lang };
      if (bundleRunId) {
        body.bundleRunId = bundleRunId;
      }
      if (signature) {
        body.signature = {
          dataUrl: signature.dataUrl,
          method: signature.method,
          signerName: signature.signerName,
          signerEmail: signature.signerEmail || undefined,
        };
      }
      const res = await fetch(`/api/documents/${data.template.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 422 && Array.isArray(json.issues)) {
          const errs: Record<string, string> = {};
          for (const i of json.issues) errs[String(i.field)] = i.message;
          setServerErrors(errs);
          setStep("filling");
          // Tracking : champ(s) en erreur
          for (const issue of json.issues) {
            trackFormEvent(data.template.id, "field_error", {
              contextKey: String(issue.field),
              metadata: { errorMsg: issue.message },
            });
          }
          // Aller à la section qui contient le premier champ en erreur
          if (isWizard) {
            const firstErrorField = json.issues[0]?.field;
            const sectionIdx = sections.findIndex((s) => s.fields.some((f) => f.id === firstErrorField));
            if (sectionIdx >= 0) setCurrentSectionIdx(sectionIdx);
          }
          toast.error(lang === "nl" ? "Corrigeer de fouten" : "Veuillez corriger les erreurs");
          return;
        }
        throw new Error(json.error || "Échec");
      }
      setGenerated({
        id: json.id,
        filename: json.filename,
        downloadUrl: json.downloadUrl,
        expiresAt: json.expiresAt,
      });
      trackFormEvent(data.template.id, "submitted", {
        metadata: { signed: !!signature, isLoggedIn },
      });
      if (isLoggedIn) {
        await fetch(`/api/documents/${data.template.id}/draft`, { method: "DELETE" }).catch(() => {});
      }
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setGenerating(false);
    }
  }

  function restart() {
    methods.reset();
    setGenerated(null);
    setServerErrors({});
    setCurrentSectionIdx(0);
    setStep("rgpd");
  }

  if (error) {
    return (
      <Card className={GLASS_CARD}>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p
            className="font-semibold"
            style={{ color: "#b8324a" }}
          >
            {error}
          </p>
          <Button
            render={<Link href="/" />}
            className="rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55"
            variant="outline"
          >
            Retour
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "loading" || !data) {
    return (
      <Card className={GLASS_CARD}>
        <CardContent className="py-12 text-center text-[color:var(--glass-ink-soft)]">
          {lang === "nl" ? "Laden…" : "Chargement…"}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            {lang === "nl" ? "Terug" : "Retour"}
          </Button>
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]"
            style={{ background: "var(--glass-surface)" }}
          >
            {data.tool.sectionName}
          </span>
        </div>

        {/* Toggle langue */}
        <div
          className="inline-flex rounded-full border border-[color:var(--glass-border)] p-1"
          style={{ background: "var(--glass-surface)" }}
        >
          <button
            type="button"
            onClick={() => setLang("fr")}
            className="rounded-full px-3 py-1 text-[11.5px] font-bold transition"
            style={
              lang === "fr"
                ? GLASS_PRIMARY_STYLE
                : { color: "var(--glass-ink-soft)" }
            }
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => setLang("nl")}
            className="rounded-full px-3 py-1 text-[11.5px] font-bold transition"
            style={
              lang === "nl"
                ? GLASS_PRIMARY_STYLE
                : { color: "var(--glass-ink-soft)" }
            }
          >
            NL
          </button>
        </div>
      </div>

      <Card className={GLASS_CARD}>
        <CardHeader className="px-7 pt-7 pb-3">
          <div className="flex items-center gap-4">
            <span
              className="flex size-14 items-center justify-center rounded-2xl text-white"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
              }}
            >
              <IconDisplay
                value={data.tool.icon || "FileText"}
                className="w-7 h-7"
              />
            </span>
            <div className="flex flex-col gap-1">
              <CardTitle className="glass-display text-[24px] font-semibold sm:text-[28px]">
                {data.tool.name}
              </CardTitle>
              <p className="text-[13.5px] text-[color:var(--glass-ink-soft)]">
                {data.tool.description}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {step === "draft-prompt" && draft && (
        <DraftResumeBanner
          updatedAt={draft.updatedAt}
          onResume={resumeDraft}
          onDiscard={discardDraft}
        />
      )}

      {step === "rgpd" && (
        <RgpdConsent
          notice={data.template.rgpdNotice}
          onContinue={() => {
            setStep("filling");
            setCurrentSectionIdx(0);
          }}
        />
      )}

      {step === "filling" && (
        <FormProvider {...methods}>
          {/* Wizard breadcrumb */}
          {isWizard && sections.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {sections.map((s, idx) => {
                const isCurrent = idx === currentSectionIdx;
                const isDone = idx < currentSectionIdx;
                return (
                  <span key={idx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        idx <= currentSectionIdx && setCurrentSectionIdx(idx)
                      }
                      className="rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
                      style={
                        isCurrent
                          ? {
                              ...GLASS_PRIMARY_STYLE,
                              borderColor: "transparent",
                            }
                          : isDone
                            ? {
                                background: "var(--glass-surface)",
                                color: "var(--glass-ink-soft)",
                                borderColor: "var(--glass-border)",
                              }
                            : {
                                borderColor: "var(--glass-ink-line)",
                                borderStyle: "dashed",
                                color: "var(--glass-ink-faint)",
                              }
                      }
                      disabled={idx > currentSectionIdx}
                    >
                      {idx + 1}.{" "}
                      {s.name || (lang === "nl" ? "Algemeen" : "Général")}
                    </button>
                    {idx < sections.length - 1 ? (
                      <span className="text-[color:var(--glass-ink-faint)]">
                        ›
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </div>
          ) : null}

          <Card className={GLASS_CARD}>
            <CardHeader className="flex flex-row items-center justify-between px-7 pt-7 pb-3">
              <CardTitle className="glass-display text-[22px] font-semibold">
                {isWizard && currentSection
                  ? currentSection.name ||
                    (lang === "nl" ? "Algemeen" : "Général")
                  : lang === "nl"
                    ? "Vul het formulier in"
                    : "Remplissez le formulaire"}
              </CardTitle>
              {isLoggedIn ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={saveDraft}
                  disabled={savingDraft}
                  className="rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55"
                >
                  <SaveIcon className="w-4 h-4 mr-1" />
                  {savingDraft
                    ? lang === "nl"
                      ? "Opslaan…"
                      : "Sauvegarde…"
                    : lang === "nl"
                      ? "Concept opslaan"
                      : "Sauvegarder le brouillon"}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="px-7 pb-7">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  isWizard ? nextSection() : goToPreview();
                }}
                className="flex flex-col gap-4"
              >
                {(isWizard && currentSection
                  ? currentSection.fields
                  : fields
                ).map((f) => (
                  <ConditionalWrapper key={f.id} field={f}>
                    <DynamicField
                      field={f}
                      allFields={fields}
                      serverError={serverErrors[f.id]}
                      lang={lang}
                      templateName={data?.tool.name || ""}
                      organisme={data?.tool.sectionName || null}
                      aiHelpEnabled={data?.settings?.aiHelpEnabled === true}
                    />
                  </ConditionalWrapper>
                ))}
                {/* Espace en bas pour ne pas être caché par la barre sticky mobile */}
                <div className="h-16 md:h-0" />

                {/* Action bar : flottante sur mobile, inline sur desktop */}
                <div className="hidden justify-between gap-2 pt-2 md:flex">
                  {isWizard && currentSectionIdx > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={prevSection}
                      className="rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55"
                    >
                      <ChevronLeftIcon className="w-4 h-4 mr-1" />
                      {lang === "nl" ? "Vorige" : "Précédent"}
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button
                    type="submit"
                    className="rounded-full font-bold"
                    style={GLASS_PRIMARY_STYLE}
                  >
                    {isWizard && currentSectionIdx < sections.length - 1 ? (
                      <>
                        {lang === "nl" ? "Volgende" : "Suivant"}
                        <ChevronRightIcon className="w-4 h-4 ml-1" />
                      </>
                    ) : lang === "nl" ? (
                      "Voorvertoning"
                    ) : (
                      "Aperçu"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Sticky bar mobile uniquement */}
          <div
            className="glass-surface fixed right-3 bottom-3 left-3 z-40 flex gap-2 !rounded-2xl p-3 md:hidden"
          >
            {isWizard && currentSectionIdx > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={prevSection}
                className="flex-1 rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55"
              >
                <ChevronLeftIcon className="w-4 h-4 mr-1" />
                {lang === "nl" ? "Vorige" : "Précédent"}
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => {
                if (isWizard) nextSection();
                else goToPreview();
              }}
              className="flex-1 rounded-full font-bold"
              style={GLASS_PRIMARY_STYLE}
            >
              {isWizard && currentSectionIdx < sections.length - 1 ? (
                <>
                  {lang === "nl" ? "Volgende" : "Suivant"}
                  <ChevronRightIcon className="w-4 h-4 ml-1" />
                </>
              ) : lang === "nl" ? (
                "Voorvertoning"
              ) : (
                "Aperçu"
              )}
            </Button>
          </div>
        </FormProvider>
      )}

      {step === "preview" && (
        <FormProvider {...methods}>
          <DocumentPreview
            fields={fields}
            payload={
              Object.fromEntries(
                fields
                  .filter((f) => isFieldVisible(f, methods.getValues()))
                  .map((f) => [f.id, methods.getValues(f.id) as never])
              ) as GenerationPayload
            }
            onBack={() => setStep("filling")}
            onConfirm={goToSignatureOrGenerate}
            generating={generating}
            lang={lang}
          />
        </FormProvider>
      )}

      {step === "signature" && data && (
        <SignatureStep
          requiresSignature={!!data.template.requiresSignature}
          initialName={session?.user?.name || ""}
          initialEmail={session?.user?.email || ""}
          signature={signature}
          onSignatureChange={setSignature}
          onBack={() => setStep("preview")}
          onConfirm={generate}
          generating={generating}
          lang={lang}
        />
      )}

      {step === "done" && generated && (
        <>
          <DownloadActions
            generatedId={generated.id}
            filename={generated.filename}
            downloadUrl={generated.downloadUrl}
            expiresAt={generated.expiresAt}
            onRestart={restart}
          />
          {bundleRunId ? (
            <Card className={GLASS_CARD}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 px-7 py-5">
                <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
                  {lang === "nl"
                    ? "Dit document maakt deel uit van een traject. Wilt u terug naar de andere documenten?"
                    : "Ce document fait partie d'un parcours. Retourner aux autres documents ?"}
                </p>
                <Button
                  onClick={() => {
                    if (bundleSlug) {
                      window.location.href = `/outils/bundles/${bundleSlug}`;
                    } else {
                      window.history.back();
                    }
                  }}
                  size="sm"
                  className="rounded-full font-bold"
                  style={GLASS_PRIMARY_STYLE}
                >
                  {lang === "nl"
                    ? "Terug naar het traject"
                    : "Retour au parcours"}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {!isLoggedIn && step !== "done" ? (
        <p className="text-center text-[12.5px] text-[color:var(--glass-ink-soft)]">
          {lang === "nl" ? (
            <>
              Tip:{" "}
              <Link
                href="/login"
                className="font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
              >
                log in
              </Link>{" "}
              om uw formulier op te slaan en later te hervatten.
            </>
          ) : (
            <>
              Astuce :{" "}
              <Link
                href="/login"
                className="font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
              >
                connectez-vous
              </Link>{" "}
              pour pouvoir sauvegarder votre formulaire et le reprendre plus
              tard.
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}

// Helper exporté pour que les sections soient utilisables ailleurs
export { groupBySection };
