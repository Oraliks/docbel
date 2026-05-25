"use client";

/**
 * Popover de bulk-tagging utilisé depuis la bulk-actions-bar.
 *
 * Deux modes côte à côte (toggle au-dessus) :
 *   - "add"    : on ajoute les tags saisis aux N sources sélectionnées
 *   - "remove" : on les retire (suggestions = union des tags présents
 *                sur la sélection)
 *
 * Input texte avec parse Enter / virgule, autocomplete sur les tags existants
 * en KB (passés en `allTags`). Multi-tag possible (3-4 d'un coup).
 *
 * Le bouton "Appliquer" est désactivé tant qu'il n'y a aucun tag à appliquer.
 * Le composant ne fait pas l'appel API lui-même — il appelle `onApply` avec
 * la liste finale et le parent dispatch vers `/api/.../bulk`.
 */

import { useMemo, useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BulkTagPickerProps {
  /** Nb de sources sélectionnées (affiché dans le footer "Appliquer à X"). */
  count: number;
  /** Tous les tags existants en KB, pour suggérer. */
  allTags: string[];
  /** Mode initial. Le user peut switcher dedans. */
  defaultMode?: "add" | "remove";
  /** Si en cours d'appel API → spinner + boutons désactivés. */
  submitting: boolean;
  /** Callback final. Renvoie le mode + la liste de tags. Le parent ferme le popover. */
  onApply: (mode: "add" | "remove", tags: string[]) => void | Promise<void>;
}

export function BulkTagPicker({
  count,
  allTags,
  defaultMode = "add",
  submitting,
  onApply,
}: BulkTagPickerProps) {
  const [mode, setMode] = useState<"add" | "remove">(defaultMode);
  const [input, setInput] = useState("");
  const [chips, setChips] = useState<string[]>([]);

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return allTags.slice(0, 8);
    return allTags
      .filter(
        (t) => t.toLowerCase().includes(q) && !chips.includes(t)
      )
      .slice(0, 8);
  }, [input, allTags, chips]);

  function commitChip(raw: string) {
    const v = raw.trim().slice(0, 50);
    if (!v) return;
    if (chips.includes(v)) {
      setInput("");
      return;
    }
    setChips((arr) => [...arr, v].slice(0, 20));
    setInput("");
  }

  function removeChip(t: string) {
    setChips((arr) => arr.filter((x) => x !== t));
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitChip(input);
    } else if (e.key === "Backspace" && input === "" && chips.length > 0) {
      // Bouge le dernier chip en édition pour pouvoir le corriger.
      const last = chips[chips.length - 1];
      setChips((arr) => arr.slice(0, -1));
      setInput(last);
    }
  }

  async function handleApply() {
    if (chips.length === 0 || submitting) return;
    await onApply(mode, chips);
  }

  return (
    <div className="flex w-72 flex-col gap-2.5">
      {/* Mode toggle */}
      <div
        role="tablist"
        className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 text-[11.5px] font-semibold"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "add"}
          onClick={() => setMode("add")}
          className={`flex-1 rounded-sm px-2 py-1 transition-colors ${
            mode === "add"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Ajouter
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "remove"}
          onClick={() => setMode("remove")}
          className={`flex-1 rounded-sm px-2 py-1 transition-colors ${
            mode === "remove"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Retirer
        </button>
      </div>

      {/* Chips + input */}
      <div className="flex min-h-[36px] flex-wrap items-center gap-1 rounded-md border border-input bg-background px-1.5 py-1">
        {chips.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-primary"
          >
            {t}
            <button
              type="button"
              aria-label={`Retirer ${t}`}
              onClick={() => removeChip(t)}
              className="rounded-sm transition-colors hover:bg-primary/20"
            >
              <X className="size-2.5" />
            </button>
          </span>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => commitChip(input)}
          placeholder={chips.length === 0 ? "tag, autre-tag…" : ""}
          className="h-6 flex-1 min-w-[80px] border-0 px-1 text-[12px] shadow-none focus-visible:ring-0"
        />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => commitChip(t)}
              className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/30 px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus className="size-2.5 opacity-70" />
              {t}
            </button>
          ))}
        </div>
      ) : null}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10.5px] text-muted-foreground">
          {mode === "add" ? "Ajouter à" : "Retirer de"} {count} source
          {count > 1 ? "s" : ""}
        </span>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={chips.length === 0 || submitting}
        >
          {submitting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : null}
          Appliquer
        </Button>
      </div>
    </div>
  );
}
