"use client";

/**
 * Mini-renderer markdown JSX-based pour les bulles de chat.
 *
 * Pourquoi pas react-markdown / marked / shiki ?
 *  - On a besoin uniquement d'un sous-ensemble (gras/italique/code/listes/
 *    tables/blockquotes/links/headings/citations [SRC:id]) — moins de 200 LOC.
 *  - Ces libs pèsent 30-200KB chacune en bundle client, pour un usage très
 *    ciblé dans un seul module admin. ROI faible.
 *  - On retourne du vrai JSX (au lieu de dangerouslySetInnerHTML) pour pouvoir
 *    injecter des composants React custom — notamment `<CitationPill>` avec
 *    HoverCard, qui serait sinon impossible à hook après mount sans hacks.
 *
 * Pipeline :
 *   text → splitMarkdownBlocks (tables, code blocks, blockquotes, listes,
 *          headings, paragraphes) → renderInline (bold, italic, code, links,
 *          [SRC:id] → <CitationPill>)
 */

import { type ReactNode, Fragment } from "react";
import { ExternalLink } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { getKindIcon, getKindLabel, truncate } from "../_shared";
import type { CitedSourceLite } from "./types";

/* ------------------------------------------------------------------ */
/*  Composant : pill de citation avec HoverCard                       */
/* ------------------------------------------------------------------ */

interface CitationPillProps {
  rawId: string;
  source: CitedSourceLite | null;
}

