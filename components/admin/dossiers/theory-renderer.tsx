"use client";

import { Fragment } from "react";

interface Props {
  /// Markdown déjà interpolé (les `{{ bindings }}` ont été remplacés serveur-side).
  markdown: string;
}

/// Mini-renderer Markdown sécurisé pour les sections théoriques.
///
/// Le contenu vient d'un module TypeScript typé (lib/dossiers/<slug>/index.ts),
/// pas d'entrée utilisateur — donc pas de risque XSS pratique. On reste sobre
/// néanmoins : zéro `dangerouslySetInnerHTML`, rendu en éléments React purs.
///
/// Sous-set Markdown supporté :
///   - titres h2/h3 (`##` / `###`)
///   - paragraphes
///   - listes à puces (`-` ou `*`)
///   - listes numérotées (`1.` etc.)
///   - tables GFM (avec ligne séparatrice `| --- |`)
///   - **gras**, *italique*, `code inline`
///
/// Pas besoin de plus — on garde simple, on ajoute si besoin un jour.
export function TheoryRenderer({ markdown }: Props) {
  const blocks = parseBlocks(markdown.trim());
  return (
    <div className="prose prose-sm dark:prose-invert flex max-w-none flex-col gap-3 text-sm leading-relaxed">
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parseur de blocs (TS pur, pas de dépendance).
// ---------------------------------------------------------------------------

type Block =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] };

function parseBlocks(input: string): Block[] {
  const lines = input.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Ligne vide → on saute.
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Titres.
    if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: line.slice(4).trim() });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
      i++;
      continue;
    }

    // Table GFM : `|` au début + 2e ligne `| --- |` (avec ou sans alignement).
    if (line.startsWith("|") && i + 1 < lines.length && /^\|[\s:\-|]+\|\s*$/.test(lines[i + 1])) {
      const headers = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: "table", headers, rows });
      continue;
    }

    // Liste à puces ou numérotée.
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, "").trim());
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, "").trim());
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Sinon paragraphe : on absorbe les lignes consécutives non vides et non
    // structurelles, séparées par des espaces.
    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !startsBlock(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "p", text: buf.join(" ").trim() });
  }

  return blocks;
}

function startsBlock(line: string): boolean {
  return (
    line.startsWith("## ") ||
    line.startsWith("### ") ||
    line.startsWith("|") ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line)
  );
}

function splitRow(row: string): string[] {
  return row
    .replace(/^\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

// ---------------------------------------------------------------------------
// Rendu d'un bloc en JSX.
// ---------------------------------------------------------------------------

function Block({ block }: { block: Block }) {
  switch (block.kind) {
    case "h2":
      return <h3 className="mt-4 text-base font-semibold">{block.text}</h3>;
    case "h3":
      return <h4 className="mt-3 text-sm font-semibold">{block.text}</h4>;
    case "p":
      return (
        <p className="text-sm leading-relaxed text-foreground">
          <Inline text={block.text} />
        </p>
      );
    case "ul":
      return (
        <ul className="flex flex-col gap-1 pl-5 text-sm leading-relaxed">
          {block.items.map((it, i) => (
            <li key={i} className="list-disc">
              <Inline text={it} />
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="flex flex-col gap-1 pl-5 text-sm leading-relaxed">
          {block.items.map((it, i) => (
            <li key={i} className="list-decimal">
              <Inline text={it} />
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                {block.headers.map((h, i) => (
                  <th key={i} className="px-3 py-1.5 text-left font-semibold">
                    <Inline text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-b">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5">
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Rendu inline : **gras**, *italique*, `code`.
// ---------------------------------------------------------------------------

function Inline({ text }: { text: string }) {
  // Pattern : on capture les balises sans dépendance regex récursive — un seul
  // niveau de nesting, suffisant pour nos textes.
  const parts: Array<React.ReactNode> = [];
  let last = 0;
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3] !== undefined) parts.push(<em key={m.index}>{m[3]}</em>);
    else if (m[4] !== undefined)
      parts.push(
        <code key={m.index} className="rounded bg-muted px-1 py-0.5 text-[12px]">
          {m[4]}
        </code>
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Fragment>{parts}</Fragment>;
}
