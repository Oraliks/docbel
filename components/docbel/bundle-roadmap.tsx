"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Archive,
  Download,
  ExternalLink,
  Landmark,
  ListChecks,
  Mail,
  Paperclip,
  Printer,
  ShieldAlert,
  Signature,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { CompletionFeedback } from "@/components/docbel/completion-feedback";

export interface RoadmapDocument {
  slug: string;
  title: string;
  href: string;
  pdfFormId: string;
}

export interface RoadmapExternalDocument {
  slug: string;
  title: string;
  issuer: string;
  required: boolean;
}

interface BundleRoadmapProps {
  documents: RoadmapDocument[];
  externalDocuments: RoadmapExternalDocument[];
  resumeCode: string | null;
  bundleRunId: string | null;
  userEmail: string | null;
}

interface RoadmapStep {
  key: string;
  icon: ReactNode;
  title: string;
  body?: string;
  content?: ReactNode;
}

/** Ecran de sortie sobre : recuperer, verifier puis envoyer le dossier. */
export function BundleRoadmap({
  documents,
  externalDocuments,
  resumeCode,
  bundleRunId,
  userEmail,
}: BundleRoadmapProps) {
  const t = useTranslations("public.dossier");
  const [emailTo, setEmailTo] = useState(userEmail ?? "");
  const [emailConsent, setEmailConsent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  async function sendByEmail() {
    if (!bundleRunId) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/bundles/runs/${bundleRunId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo.trim(), consent: emailConsent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || t("roadmapEmailError"));
        return;
      }
      toast.success(t("roadmapEmailSuccess"));
      setEmailDialogOpen(false);
    } catch {
      toast.error(t("roadmapEmailError"));
    } finally {
      setSendingEmail(false);
    }
  }

  const requiredExternal = externalDocuments.filter((document) => document.required);
  const steps: RoadmapStep[] = [];

  if (documents.length > 0) {
    steps.push({
      key: "docs",
      icon: <Signature className="size-4" aria-hidden />,
      title: t("roadmapStepDocs"),
      body: t("roadmapStepDocsHint"),
      content: (
        <>
          <ul className="mt-2 flex flex-col gap-2">
            {documents.map((document) => (
              <li
                key={document.slug}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="text-sm font-medium">{document.title}</span>
                {bundleRunId ? (
                  <Button
                    render={
                      <a
                        href={`/api/bundles/runs/${bundleRunId}/download/${document.pdfFormId}`}
                      />
                    }
                    nativeButton={false}
                    size="sm"
                  >
                    <Download data-icon="inline-start" aria-hidden />
                    {t("roadmapDownloadOne")}
                  </Button>
                ) : null}
                <Button
                  render={<Link href={document.href} />}
                  nativeButton={false}
                  size="sm"
                  variant="outline"
                >
                  <ExternalLink data-icon="inline-start" aria-hidden />
                  {t("roadmapReview")}
                </Button>
              </li>
            ))}
          </ul>

          {bundleRunId ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
              <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogTrigger
                  render={
                    <Button size="sm" variant="outline">
                      <Mail data-icon="inline-start" aria-hidden />
                      {t("roadmapSendByEmail")}
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("roadmapSendByEmail")}</DialogTitle>
                  </DialogHeader>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="roadmap-email-to">
                        {t("roadmapEmailToLabel")}
                      </FieldLabel>
                      <Input
                        id="roadmap-email-to"
                        type="email"
                        value={emailTo}
                        onChange={(event) => setEmailTo(event.target.value)}
                      />
                    </Field>
                    <Field orientation="horizontal">
                      <Checkbox
                        id="roadmap-email-consent"
                        checked={emailConsent}
                        onCheckedChange={(checked) =>
                          setEmailConsent(checked === true)
                        }
                      />
                      <FieldLabel htmlFor="roadmap-email-consent">
                        {t("roadmapEmailConsent")}
                      </FieldLabel>
                    </Field>
                  </FieldGroup>
                  <DialogFooter>
                    <Button
                      onClick={sendByEmail}
                      disabled={
                        sendingEmail || !emailConsent || !emailTo.trim()
                      }
                    >
                      {sendingEmail
                        ? t("roadmapEmailSending")
                        : t("roadmapSendByEmail")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : null}
        </>
      ),
    });
  }

  if (requiredExternal.length > 0) {
    steps.push({
      key: "attach",
      icon: <Paperclip className="size-4" aria-hidden />,
      title: t("roadmapStepAttach"),
      body: t("roadmapStepAttachHint"),
      content: (
        <ul className="mt-2 flex flex-col gap-2">
          {requiredExternal.map((document) => (
            <li
              key={document.slug}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-sm font-medium">{document.title}</span>
              <Badge variant="outline">
                {t("roadmapAttachFrom", { issuer: document.issuer })}
              </Badge>
            </li>
          ))}
        </ul>
      ),
    });
  }

  steps.push({
    key: "send",
    icon: <Landmark className="size-4" aria-hidden />,
    title: t("roadmapStepSend"),
    body: t("roadmapStepSendBody"),
  });

  if (resumeCode) {
    steps.push({
      key: "keep",
      icon: <ListChecks className="size-4" aria-hidden />,
      title: t("roadmapStepKeep"),
      body: t("roadmapStepKeepBody"),
      content: (
        <p className="mt-2 font-mono text-sm font-semibold tracking-wider">
          {resumeCode}
        </p>
      ),
    });
  }

  return (
    <section
      id="recuperer-envoyer"
      className="glass-surface flex flex-col gap-5 rounded-3xl p-4 sm:p-5"
    >
      <CompletionFeedback
        kind="dossier"
        title={t("roadmapTitle")}
        description={t("roadmapIntro")}
        action={
          <>
            {bundleRunId ? (
              <Button
                render={
                  <a href={`/api/bundles/runs/${bundleRunId}/download-all`} />
                }
                nativeButton={false}
                size="sm"
              >
                <Archive data-icon="inline-start" aria-hidden />
                {t("roadmapDownloadAll")}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer data-icon="inline-start" aria-hidden />
              {t("roadmapPrint")}
            </Button>
          </>
        }
      />

      <ol className="flex flex-col gap-4">
        {steps.map((step, index) => (
          <li key={step.key} className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--success-border)] bg-[color:var(--success-subtle)] text-sm font-semibold text-[color:var(--success-subtle-foreground)]">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium text-[color:var(--glass-ink)]">
                {step.icon}
                {step.title}
              </p>
              {step.body ? (
                <p className="mt-0.5 text-sm text-[color:var(--glass-ink-soft)]">
                  {step.body}
                </p>
              ) : null}
              {step.content}
            </div>
          </li>
        ))}
      </ol>

      <Separator />
      <p className="flex items-start gap-2 text-xs text-[color:var(--glass-ink-soft)]">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("roadmapDisclaimer")}
      </p>
    </section>
  );
}
