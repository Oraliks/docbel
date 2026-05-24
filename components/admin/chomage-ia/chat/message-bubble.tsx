"use client";

/**
 * Bulle de message individuelle. Rend le markdown léger (gras, italique, listes,
 * blocs de code inline, titres ##) et remplace les marqueurs [SRC:id] par des
 * pills cliquables.
 *
 * Pas de dépendance markdown lourde — on fait un parsing maison minimal pour
 * éviter d'embarquer marked/react-markdown juste pour quelques cas simples.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, User, Sparkles, Copy, CheckCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtDateTime, fmtTokens, getKindIcon, getKindLabel, truncate } from "../_shared";
import type { ChatMessageItem, CitedSourceLite } from "./types";

interface Props {
  message: ChatMessageItem;
  citedSources: CitedSourceLite[];
}

export function MessageBubble({ message, citedSources }: Props) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const sourcesById = useMemo(() => {
    const map = new Map<string, CitedSourceLite>();
    for (const s of citedSources) map.set(s.id, s);
    return map;
  }, [citedSources]);

  function copyToClipboard() {
    navigator.clipboard
      .writeText(message.content)
      .then(() => {
        setCopied(true);
        toast.success("Message copié");
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error("Échec de la copie"));
  }

  const renderedHtml = useMemo(
    () => renderMarkdown(message.content, sourcesById),
    [message.content, sourcesById]
  );

  return (
    <div
      className={cn(
        "flex gap-2",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary/10 text-primary"
            : "bg-muted text-foreground"
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Sparkles className="size-3.5" />}
      </span>

      {/* Bubble */}
      <div className={cn("flex max-w-[85%] flex-col gap-1", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl border px-3 py-2.5 text-[13.5px] leading-relaxed",
            isUser
              ? "border-primary/20 bg-primary/5 text-foreground"
              : "border-border bg-card text-foreground"
          )}
        >
          {message.pending ? (
            <PendingIndicator startedAt={message.pendingStartedAt} />
          ) : (
            <div
              className="chomage-ia-md"
              // dangerouslySetInnerHTML est sûr ici car renderMarkdown échappe le HTML
              // dans le helper escapeHtml avant d'appliquer les remplacements légers.
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          )}
        </div>

        {/* Méta + actions */}
        <div className="flex items-center gap-2 px-2 text-[10.5px] text-muted-foreground">
          <span>{fmtDateTime(message.createdAt)}</span>
          {message.elapsedMs != null && message.elapsedMs > 0 ? (
            <span
              className="inline-flex items-center gap-0.5"
              title="Durée de l'appel IA"
            >
              · <Clock className="size-2.5" /> {fmtElapsed(message.elapsedMs)}
            </span>
          ) : null}
          {message.tokensIn != null || message.tokensOut != null ? (
            <span>
              · {fmtTokens(message.tokensIn)}/{fmtTokens(message.tokensOut)} tk
            </span>
          ) : null}
          {!message.pending ? (
            <button
              type="button"
              onClick={copyToClipboard}
              className="ml-auto inline-flex items-center gap-1 rounded-sm px-1 hover:bg-muted hover:text-foreground"
              title="Copier le message"
            >
              {copied ? (
                <CheckCheck className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
              {copied ? "Copié" : "Copier"}
            </button>
          ) : null}
        </div>

        {/* Citations résumées sous la bulle (mini pills) */}
        {!isUser && message.citedSourceIds.length > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-1 px-1">
            {message.citedSourceIds.slice(0, 8).map((id) => {
              const src = sourcesById.get(id);
              const label = src ? truncate(src.title, 36) : id.slice(0, 8);
              const Icon = src ? getKindIcon(src.kind) : Sparkles;
              return (
                <a
                  key={id}
                  href={src?.sourceUrl ?? "#"}
                  target={src?.sourceUrl ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10.5px] font-medium hover:bg-muted"
                  title={src?.summary ?? src?.title ?? id}
                >
                  <Icon className="size-3" />
                  {label}
                </a>
              );
            })}
            {message.citedSourceIds.length > 8 ? (
              <span className="text-[10.5px] text-muted-foreground">
                +{message.citedSourceIds.length - 8} autres
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pending indicator — timer live + status rotatif                    */
/* ------------------------------------------------------------------ */

/**
 * Messages affichés pendant que l'IA répond — donne l'impression d'activité
 * et l'idée de ce qu'elle fait derrière. Sans vrai streaming, on simule
 * une progression avec des paliers basés sur le temps écoulé.
 */
const PENDING_STEPS = [
  { atSec: 0, label: "Lecture des sources de la KB…" },
  { atSec: 4, label: "Synthèse et identification des citations…" },
  { atSec: 10, label: "Rédaction de la réponse…" },
  { atSec: 25, label: "Réponse longue en cours, encore un instant…" },
  { atSec: 60, label: "Toujours en cours — la requête peut prendre 1-2 min." },
] as const;

function PendingIndicator({ startedAt }: { startedAt?: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [startedAt]);

  const elapsedMs = startedAt ? Math.max(0, now - startedAt) : 0;
  const elapsedSec = elapsedMs / 1000;
  const step =
    [...PENDING_STEPS].reverse().find((s) => elapsedSec >= s.atSec) ??
    PENDING_STEPS[0];

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" />
      <span className="text-[12.5px]">{step.label}</span>
      {startedAt ? (
        <span
          className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] tabular-nums"
          title="Temps écoulé"
        >
          <Clock className="size-2.5" />
          {fmtElapsed(elapsedMs)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Formate une durée en ms vers une chaîne lisible :
 * < 1 s   → "0.3s"
 * < 60 s  → "12s"
 * ≥ 60 s  → "1m 23s"
 */
function fmtElapsed(ms: number): string {
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/* ------------------------------------------------------------------ */
/*  Mini-markdown renderer                                            */
/* ------------------------------------------------------------------ */

/**
 * Échappe l'HTML pour empêcher les injections.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Pipeline simple : escape → transformations légères → citations.
 * Supporte : ** gras **, * italique *, `code`, # titres, listes "- ", paragraphes.
 */
function renderMarkdown(
  text: string,
  sourcesById: Map<string, CitedSourceLite>
): string {
  let out = escapeHtml(text);

  // Code blocks ``` ... ``` (très simple, mono-ligne ou multi-ligne sans imbrication)
  out = out.replace(
    /```([\s\S]*?)```/g,
    (_, code) =>
      `<pre class="mt-1.5 rounded-md bg-muted px-2 py-1.5 text-[11.5px] font-mono leading-relaxed whitespace-pre-wrap break-words">${code}</pre>`
  );
  // Inline code
  out = out.replace(
    /`([^`\n]+)`/g,
    `<code class="rounded bg-muted px-1 py-0.5 text-[12px] font-mono">$1</code>`
  );
  // Bold ** **
  out = out.replace(/\*\*([^*]+)\*\*/g, `<strong>$1</strong>`);
  // Italic * *
  out = out.replace(/(^|\s)\*([^*]+)\*/g, `$1<em>$2</em>`);
  // Citations [SRC:id]
  out = out.replace(/\[(SRC|SOURCE):([a-z0-9_-]+)\]/gi, (_, _kind, id) => {
    const src = sourcesById.get(id);
    if (!src) {
      return `<span class="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-mono text-muted-foreground" title="Source citée non trouvée dans la KB envoyée">${id.slice(0, 8)}</span>`;
    }
    const link = src.sourceUrl
      ? `href="${escapeHtml(src.sourceUrl)}" target="_blank" rel="noopener noreferrer"`
      : `href="#" onclick="return false"`;
    const title = src.summary ?? src.title;
    return `<a ${link} class="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-mono text-primary hover:bg-primary/20" title="${escapeHtml(title)}">${escapeHtml(truncate(src.title, 22))}</a>`;
  });

  // Titres ## et ###
  out = out.replace(
    /^###\s+(.+)$/gm,
    `<h3 class="mt-2 text-[13px] font-bold">$1</h3>`
  );
  out = out.replace(
    /^##\s+(.+)$/gm,
    `<h2 class="mt-2.5 text-[14px] font-bold">$1</h2>`
  );

  // Listes "- "
  out = out.replace(/(^|\n)((?:- .+\n?)+)/g, (_, prefix, block) => {
    const items = block
      .trim()
      .split(/\n/)
      .map((l: string) => l.replace(/^- /, "").trim())
      .filter(Boolean)
      .map((it: string) => `<li class="ml-4 list-disc">${it}</li>`)
      .join("");
    return `${prefix}<ul class="mt-1.5 space-y-0.5">${items}</ul>`;
  });

  // Paragraphes (double newline)
  out = out
    .split(/\n{2,}/)
    .map((para) => {
      if (
        para.startsWith("<h2") ||
        para.startsWith("<h3") ||
        para.startsWith("<ul") ||
        para.startsWith("<pre")
      ) {
        return para;
      }
      return `<p class="my-1">${para.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return out;
}
