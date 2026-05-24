"use client";

/**
 * Affichage d'un prompt généré : titre, brief d'origine, contenu (mono),
 * bouton "Copier", liste des sources citées.
 *
 * Le contenu n'est pas rendu en markdown — c'est un brief technique destiné
 * à être collé tel quel dans Claude Code. On l'affiche en `<pre>` mono.
 *
 * État "vide" affiché quand aucun prompt n'est sélectionné (premier
 * chargement de la page ou historique fraîchement nettoyé).
 */

import { useState } from "react";
import {
  CheckCheck,
  Copy,
  ExternalLink,
  FileCode2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fmtDateTime, getKindIcon, getKindLabel } from "../_shared";
import type { GeneratedPromptFull } from "./types";

interface PromptOutputProps {
  prompt: GeneratedPromptFull | null;
  loading: boolean;
  onDelete?: (id: string) => void | Promise<void>;
}

export function PromptOutput({ prompt, loading, onDelete }: PromptOutputProps) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!prompt) return;
    navigator.clipboard
      .writeText(prompt.output)
      .then(() => {
        setCopied(true);
        toast.success("Prompt copié — colle-le dans Claude Code");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Échec de la copie"));
  }

  if (loading && !prompt) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-border border-dashed bg-card text-muted-foreground">
        <div className="flex items-center gap-2 text-[12.5px]">
          <Sparkles className="size-4 animate-pulse" />
          Génération en cours…
        </div>
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 rounded-2xl border border-border border-dashed bg-card px-6 text-center text-muted-foreground">
        <FileCode2 className="size-7 opacity-50" />
        <p className="max-w-sm text-[12.5px] leading-relaxed">
          Aucun prompt sélectionné. Remplis le formulaire à gauche pour
          générer un nouveau brief, ou clique sur un prompt de
          l&apos;historique pour le réafficher.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold">{prompt.title}</h3>
          <p className="mt-0.5 line-clamp-2 text-[11.5px] text-muted-foreground">
            Brief : « {prompt.brief} »
          </p>
          <p className="mt-1 text-[10.5px] text-muted-foreground/80">
            Généré le {fmtDateTime(prompt.createdAt)}
            {prompt.usage?.inputTokens != null
              ? ` · ${prompt.usage.inputTokens}/${prompt.usage.outputTokens ?? 0} tk`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={copy}
            className="gap-1.5"
          >
            {copied ? (
              <CheckCheck className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copié" : "Copier"}
          </Button>
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => onDelete(prompt.id)}
              title="Supprimer de l'historique"
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          ) : null}
        </div>
      </header>

      <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words bg-background/40 px-4 py-3 text-[12.5px] font-mono leading-relaxed">
        {prompt.output}
      </pre>

      {prompt.citedSources.length > 0 ? (
        <footer className="border-t border-border bg-muted/30 px-4 py-2">
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sources de la KB exploitées ({prompt.citedSources.length})
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {prompt.citedSources.map((src) => {
              const Icon = getKindIcon(src.kind);
              const hasUrl = !!src.sourceUrl;
              return (
                <li key={src.id}>
                  {hasUrl ? (
                    <a
                      href={src.sourceUrl ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${getKindLabel(src.kind)} — ${src.summary ?? src.title}`}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10.5px] font-medium text-primary hover:bg-primary/20"
                    >
                      <Icon className="size-3" />
                      {truncate(src.title, 34)}
                      <ExternalLink className="size-2.5 opacity-60" />
                    </a>
                  ) : (
                    <span
                      title={`${getKindLabel(src.kind)} — ${src.summary ?? src.title}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10.5px] font-medium text-foreground"
                    >
                      <Icon className="size-3" />
                      {truncate(src.title, 34)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </footer>
      ) : null}
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}
