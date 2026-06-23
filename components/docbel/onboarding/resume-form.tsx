"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isValidResumeCodeFormat,
  normalizeResumeCode,
} from "@/lib/bundles/resume-code";
import { GLASS_INPUT, GLASS_LABEL } from "@/lib/glass-classes";

export function ResumeForm() {
  const router = useRouter();
  const t = useTranslations("public.dossier");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeResumeCode(code);
  const formatLooksValid = code.length === 0 || isValidResumeCodeFormat(normalized);

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
      const res = await fetch("/api/bundles/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: finalCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 410) {
          setError(t("resumeExpiredError"));
        } else if (res.status === 404) {
          setError(t("resumeNotFoundError"));
        } else if (res.status === 429) {
          setError(t("resumeRateLimitedError"));
        } else {
          setError(data.error || t("resumeGenericError"));
        }
        return;
      }
      const data = (await res.json()) as { bundleSlug: string; bundleName: string };
      toast.success(t("resumeSuccess", { name: data.bundleName }));
      router.push(`/d/${data.bundleSlug}`);
    } catch {
      setError(t("networkErrorRetry"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
      <form
        onSubmit={handleSubmit}
        className="glass-surface flex flex-col gap-4 rounded-3xl p-6"
      >
        <div className="flex items-center gap-2 text-[color:var(--glass-ink)]">
          <KeyRound className="size-5" />
          <h2 className="text-lg font-semibold">{t("resumeHasCodeTitle")}</h2>
        </div>
        <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
          {t.rich("resumeHasCodeBody", { code: (chunks) => <code>{chunks}</code> })}
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="resume-code" className={GLASS_LABEL}>
            {t("resumeCodeLabel")}
          </Label>
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
            className={`${GLASS_INPUT} h-12 font-mono text-base tracking-[0.12em] uppercase`}
            aria-invalid={!formatLooksValid}
            aria-describedby={error ? "resume-error" : undefined}
          />
          {!formatLooksValid && !error && (
            <p className="text-xs text-amber-700">
              {t("resumeFormatHint")}
            </p>
          )}
          {error && (
            <p id="resume-error" className="text-xs text-red-700">
              {error}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={loading || !isValidResumeCodeFormat(normalized)}
          className="h-12 w-full text-base"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("resumeSearching")}
            </>
          ) : (
            <>
              {t("resume")}
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      <div
        className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-3 lg:pt-12 text-[color:var(--glass-ink-faint)]"
        aria-hidden="true"
      >
        <div className="h-12 w-px bg-[color:var(--glass-border)]" />
        <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">
          {t("or")}
        </span>
        <div className="h-12 w-px bg-[color:var(--glass-border)]" />
      </div>

      <div className="glass-surface flex flex-col gap-4 rounded-3xl p-6">
        <h2 className="text-lg font-semibold text-[color:var(--glass-ink)]">
          {t("resumeNoCodeTitle")}
        </h2>
        <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
          {t("resumeNoCodeBody")}
        </p>
        <Button
          render={<Link href="/creer-ma-demande" />}
          variant="outline"
          size="lg"
          className="h-12 w-full text-base"
        >
          {t("resumeStartDossier")}
          <ArrowRight className="size-4" />
        </Button>
        <p className="text-[11px] text-[color:var(--glass-ink-faint)] italic">
          {t("resumeNoCodeNote")}
        </p>
      </div>
    </div>
  );
}