export function CitationPill({ rawId, source }: CitationPillProps) {
  // Source non trouvée (ex: cite à un id absent de la KB envoyée) → pill grisée
  // sans HoverCard mais avec title pour debug.
  if (!source) {
    return (
      <span
        className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-mono text-muted-foreground"
        title="Source citée non trouvée dans la KB envoyée"
      >
        {rawId.slice(0, 8)}
      </span>
    );
  }

  const Icon = getKindIcon(source.kind);
  const label = truncate(source.title, 22);
  const hasUrl = !!source.sourceUrl;

  return (
    <HoverCard>
      <HoverCardTrigger
        href={hasUrl ? (source.sourceUrl as string) : undefined}
        target={hasUrl ? "_blank" : undefined}
        rel={hasUrl ? "noopener noreferrer" : undefined}
        className="inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-mono text-primary transition-colors hover:bg-primary/20"
      >
        <Icon className="size-2.5 shrink-0" />
        {label}
      </HoverCardTrigger>
      <HoverCardContent side="top" sideOffset={6} className="w-80">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-bold leading-snug text-foreground">
                {source.title}
              </p>
              <p className="mt-0.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                {getKindLabel(source.kind)}
              </p>
            </div>
          </div>
          {source.summary ? (
            <p className="text-[11.5px] leading-relaxed text-muted-foreground line-clamp-4">
              {truncate(source.summary, 220)}
            </p>
          ) : (
            <p className="text-[11.5px] italic text-muted-foreground/70">
              Pas de résumé disponible.
            </p>
          )}
          {hasUrl ? (
            <a
              href={source.sourceUrl as string}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary hover:underline"
            >
              Voir la source complète
              <ExternalLink className="size-3" />
            </a>
          ) : (
            <p className="text-[10.5px] text-muted-foreground/80">
              Pas d&apos;URL externe — source interne à la KB.
            </p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline rendering : bold/italic/code/link/citation                  */
/* ------------------------------------------------------------------ */

/**
 * Tokenise une ligne en éléments JSX en gérant les inline markers.
 *
 * Order matters : citations [SRC:id] avant code (pour éviter qu'un id
 * contenant `_` ne soit interprété comme italic), code avant bold/italic
 * (le contenu d'un `code` ne doit pas être réinterprété), bold avant italic
 * (** englobe *).
 */
function renderInline(
  text: string,
  sourcesById: Map<string, CitedSourceLite>,
  keyPrefix: string
): ReactNode[] {
  const tokens: ReactNode[] = [];
  let cursor = 0;
  let idx = 0;

  // Combine pattern : on capture le premier marker rencontré pour préserver
  // l'ordre d'apparition dans le texte.
  const pattern =
    /\[(?:SRC|SOURCE):([a-z0-9_-]+)\]|`([^`\n]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      tokens.push(text.slice(cursor, match.index));
    }
    const key = `${keyPrefix}-${idx++}`;
    if (match[1] != null) {
      // Citation
      const id = match[1];
      tokens.push(
        <CitationPill key={key} rawId={id} source={sourcesById.get(id) ?? null} />
      );
    } else if (match[2] != null) {
      // Inline code
      tokens.push(
        <code
          key={key}
          className="rounded bg-muted px-1 py-0.5 text-[12px] font-mono"
        >
          {match[2]}
        </code>
      );
    } else if (match[3] != null) {
      // Bold
      tokens.push(<strong key={key}>{renderInline(match[3], sourcesById, key)}</strong>);
    } else if (match[4] != null) {
      // Italic
      tokens.push(<em key={key}>{renderInline(match[4], sourcesById, key)}</em>);
    } else if (match[5] != null && match[6] != null) {
      // Link [text](url)
      tokens.push(
        <a
          key={key}
          href={match[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {match[5]}
        </a>
      );
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    tokens.push(text.slice(cursor));
  }
  return tokens;
}

/* ------------------------------------------------------------------ */
/*  Block-level rendering                                              */
/* ------------------------------------------------------------------ */

/**
 * Détecte une table markdown classique :
 *   | col1 | col2 |
 *   | --- | --- |
 *   | a | b |
 *
 * Retourne true si la ligne `header` ressemble à un header de table
 * (commence et finit par |) et la ligne suivante `sep` est une séparation
 * (uniquement des |, espaces, - et :).
 */
function isTableHeader(header: string, sep: string | undefined): boolean {
  if (!sep) return false;
  if (!header.trim().startsWith("|") || !header.trim().endsWith("|")) return false;
  const s = sep.trim();
  if (!s.startsWith("|") || !s.endsWith("|")) return false;
  return /^[|\s\-:]+$/.test(s);
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function renderTable(
  lines: string[],
  sourcesById: Map<string, CitedSourceLite>,
  key: string
): ReactNode {
  const headers = parseTableRow(lines[0]);
  const rows = lines.slice(2).map(parseTableRow);
  return (
    <div key={key} className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-2 py-1 text-left font-semibold text-foreground"
              >
                {renderInline(h, sourcesById, `${key}-h${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/60 last:border-0">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-2 py-1 align-top text-foreground/90"
                >
                  {renderInline(cell, sourcesById, `${key}-r${ri}c${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Entry-point : prend un message text + map des sources, retourne du JSX.
 */
export function renderMarkdownReact(
  text: string,
  sourcesById: Map<string, CitedSourceLite>
): ReactNode {
  // 1) Extraire les code blocks ```lang...``` en premier (ils ne doivent pas
  //    être touchés par les autres transformations).
  const codeBlockPlaceholders: { code: string; lang: string }[] = [];
  const PLACEHOLDER = " CODEBLOCK";
  const withoutCode = text.replace(
    /```(\w+)?\n?([\s\S]*?)```/g,
    (_, lang, code) => {
      const i = codeBlockPlaceholders.length;
      codeBlockPlaceholders.push({ code, lang: lang || "" });
      return `${PLACEHOLDER}${i}${PLACEHOLDER}`;
    }
  );

  // 2) Découper en lignes pour analyse block-level.
  const lines = withoutCode.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  // Buffer paragraphe en cours (pour rassembler lignes consécutives).
  let paraBuffer: string[] = [];
  const flushPara = () => {
    if (paraBuffer.length === 0) return;
    const content = paraBuffer.join("\n");
    blocks.push(
      <p key={`b${blockKey++}`} className="my-1 leading-relaxed">
        {renderInlineWithBreaks(content, sourcesById, `b${blockKey}`)}
      </p>
    );
    paraBuffer = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    // Ligne vide → flush paragraphe en cours.
    if (line.trim() === "") {
      flushPara();
      i++;
      continue;
    }

    // Placeholder pour code block.
    const phMatch = line.match(/^ CODEBLOCK(\d+) $/);
    if (phMatch) {
      flushPara();
      const ph = codeBlockPlaceholders[Number(phMatch[1])];
      blocks.push(
        <pre
          key={`b${blockKey++}`}
          className="my-2 rounded-md bg-muted px-2.5 py-2 text-[11.5px] font-mono leading-relaxed whitespace-pre-wrap break-words"
          data-lang={ph.lang || undefined}
        >
          {ph.code}
        </pre>
      );
      i++;
      continue;
    }

    // Headings ### / ##
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      flushPara();
      blocks.push(
        <h3
          key={`b${blockKey++}`}
          className="mt-2 text-[13px] font-bold text-foreground"
        >
          {renderInline(h3[1], sourcesById, `b${blockKey}`)}
        </h3>
      );
      i++;
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      flushPara();
      blocks.push(
        <h2
          key={`b${blockKey++}`}
          className="mt-2.5 text-[14px] font-bold text-foreground"
        >
          {renderInline(h2[1], sourcesById, `b${blockKey}`)}
        </h2>
      );
      i++;
      continue;
    }

    // Blockquote `> ...` (peut s'étendre sur plusieurs lignes consécutives)
    if (/^>\s?/.test(line)) {
      flushPara();
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      const content = quoteLines.join("\n");
      blocks.push(
        <blockquote
          key={`b${blockKey++}`}
          className="my-2 border-l-2 border-primary/40 bg-muted/30 px-3 py-1.5 italic text-muted-foreground"
        >
          {renderInlineWithBreaks(content, sourcesById, `b${blockKey}`)}
        </blockquote>
      );
      continue;
    }

    // Table markdown (header + sep + rows)
    if (isTableHeader(line, lines[i + 1])) {
      flushPara();
      const tableLines: string[] = [line, lines[i + 1]];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        tableLines.push(lines[j]);
        j++;
      }
      blocks.push(renderTable(tableLines, sourcesById, `b${blockKey++}`));
      i = j;
      continue;
    }

    // Listes "- " ou "* " consécutives
    if (/^[-*]\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`b${blockKey++}`} className="my-1 ml-4 space-y-0.5 list-disc">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, sourcesById, `b${blockKey}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Listes numérotées "1. " "2. " consécutives
    if (/^\d+\.\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`b${blockKey++}`} className="my-1 ml-4 space-y-0.5 list-decimal">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, sourcesById, `b${blockKey}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Sinon → ligne de paragraphe.
    paraBuffer.push(line);
    i++;
  }
  flushPara();

  return <>{blocks}</>;
}

/**
 * Rend un texte multi-ligne en gardant les `\n` simples comme `<br/>` (style
 * paragraphe markdown : double newline = paragraphe, simple = break).
 */
function renderInlineWithBreaks(
  text: string,
  sourcesById: Map<string, CitedSourceLite>,
  keyPrefix: string
): ReactNode {
  const parts = text.split("\n");
  return parts.map((part, i) => (
    <Fragment key={`${keyPrefix}-l${i}`}>
      {renderInline(part, sourcesById, `${keyPrefix}-l${i}`)}
      {i < parts.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

/* ------------------------------------------------------------------ */
/*  Style helper exporté                                              */
/* ------------------------------------------------------------------ */

/** Classes appliquées sur le wrapper du markdown (héritées via descendant). */
export const MARKDOWN_WRAPPER_CLS = cn("chomage-ia-md");
