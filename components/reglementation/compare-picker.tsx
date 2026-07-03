"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { parseQueryIntent } from "@/lib/reglementation/query-intent";
import { Input } from "@/components/ui/input";

interface IndexItem {
  riolexId: string;
  loi: string;
  articleNumber: string;
  title: string;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");

/**
 * Sélecteur du 2ᵉ article à comparer : recherche dans l'index léger du corpus,
 * met à jour l'URL `?a=…&b=…`. `side` = quel côté on remplace.
 */
export function ComparePicker({
  a,
  b,
  side,
  placeholder,
}: {
  a: string;
  b: string;
  side: "a" | "b";
  placeholder: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<IndexItem[]>([]);

  useEffect(() => {
    fetch("/api/partenaire/reglementation/index")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch(() => {});
  }, []);

  const results = useMemo(() => {
    const query = norm(q.trim());
    if (!query) return [];
    const intent = parseQueryIntent(q);
    const scored: { it: IndexItem; score: number }[] = [];
    for (const it of items) {
      const num = it.articleNumber.toLowerCase();
      let score = -1;
      if (intent.articleNumber && num === intent.articleNumber) score = 100;
      else if (num === query) score = 90;
      else if (num.startsWith(query)) score = 70;
      else if (norm(it.title).includes(query)) score = 40;
      else if (norm(it.loi).includes(query)) score = 20;
      if (score >= 0) scored.push({ it, score });
    }
    scored.sort((x, y) => y.score - x.score);
    return scored.slice(0, 8).map((s) => s.it);
  }, [q, items]);

  const pick = (riolexId: string) => {
    const nextA = side === "a" ? riolexId : a;
    const nextB = side === "b" ? riolexId : b;
    const params = new URLSearchParams();
    if (nextA) params.set("a", nextA);
    if (nextB) params.set("b", nextB);
    router.push(`/partenaire/reglementation/comparer?${params.toString()}`);
    setQ("");
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
          {results.map((it) => (
            <li key={it.riolexId}>
              <button
                type="button"
                onClick={() => pick(it.riolexId)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span className="shrink-0 font-medium tabular-nums">
                  Art. {it.articleNumber}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {it.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{it.loi}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
