"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

/**
 * Recherche dans l'article courant (Ctrl+F local). Utilise l'API CSS Custom
 * Highlight (`::highlight()`) : surligne les occurrences sans muter le DOM
 * (compatible avec les liens/puces déjà rendus). Dégradation silencieuse si le
 * navigateur ne la supporte pas.
 */
function findRanges(container: Element, query: string): Range[] {
  const q = query.toLowerCase();
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = (node.nodeValue ?? "").toLowerCase();
    let from = 0;
    let i = text.indexOf(q, from);
    while (i !== -1) {
      const r = document.createRange();
      r.setStart(node, i);
      r.setEnd(node, i + q.length);
      ranges.push(r);
      from = i + q.length;
      i = text.indexOf(q, from);
    }
  }
  return ranges;
}

export function InArticleFind({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [count, setCount] = useState(0);
  const [idx, setIdx] = useState(0);
  const rangesRef = useRef<Range[]>([]);

  const clear = () => {
    const H = (globalThis as unknown as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights;
    H?.delete("regl-find");
    H?.delete("regl-find-current");
    rangesRef.current = [];
    setCount(0);
    setIdx(0);
  };

  const apply = (ranges: Range[], cur: number) => {
    const w = globalThis as unknown as {
      Highlight?: new (...ranges: Range[]) => unknown;
      CSS?: { highlights?: Map<string, unknown> };
    };
    if (!w.Highlight || !w.CSS?.highlights) return;
    w.CSS.highlights.set("regl-find", new w.Highlight(...ranges));
    if (ranges[cur]) {
      w.CSS.highlights.set("regl-find-current", new w.Highlight(ranges[cur]));
      ranges[cur].startContainer.parentElement?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }
  };

  const search = (value: string) => {
    setQ(value);
    setIdx(0);
    if (value.trim().length < 2) {
      clear();
      return;
    }
    const container = document.querySelector('[data-slot="legal-text"]');
    if (!container) {
      clear();
      return;
    }
    const ranges = findRanges(container, value);
    rangesRef.current = ranges;
    setCount(ranges.length);
    apply(ranges, 0);
  };

  const move = (dir: 1 | -1) => {
    const n = rangesRef.current.length;
    if (!n) return;
    const next = (idx + dir + n) % n;
    setIdx(next);
    apply(rangesRef.current, next);
  };

  const close = () => {
    clear();
    setQ("");
    setOpen(false);
  };

  useEffect(() => () => clear(), []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground print:hidden"
      >
        <Search className="size-3.5" aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 print:hidden">
      <Search className="size-4 text-muted-foreground" aria-hidden />
      <input
        autoFocus
        value={q}
        onChange={(e) => search(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            move(e.shiftKey ? -1 : 1);
          } else if (e.key === "Escape") {
            close();
          }
        }}
        placeholder={label}
        className="w-40 bg-transparent text-sm outline-none"
      />
      <span className="min-w-[3rem] text-right text-xs tabular-nums text-muted-foreground">
        {count > 0 ? `${idx + 1}/${count}` : q.length >= 2 ? "0" : ""}
      </span>
      <button
        type="button"
        onClick={() => move(-1)}
        disabled={count === 0}
        className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-40"
        aria-label="Précédent"
      >
        <ChevronUp className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        disabled={count === 0}
        className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-40"
        aria-label="Suivant"
      >
        <ChevronDown className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={close}
        className="rounded p-1 text-muted-foreground hover:bg-accent"
        aria-label="Fermer"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
