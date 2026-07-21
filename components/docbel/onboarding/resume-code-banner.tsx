"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircleIcon,
  CheckIcon,
  CopyIcon,
  KeyRoundIcon,
  Loader2Icon,
  MailIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/i18n/format";

interface Props {
  runId: string;
  resumeCode: string;
  resumeCodeExpiresAt: string | null;
  initialResumeEmail: string | null;
}

export function ResumeCodeBanner({
  runId,
  resumeCode,
  resumeCodeExpiresAt,
  initialResumeEmail,
}: Props) {
  const t = useTranslations("public.dossier");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState(initialResumeEmail ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(Boolean(initialResumeEmail));
  const [showEmailField, setShowEmailField] = useState(!initialResumeEmail);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailInvalid, setEmailInvalid] = useState(false);

  if (dismissed) return null;

  async function copyCode() {
    setError(null);
    setEmailInvalid(false);
    try {
      await navigator.clipboard.writeText(resumeCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success(t("bannerCopySuccess"));
    } catch {
      const message = t("bannerCopyError");
      setError(message);
      toast.error(message);
    }
  }

  async function sendEmail() {
    setError(null);
    setEmailInvalid(false);
    if (!email || !email.includes("@")) {
      setError(t("bannerInvalidEmail"));
      setEmailInvalid(true);
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`/api/bundles/runs/${runId}/email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || t("bannerSendError"));
        return;
      }
      setSent(true);
      toast.success(t("bannerSendSuccess", { email }));
    } catch {
      setError(t("networkErrorRetry"));
    } finally {
      setSending(false);
    }
  }

  const expiresAtText = resumeCodeExpiresAt
    ? formatDate(resumeCodeExpiresAt, locale)
    : t("bannerExpiresFallback");

  return (
    <Alert
      role="region"
      aria-label={t("bannerTitle")}
      className="glass-surface gap-y-3 p-4 sm:p-5"
    >
      <KeyRoundIcon aria-hidden />
      <AlertTitle className="pr-10 text-base font-semibold">
        {t("bannerTitle")}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-4 text-left">
        <p>
          {t.rich("bannerBody", {
            expiresAt: expiresAtText,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <code
            dir="ltr"
            className="select-all rounded-xl bg-[color:var(--glass-surface-strong)] px-4 py-2 text-center font-mono text-base font-semibold tracking-[0.12em] text-[color:var(--glass-ink)] sm:text-left"
          >
            {resumeCode}
          </code>
          <Button
            type="button"
            size="sm"
            variant={copied ? "default" : "outline"}
            onClick={copyCode}
            className="min-h-10"
          >
            {copied ? (
              <CheckIcon data-icon="inline-start" aria-hidden />
            ) : (
              <CopyIcon data-icon="inline-start" aria-hidden />
            )}
            {copied ? t("bannerCopied") : t("copy")}
          </Button>
          {!showEmailField && !sent ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowEmailField(true)}
              className="min-h-10"
            >
              <MailIcon data-icon="inline-start" aria-hidden />
              {t("bannerReceiveByEmail")}
            </Button>
          ) : null}
          {sent ? (
            <span className="inline-flex min-h-10 items-center gap-2 text-sm text-[color:var(--glass-ink-soft)]">
              <CheckIcon className="size-4" aria-hidden />
              {t("bannerSentTo", { email })}
            </span>
          ) : null}
        </div>

        {showEmailField && !sent ? (
          <FieldGroup className="max-w-xl">
            <Field data-invalid={emailInvalid}>
              <FieldLabel htmlFor="resume-email">
                {t("bannerEmailLabel")}
              </FieldLabel>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="resume-email"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                    setEmailInvalid(false);
                  }}
                  placeholder={t("bannerEmailPlaceholder")}
                  autoComplete="email"
                  disabled={sending}
                  aria-invalid={emailInvalid}
                  className="h-10 flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={sendEmail}
                  disabled={sending || !email.includes("@")}
                  className="min-h-10"
                >
                  {sending ? (
                    <Loader2Icon
                      data-icon="inline-start"
                      className="animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <MailIcon data-icon="inline-start" aria-hidden />
                  )}
                  {sending ? t("bannerSending") : t("send")}
                </Button>
              </div>
            </Field>
          </FieldGroup>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertCircleIcon aria-hidden />
            <AlertTitle>{t("error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </AlertDescription>
      <AlertAction>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setDismissed(true)}
          aria-label={t("hide")}
        >
          <XIcon aria-hidden />
        </Button>
      </AlertAction>
    </Alert>
  );
}
