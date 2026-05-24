"use client";

/**
 * Panneau droit du chat : liste des sources de la knowledge base citées dans
 * la conversation courante.
 *
 * Une "source citée" est mémorisée dès que l'IA mentionne `[SRC:id]` dans une
 * réponse. La liste cumule sur toute la session pour donner une vision
 * d'ensemble des références utilisées.
 *
 * Chaque entrée :
 *   - icône du kind (text/url/pdf/tutorial/transcript/image)
 *   - titre cliquable (lien externe si sourceUrl, sinon non-cliquable)
 *   - résumé (summary) en small si dispo
 *
 * Ce composant est purement présentationnel — pas de fetch, la prop `sources`
 * est gérée par le shell.
 */

import { Inbox, ExternalLink } from "lucide-react";
import { getKindIcon, getKindLabel } from "../_shared";
import type { CitedSourceLite } from "./types";

interface Props {
  sources: CitedSourceLite[];
}

export function CitedSourcesPanel({ sources }: Props) {
  if (sources.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center text-muted-foreground">
        <Inbox className="size-6 opacity-50" />
        <p className="text-[12px] leading-relaxed">
          Les sources citées par l&apos;IA dans cette conversation
          apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex-1 space-y-1.5 overflow-y-auto p-2">
      {sources.map((src) => {
        const Icon = getKindIcon(src.kind);
        const hasUrl = !!src.sourceUrl;
        return (
          <li
            key={src.id}
            className="rounded-lg border border-border bg-background/60 p-2 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"
                title={getKindLabel(src.kind)}
              >
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                {hasUrl ? (
                  <a
                    href={src.sourceUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-start gap-1 text-[12.5px] font-semibold leading-snug text-primary hover:underline"
                  >
                    <span className="line-clamp-2">{src.title}</span>
                    <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-60 group-hover:opacity-100" />
                  </a>
                ) : (
                  <span className="text-[12.5px] font-semibold leading-snug text-foreground line-clamp-2">
                    {src.title}
                  </span>
                )}
                {src.summary ? (
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground line-clamp-3">
                    {src.summary}
                  </p>
                ) : null}
                <p className="mt-1 text-[10.5px] uppercase tracking-wider text-muted-foreground/80">
                  {getKindLabel(src.kind)}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
