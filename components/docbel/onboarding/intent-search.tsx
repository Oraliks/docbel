"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, Loader2, ArrowRight, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GLASS_INPUT } from "@/lib/glass-classes";

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

/// Champ de recherche libre couplé à l'endpoint /api/intent-detect.
/// Affiche les suggestions de parcours et un éventuel message de l'IA.
export function IntentSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [response, setResponse] = useState<IntentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim() || query.trim().length < 2) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/intent-detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 429) {
            setError("Trop de recherches — patientez quelques secondes.");
          } else {
            setError(data.error || "Impossible de traiter la recherche.");
          }
          setResponse(null);
          return;
        }
        const data = (await res.json()) as IntentResponse;
        setResponse(data);
      } catch {
        setError("Erreur réseau.");
        setResponse(null);
      }
    });
  }

  function clear() {
    setQuery("");
    setResponse(null);
    setError(null);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[color:var(--glass-ink-faint)]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Décrivez votre situation en quelques mots (« j'ai perdu mon emploi », « intempéries »…)"
          aria-label="Décrivez votre situation"
          className={`${GLASS_INPUT} h-14 w-full rounded-3xl border-0 pr-32 pl-12 text-[15px]`}
        />
        <div className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center gap-1.5">
          {query && (
            <button
              type="button"
              onClick={clear}
              className="p-1 text-[color:var(--glass-ink-faint)] hover:text-[color:var(--glass-ink)] focus-visible:outline-none"
              aria-label="Effacer"
            >
              <X className="size-4" />
            </button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={pending || query.trim().length < 2}
            className="rounded-2xl"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Identifier
          </Button>
        </div>
      </form>

      {error && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {response && (
        <div className="glass-surface space-y-3 rounded-3xl p-4">
          {response.aiUsed && response.aiMessage && (
            <div className="flex items-start gap-2 rounded-2xl bg-[color:var(--glass-surface-2,#f3f0fa)] p-3">
              <MessageCircle className="size-4 mt-0.5 flex-shrink-0 text-[color:var(--glass-ink-soft)]" />
              <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
                <span className="font-medium text-[color:var(--glass-ink)]">
                  L&apos;assistant suggère :
                </span>{" "}
                {response.aiMessage}
              </p>
            </div>
          )}

          {response.suggestions.length === 0 ? (
            <p className="text-sm text-[color:var(--glass-ink-soft)]">
              Aucun parcours évident pour cette requête. Essayez d&apos;autres mots-clés
              ou parcourez les événements de vie ci-dessous.
            </p>
          ) : (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
                Parcours suggérés
              </p>
              <div className="space-y-1.5">
                {response.suggestions.slice(0, 3).map((s, idx) => (
                  <button
                    key={s.bundleId}
                    type="button"
                    onClick={() => router.push(`/outils/bundles/${s.slug}`)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3 text-left transition-colors hover:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[color:var(--glass-ink)]">
                          {idx === 0 && response.aiUsed && (
                            <Sparkles className="inline size-3 mr-1 text-amber-600" />
                          )}
                          {s.name}
                        </span>
                      </div>
                      {s.reason && (
                        <p className="text-[12px] text-[color:var(--glass-ink-soft)] mt-0.5 line-clamp-2">
                          {s.reason}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="size-4 flex-shrink-0 text-[color:var(--glass-ink-faint)]" />
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="text-[11px] italic text-[color:var(--glass-ink-faint)]">
            Cette suggestion n&apos;engage pas l&apos;administration — vérifiez toujours
            auprès de l&apos;organisme officiel concerné.
          </p>
        </div>
      )}
    </div>
  );
}
