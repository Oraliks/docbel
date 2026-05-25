"use client";

/**
 * Bulle spéciale dans le thread pour un prompt généré par le mode "wand".
 *
 * Visuellement distincte des bulles de chat :
 *   - bordure / fond ambre subtil
 *   - header avec icône Wand2 + titre du prompt
 *   - block <pre> mono avec le contenu intégral (pas de markdown rendering)
 *   - bouton "Copier" prominent
 *   - footer : sources citées + tokens éventuels
 *
 * Pas de persistence ici — c'est juste l'affichage. La persistence dans
 * GeneratedPrompt est faite côté backend (POST /api/chomage-ia/prompt-builder)
 * par le shell, qui passe `promptId` à ce composant.
 */

import { useMemo, useState } from "react";
import { CheckCheck, Copy, ExternalLink, Wand2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fmtDateTime, fmtTokens, getKindIcon, getKindLabel, truncate } from "../_shared";
import type { ChatMessageItem, CitedSourceLite } from "./types";

interface Props {
  message: ChatMessageItem;
  citedSources: CitedSourceLite[];
}

export function GeneratedPromptMessage({ message, citedSources }: Props) {
  const [copied, setCopied] = useState(false);

  const sourcesById = useMemo(() => {
    const map = new Map<string, CitedSourceLite>();
    for (const s of citedSources) map.set(s.id, s);
    return map;
  }, [citedSources]);

  function copy() {
    navigator.clipboard
      .writeText(message.content)
      .then(() => {
        setCopied(true);
        toast.success("Prompt copié — colle-le dans Claude Code");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Échec de la copie"));
  }

  const title = message.promptTitle ?? "Prompt généré";

  return (
    <div className="flex gap-2">
      {/* Avatar */}
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
        <Wand2 className="size-3.5" />
      </span>

      {/* Bloc */}
      <div className="flex w-full min-w-0 max-w-[92%] flex-col">
        <div className="overflow-hidden rounded-2xl border border-amber-400/40 bg-amber-50/40 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/15">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-amber-300/40 bg-amber-100/40 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-900/20">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-amber-900 dark:text-amber-200">
                <Wand2 className="size-3.5" />
                <span className="truncate">{title}</span>
              </div>
              {message.promptBrief ? (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  Brief : « {message.promptBrief} »
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant={copied ? "secondary" : "default"}
              onClick={copy}
              className="shrink-0 gap-1.5"
              title="Copier le prompt dans le presse-papiers"
            >
              {copied ? (
                <>
                  <CheckCheck className="size-3.5" />
                  Copié
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  Copier
                </>
              )}
            </Button>
          </div>

          {/* Block code */}
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words bg-background/60 px-3 py-2.5 text-[12px] font-mono leading-relaxed text-foreground">
            {message.content}
          </pre>

          {/* Footer */}
          {message.citedSourceIds.length > 0 || message.tokensOut != null ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-amber-300/40 bg-amber-100/30 px-3 py-1.5 dark:border-amber-500/20 dark:bg-amber-900/10">
              {message.citedSourceIds.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-800/70 dark:text-amber-200/70">
                    Sources ({message.citedSourceIds.length})
                  </span>
                  {message.citedSourceIds.slice(0, 5).map((id) => {
                    const src = sourcesById.get(id);
                    const label = src ? truncate(src.title, 26) : id.slice(0, 8);
                    const Icon = src ? getKindIcon(src.kind) : Wand2;
                    return src?.sourceUrl ? (
                      <a
                        key={id}
                        href={src.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${getKindLabel(src.kind)} — ${src.summary ?? src.title}`}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-200/40 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-900 hover:bg-amber-200/70 dark:border-amber-500/30 dark:bg-amber-800/40 dark:text-amber-200 dark:hover:bg-amber-800/60"
                      >
                        <Icon className="size-2.5" />
                        {label}
                        <ExternalLink className="size-2.5 opacity-60" />
                      </a>
                    ) : (
                      <span
                        key={id}
                        title={src ? `${getKindLabel(src.kind)} — ${src.summary ?? src.title}` : id}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-200/30 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-800/30 dark:text-amber-200"
                      >
                        <Icon className="size-2.5" />
                        {label}
                      </span>
                    );
                  })}
                  {message.citedSourceIds.length > 5 ? (
                    <span className="text-[10.5px] text-amber-800/70 dark:text-amber-200/70">
                      +{message.citedSourceIds.length - 5}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="ml-auto flex items-center gap-2 text-[10.5px] text-amber-800/70 tabular-nums dark:text-amber-200/70">
                {message.tokensOut != null ? (
                  <span>~{fmtTokens(message.tokensOut)} tk</span>
                ) : null}
                {message.elapsedMs != null && message.elapsedMs > 0 ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Clock className="size-2.5" />
                    {fmtElapsed(message.elapsedMs)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Méta sous la bulle */}
        <div className="mt-1 flex items-center gap-2 px-2 text-[10.5px] text-muted-foreground">
          <span>{fmtDateTime(message.createdAt)}</span>
          <span className="ml-auto inline-flex items-center gap-1 text-amber-700/80 dark:text-amber-300/80">
            <Wand2 className="size-2.5" />
            Prompt généré · sauvegardé dans l&apos;historique
          </span>
        </div>
      </div>
    </div>
  );
}

function fmtElapsed(ms: number): string {
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
