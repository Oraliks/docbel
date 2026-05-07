"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeftIcon, Save, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { authClient } from "@/lib/auth-client";
import { DocumentField, GenerationPayload, Lang, getFieldLabel } from "@/lib/documents/types";
import { isFieldVisible } from "@/lib/documents/schema-zod";
import { IconDisplay } from "@/components/admin/documents/icon-picker";
import { RgpdConsent } from "./rgpd-consent";
import { DynamicField } from "./dynamic-field";
import { ConditionalWrapper } from "./conditional-wrapper";
import { DocumentPreview } from "./document-preview";
import { DownloadActions } from "./download-actions";
import { DraftResumeBanner } from "./draft-resume-banner";

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
  };
}

type Step = "loading" | "draft-prompt" | "rgpd" | "filling" | "preview" | "done";

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
  useEffect(() => {
    if (step !== "filling" || !data || !isLoggedIn || !session?.user) return;
    const user = session.user;
    const current = methods.getValues();
    let didUpdate = false;
    for (const f of data.template.schema) {
      if (!f.prefillFrom) continue;
      const existing = current[f.id];
      if (existing && existing !== "") continue; // ne pas écraser
      if (f.prefillFrom === "user.name" && user.name) {
        methods.setValue(f.id, user.name);
        didUpdate = true;
      } else if (f.prefillFrom === "user.email" && user.email) {
        methods.setValue(f.id, user.email);
        didUpdate = true;
      }
    }
    if (didUpdate) toast.success(lang === "nl" ? "Velden vooraf ingevuld" : "Champs pré-remplis");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, data, isLoggedIn]);

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

  async function generate() {
    if (!data) return;
    setGenerating(true);
    setServerErrors({});
    try {
      const payload = methods.getValues();
      const res = await fetch(`/api/documents/${data.template.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, consent: true, lang }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 422 && Array.isArray(json.issues)) {
          const errs: Record<string, string> = {};
          for (const i of json.issues) errs[String(i.field)] = i.message;
          setServerErrors(errs);
          setStep("filling");
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
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive">{error}</p>
          <Button render={<Link href="/" />} className="mt-4" variant="outline">
            Retour
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "loading" || !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {lang === "nl" ? "Laden…" : "Chargement…"}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            {lang === "nl" ? "Terug" : "Retour"}
          </Button>
          <Badge variant="secondary">{data.tool.sectionName}</Badge>
        </div>

        {/* Toggle langue */}
        <div className="inline-flex rounded-md border bg-background p-0.5">
          <button
            type="button"
            onClick={() => setLang("fr")}
            className={`px-3 py-1 text-xs font-medium rounded ${
              lang === "fr" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => setLang("nl")}
            className={`px-3 py-1 text-xs font-medium rounded ${
              lang === "nl" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            NL
          </button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconDisplay value={data.tool.icon || "FileText"} className="w-6 h-6" />
            </span>
            <div>
              <CardTitle className="text-2xl">{data.tool.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{data.tool.description}</p>
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
          {isWizard && sections.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {sections.map((s, idx) => (
                <span key={idx} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => idx <= currentSectionIdx && setCurrentSectionIdx(idx)}
                    className={`px-3 py-1 rounded-full border transition-colors ${
                      idx === currentSectionIdx
                        ? "bg-primary text-primary-foreground border-primary"
                        : idx < currentSectionIdx
                        ? "bg-muted border-border text-muted-foreground hover:text-foreground cursor-pointer"
                        : "border-dashed text-muted-foreground"
                    }`}
                    disabled={idx > currentSectionIdx}
                  >
                    {idx + 1}. {s.name || (lang === "nl" ? "Algemeen" : "Général")}
                  </button>
                  {idx < sections.length - 1 && <span className="text-muted-foreground">›</span>}
                </span>
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {isWizard && currentSection
                  ? currentSection.name || (lang === "nl" ? "Algemeen" : "Général")
                  : lang === "nl"
                  ? "Vul het formulier in"
                  : "Remplissez le formulaire"}
              </CardTitle>
              {isLoggedIn && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={saveDraft}
                  disabled={savingDraft}
                >
                  <Save className="w-4 h-4 mr-1" />
                  {savingDraft
                    ? lang === "nl"
                      ? "Opslaan…"
                      : "Sauvegarde…"
                    : lang === "nl"
                    ? "Concept opslaan"
                    : "Sauvegarder le brouillon"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  isWizard ? nextSection() : goToPreview();
                }}
                className="space-y-4"
              >
                {(isWizard && currentSection ? currentSection.fields : fields).map((f) => (
                  <ConditionalWrapper key={f.id} field={f}>
                    <DynamicField field={f} serverError={serverErrors[f.id]} lang={lang} />
                  </ConditionalWrapper>
                ))}
                <div className="flex justify-between gap-2 pt-2">
                  {isWizard && currentSectionIdx > 0 ? (
                    <Button type="button" variant="outline" onClick={prevSection}>
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      {lang === "nl" ? "Vorige" : "Précédent"}
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button type="submit">
                    {isWizard && currentSectionIdx < sections.length - 1 ? (
                      <>
                        {lang === "nl" ? "Volgende" : "Suivant"}
                        <ChevronRight className="w-4 h-4 ml-1" />
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
            onConfirm={generate}
            generating={generating}
            lang={lang}
          />
        </FormProvider>
      )}

      {step === "done" && generated && (
        <DownloadActions
          generatedId={generated.id}
          filename={generated.filename}
          downloadUrl={generated.downloadUrl}
          expiresAt={generated.expiresAt}
          onRestart={restart}
        />
      )}

      {!isLoggedIn && step !== "done" && (
        <p className="text-xs text-muted-foreground text-center">
          {lang === "nl" ? (
            <>
              Tip:{" "}
              <Link href="/login" className="underline">
                log in
              </Link>{" "}
              om uw formulier op te slaan en later te hervatten.
            </>
          ) : (
            <>
              Astuce :{" "}
              <Link href="/login" className="underline">
                connectez-vous
              </Link>{" "}
              pour pouvoir sauvegarder votre formulaire et le reprendre plus tard.
            </>
          )}
        </p>
      )}
    </div>
  );
}

// Helper exporté pour que les sections soient utilisables ailleurs
export { groupBySection };
