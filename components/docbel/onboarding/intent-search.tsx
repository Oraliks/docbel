"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowRight, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Suggestion {
  bundleId: string;
  slug: string;
  name: string;
  score: number;
  reason?: string;
}

interface IntentResponse {
  suggestions: Suggestion[];
  aiUsed: boolean;
  aiMessage?: string;
}

interface IntentSearchProps {
  query: string;
}

/// Analyse la requête du guichet via /api/intent-detect, sans dupliquer son
/// champ de recherche. Affiche les suggestions locales ou assistées par l'IA.
export function IntentSearch({ query }: IntentSearchProps) {
  const t = useTranslations("public.dossier");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ query: string; response: IntentResponse } | null>(null);
  const [error, setError] = useState<{ query: string; message: string } | null>(null);
  const normalizedQuery = query.trim();
  const response = result?.query === normalizedQuery ? result.response : null;
  const visibleError = error?.query === normalizedQuery ? error.message : null;

  function handleIdentify() {
    if (normalizedQuery.length < 2) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/intent-detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: normalizedQuery }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 429) {
            setError({ query: normalizedQuery, message: t("intentRateLimited") });
          } else {
            setError({ query: normalizedQuery, message: data.error || t("intentError") });
          }
          setResult(null);
          return;
        }
        const data = (await res.json()) as IntentResponse;
        setResult({ query: normalizedQuery, response: data });
      } catch {
        setError({ query: normalizedQuery, message: t("networkError") });
        setResult(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        size="lg"
        disabled={pending || normalizedQuery.length < 2}
        className="min-h-11 self-start"
        onClick={handleIdentify}
      >
        {pending ? (
          <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
        ) : (
          <Sparkles data-icon="inline-start" aria-hidden />
        )}
        {t("intentIdentify")}
      </Button>

      {visibleError && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle aria-hidden />
          <AlertDescription>{visibleError}</AlertDescription>
        </Alert>
      )}

      {response && (
        <div className="glass-feedback flex flex-col gap-3 rounded-3xl p-4" data-tone="info">
          {response.aiUsed && response.aiMessage && (
            <Alert role="status" className="rounded-2xl border-[color:var(--info-border)] bg-[color:var(--info-subtle)] text-[color:var(--glass-ink)]">
              <MessageCircle aria-hidden />
              <AlertTitle>{t("intentAssistantSuggests")}</AlertTitle>
              <AlertDescription className="text-[color:var(--glass-ink-soft)]">
                {response.aiMessage}
              </AlertDescription>
            </Alert>
          )}

          {response.suggestions.length === 0 ? (
            <p className="text-sm text-[color:var(--glass-ink-soft)]">
              {t("intentNoSuggestions")}
            </p>
          ) : (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
                {t("intentSuggestedFlows")}
              </p>
              <div className="flex flex-col gap-2">
                {response.suggestions.slice(0, 3).map((s, idx) => (
                  <Button
                    key={s.bundleId}
                    variant="outline"
                    render={<Link href={`/d/${s.slug}`} />}
                    className="glass-interactive h-auto min-h-14 w-full justify-between gap-3 whitespace-normal rounded-2xl border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3 text-start"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[color:var(--glass-ink)]">
                          {idx === 0 && response.aiUsed && (
                            <Sparkles className="me-1 inline text-[color:var(--attention-subtle-foreground)]" aria-hidden />
                          )}
                          {s.name}
                        </span>
                      </span>
                      {s.reason && (
                        <span className="mt-0.5 line-clamp-2 text-xs font-normal text-[color:var(--glass-ink-soft)]">
                          {s.reason}
                        </span>
                      )}
                    </span>
                    <ArrowRight data-icon="inline-end" className="shrink-0 text-[color:var(--glass-ink-faint)] rtl:rotate-180" aria-hidden />
                  </Button>
                ))}
              </div>
            </>
          )}

          <p className="text-[11px] italic text-[color:var(--glass-ink-faint)]">
            {t("intentDisclaimer")}
          </p>
        </div>
      )}
    </div>
  );
}
