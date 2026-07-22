"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CompassIcon,
  CheckIcon,
  HeartIcon,
  RotateCcwIcon,
  SparklesIcon,
} from "lucide-react";
import type { PublicQuestion } from "@/lib/formations/boussole/load";
import type { TrainingCardData } from "@/lib/formations/queries";
import { TrainingCard } from "@/components/formations/training-card";
import { resolveIcon } from "@/components/formations/icons";

interface BranchView {
  key: string;
  name: string;
  description: string;
  possibleJobs: string[];
  icon: string;
  color: string;
}

interface BoussoleResultData {
  resultId: string;
  primaryKey: string | null;
  secondaryKeys: string[];
  confidence: number;
  confidenceLabel: "low" | "medium" | "high";
  summary: string;
  branches: BranchView[];
  recommendations: TrainingCardData[];
}

type Phase = "intro" | "quiz" | "loading" | "result";

export function BoussoleClient({ questions }: { questions: PublicQuestion[] }) {
  const router = useRouter();
  const t = useTranslations("public.formations");
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<BoussoleResultData | null>(null);
  const [saved, setSaved] = useState(false);

  const sessionId = useMemo(
    () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}-${Math.round(Math.random() * 1e9)}`),
    [],
  );

  const total = questions.length;
  const current = questions[index];
  const progress = total > 0 ? Math.round(((index) / total) * 100) : 0;

  async function submit(allAnswers: Record<string, string>) {
    setPhase("loading");
    try {
      const res = await fetch("/api/formations/boussole", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: allAnswers, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? t("errorGeneric"));
        setPhase("quiz");
        return;
      }
      setResult(data);
      setPhase("result");
    } catch {
      toast.error(t("errorGenericRetry"));
      setPhase("quiz");
    }
  }

  function answer(value: string) {
    const next = { ...answers, [current.key]: value };
    setAnswers(next);
    if (index + 1 >= total) {
      submit(next);
    } else {
      setIndex(index + 1);
    }
  }

  function restart() {
    setAnswers({});
    setIndex(0);
    setResult(null);
    setSaved(false);
    setPhase("intro");
  }

  async function saveResult() {
    if (!result) return;
    try {
      const res = await fetch("/api/formations/boussole", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: result.resultId, save: true }),
      });
      if (res.ok) {
        setSaved(true);
        toast.success(t("resultSavedToast"));
      } else {
        toast.error(t("saveFailedToast"));
      }
    } catch {
      toast.error(t("errorGeneric"));
    }
  }

  // ---------------------------------------------------------------- INTRO
  if (phase === "intro") {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <section className="glass-surface relative overflow-hidden p-8 lg:p-12">
          <span
            className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full opacity-30"
            style={{ background: "var(--glass-accent-a)", filter: "blur(60px)" }}
          />
          <div className="relative flex max-w-2xl flex-col gap-4">
            <span className="glass-icon-tile flex size-14 items-center justify-center rounded-2xl bg-[color:var(--glass-surface-strong)] text-[color:var(--glass-accent-deep)]">
              <CompassIcon className="size-7" />
            </span>
            <h1 className="glass-display text-[32px] font-semibold leading-tight sm:text-[40px]">
              {t("introTitle")}
            </h1>
            <p className="text-[15px] leading-[1.65] text-[color:var(--glass-ink-soft)]">
              {t("introBody")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setPhase("quiz")}
                className="glass-cta inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-bold"
              >
                <CompassIcon className="size-4" />
                {t("introStart")}
              </button>
              <Link
                href="/formations"
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-6 py-3 text-[14px] font-bold text-[color:var(--glass-ink)] transition hover:bg-[color:var(--glass-surface-strong)]"
              >
                {t("introSeeTrainings")}
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
            <p className="mt-1 text-[12px] text-[color:var(--glass-ink-faint)]">
              {t("introMeta", { total })}
            </p>
          </div>
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------- LOADING
  if (phase === "loading") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <CompassIcon className="size-10 animate-spin text-[color:var(--glass-accent-deep)]" style={{ animationDuration: "2.4s" }} />
        <p className="text-[14px] font-semibold text-[color:var(--glass-ink-soft)]">
          {t("loadingAnalysis")}
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------- RESULT
  if (phase === "result" && result) {
    const primary = result.branches.find((b) => b.key === result.primaryKey) ?? result.branches[0] ?? null;
    const secondaries = result.branches.filter((b) => b.key !== primary?.key).slice(0, 2);
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <section className="glass-surface flex flex-col gap-2 p-6">
          <p className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
            <SparklesIcon className="size-3.5 text-[color:var(--glass-accent-deep)]" />
            {t("resultConfidence", {
              confidence: result.confidence,
              label: t(
                `confidence_${result.confidenceLabel}` as Parameters<typeof t>[0],
              ),
            })}
          </p>
          <p className="text-[15px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            {result.summary} {t("resultSummarySuffix")}
          </p>
        </section>

        {primary && <PrimaryBranchCard branch={primary} />}

        {secondaries.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {secondaries.map((b) => (
              <SecondaryBranchCard key={b.key} branch={b} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2.5">
          <Link
            href={`/formations${result.primaryKey ? `?branch=${result.primaryKey}` : ""}`}
            className="glass-cta inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold"
          >
            {t("resultSeeAdapted")}
            <ArrowRightIcon className="size-4" />
          </Link>
          <button
            type="button"
            onClick={saveResult}
            disabled={saved}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-5 py-2.5 text-[13px] font-bold text-[color:var(--glass-ink)] transition hover:bg-[color:var(--glass-surface-strong)] disabled:opacity-60"
          >
            <HeartIcon className={`size-4 ${saved ? "fill-current text-[color:var(--glass-accent-c)]" : ""}`} />
            {saved ? t("resultSaved") : t("resultSave")}
          </button>
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-5 py-2.5 text-[13px] font-bold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
          >
            <RotateCcwIcon className="size-4" />
            {t("resultRestart")}
          </button>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-[16px] font-bold tracking-tight">
            {t("resultRecommendedTitle")}
          </h2>
          {result.recommendations.length === 0 ? (
            <div className="glass-surface px-5 py-8 text-center text-[13px] text-[color:var(--glass-ink-soft)]">
              {t("resultRecommendedEmpty")}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.recommendations.map((t) => (
                <TrainingCard key={t.id} training={t} />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------- QUIZ
  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <section className="glass-surface mx-auto flex w-full max-w-2xl flex-col gap-6 p-7 lg:p-9">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[12px] font-semibold text-[color:var(--glass-ink-faint)]">
            <span>
              {t("quizProgress", { current: index + 1, total })}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--glass-ink-line)]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: "var(--glass-accent-deep)" }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="glass-display text-[24px] font-semibold leading-snug sm:text-[28px]">
            {current.text}
          </h1>
          {current.description && (
            <p className="text-[13px] text-[color:var(--glass-ink-soft)]">{current.description}</p>
          )}
        </div>

        <div className="grid gap-2.5">
          {current.options.map((opt) => {
            const selected = answers[current.key] === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => answer(opt.value)}
                className="group flex items-center justify-between rounded-2xl border px-5 py-4 text-left text-[15px] font-semibold transition"
                style={{
                  borderColor: selected ? "var(--glass-accent-deep)" : "var(--glass-border)",
                  background: selected
                    ? "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)"
                    : "var(--glass-surface)",
                }}
              >
                {opt.label}
                <span
                  className="flex size-6 items-center justify-center rounded-full border transition"
                  style={{
                    borderColor: selected ? "var(--glass-accent-deep)" : "var(--glass-border)",
                    background: selected ? "var(--glass-accent-deep)" : "transparent",
                    color: "white",
                  }}
                >
                  {selected ? <CheckIcon className="size-3.5" /> : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => (index === 0 ? setPhase("intro") : setIndex(index - 1))}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
          >
            <ArrowLeftIcon className="size-4" />
            {t("quizPrevious")}
          </button>
          <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
            {t("quizNoWrongAnswer")}
          </p>
        </div>
      </section>
    </div>
  );
}

function BackLink() {
  const t = useTranslations("public.formations");
  return (
    <Link
      href="/formations"
      className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
    >
      <ArrowLeftIcon className="size-3.5" />
      {t("allTrainings")}
    </Link>
  );
}

function PrimaryBranchCard({ branch }: { branch: BranchView }) {
  const t = useTranslations("public.formations");
  const Icon = resolveIcon(branch.icon);
  return (
    <section
      className="relative overflow-hidden rounded-3xl p-8 text-white"
      style={{ background: `linear-gradient(135deg, ${branch.color}, color-mix(in oklab, ${branch.color} 60%, #000))` }}
    >
      <Icon className="absolute -right-4 -bottom-4 size-40 text-white/15" strokeWidth={1.2} />
      <div className="relative flex flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em]">
          {t("branchPrimary")}
        </span>
        <h2 className="glass-display text-[28px] font-semibold leading-tight">{branch.name}</h2>
        <p className="max-w-2xl text-[14px] leading-[1.6] text-white/90">{branch.description}</p>
        {branch.possibleJobs.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {branch.possibleJobs.map((j) => (
              <span key={j} className="rounded-full bg-white/20 px-3 py-1 text-[12px] font-semibold">
                {j}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SecondaryBranchCard({ branch }: { branch: BranchView }) {
  const t = useTranslations("public.formations");
  const Icon = resolveIcon(branch.icon);
  return (
    <section className="glass-surface flex flex-col gap-2 p-6">
      <span
        className="glass-icon-tile flex size-11 items-center justify-center rounded-2xl"
        style={{ background: `color-mix(in oklab, ${branch.color} 18%, transparent)`, color: branch.color }}
      >
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
        {t("branchAlsoExplore")}
      </p>
      <h3 className="text-[16px] font-bold tracking-tight">{branch.name}</h3>
      <p className="text-[12.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">{branch.description}</p>
    </section>
  );
}
