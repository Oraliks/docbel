"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CompassIcon,
  KeyRoundIcon,
  Loader2Icon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  isValidResumeCodeFormat,
  normalizeResumeCode,
} from "@/lib/bundles/resume-code";

export function ResumeForm() {
  const router = useRouter();
  const t = useTranslations("public.dossier");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeResumeCode(code);
  const formatLooksValid =
    code.length === 0 || isValidResumeCodeFormat(normalized);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const finalCode = normalizeResumeCode(code);

    if (!isValidResumeCodeFormat(finalCode)) {
      setError(t("resumeFormatError"));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/bundles/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: finalCode }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 410) {
          setError(t("resumeExpiredError"));
        } else if (response.status === 404) {
          setError(t("resumeNotFoundError"));
        } else if (response.status === 429) {
          setError(t("resumeRateLimitedError"));
        } else {
          setError(data.error || t("resumeGenericError"));
        }
        return;
      }

      const data = (await response.json()) as {
        runId: string;
        bundleSlug: string;
        bundleName: string;
      };
      toast.success(t("resumeSuccess", { name: data.bundleName }));
      router.push(
        `/d/${data.bundleSlug}?bundleRun=${encodeURIComponent(data.runId)}&demarrer=1`,
      );
    } catch {
      setError(t("networkErrorRetry"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-6">
      <Card className="rounded-3xl">
        <form onSubmit={handleSubmit} className="flex h-full flex-col gap-5">
          <CardHeader className="gap-2 px-5 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]">
                <KeyRoundIcon className="size-5" aria-hidden />
              </span>
              <CardTitle>
                <h2 className="text-xl font-semibold">{t("resumeHasCodeTitle")}</h2>
              </CardTitle>
            </div>
            <CardDescription className="text-sm leading-relaxed">
              {t.rich("resumeHasCodeBody", {
                code: (chunks) => <code>{chunks}</code>,
              })}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 px-5 sm:px-6">
            <FieldGroup>
              <Field
                data-invalid={Boolean(error) || (!formatLooksValid && code.length > 0)}
              >
                <FieldLabel htmlFor="resume-code">
                  {t("resumeCodeLabel")}
                </FieldLabel>
                <Input
                  id="resume-code"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError(null);
                  }}
                  placeholder={t("resumeCodePlaceholder")}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-invalid={Boolean(error) || (!formatLooksValid && code.length > 0)}
                  aria-describedby={error ? "resume-error" : "resume-code-help"}
                  className="h-12 font-mono text-base tracking-[0.12em] uppercase"
                />
                <FieldDescription id="resume-code-help">
                  {t("resumeFormatHint")}
                </FieldDescription>
              </Field>

              {error ? (
                <Alert id="resume-error" variant="destructive">
                  <AlertCircleIcon aria-hidden />
                  <AlertTitle>{t("error")}</AlertTitle>
                  <AlertDescription className="flex flex-col items-start gap-3">
                    <p>{error}</p>
                    <Button
                      render={<Link href="/mon-dossier" />}
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                    >
                      {t("resumeStartDossier")}
                      <ArrowRightIcon data-icon="inline-end" aria-hidden />
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}
            </FieldGroup>
          </CardContent>

          <CardFooter className="border-0 bg-transparent px-5 pt-0 sm:px-6">
            <Button
              type="submit"
              size="lg"
              disabled={loading || !isValidResumeCodeFormat(normalized)}
              className="min-h-12 w-full text-base"
            >
              {loading ? (
                <Loader2Icon
                  data-icon="inline-start"
                  className="animate-spin"
                  aria-hidden
                />
              ) : null}
              {loading ? t("resumeSearching") : t("resume")}
              {!loading ? (
                <ArrowRightIcon data-icon="inline-end" aria-hidden />
              ) : null}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader className="gap-3 px-5 sm:px-6">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-[color:var(--glass-surface-strong)] text-[color:var(--glass-accent-deep)]">
            <CompassIcon className="size-5" aria-hidden />
          </span>
          <CardTitle>
            <h2 className="text-xl font-semibold">{t("resumeNoCodeTitle")}</h2>
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {t("resumeNoCodeBody")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 px-5 sm:px-6">
          <p className="text-xs leading-relaxed text-[color:var(--glass-ink-faint)]">
            {t("resumeNoCodeNote")}
          </p>
        </CardContent>
        <CardFooter className="border-0 bg-transparent px-5 pt-0 sm:px-6">
          <Button
            render={<Link href="/mon-dossier" />}
            nativeButton={false}
            variant="outline"
            size="lg"
            className="min-h-12 w-full text-base"
          >
            {t("resumeStartDossier")}
            <ArrowRightIcon data-icon="inline-end" aria-hidden />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
