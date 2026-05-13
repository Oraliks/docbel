"use client";

import { useState } from "react";
import { X, Tag, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

/// Éditeur de tags pour la recherche par vocabulaire / synonymes.
/// Tape un mot ou une expression → Enter (ou virgule) pour ajouter.
export function VocabularyTagsEditor({
  value,
  onChange,
  placeholder = "intempéries, chômage technique, mise au chômage…",
}: Props) {
  const [draft, setDraft] = useState("");
  const tags = value || [];

  function addTag(raw: string) {
    const cleaned = raw.trim();
    if (!cleaned) return;
    if (tags.includes(cleaned)) return;
    onChange([...tags, cleaned]);
  }

  function removeTag(idx: number) {
    onChange(tags.filter((_, i) => i !== idx));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(draft);
      setDraft("");
      return;
    }
    if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-1.5">
        <Tag className="w-4 h-4" />
        Mots-clés (synonymes / langage courant)
      </Label>
      <p className="text-[11px] text-muted-foreground italic">
        Utilisés par la recherche libre et le détecteur d&apos;intention IA.
        Pensez aux expressions que les citoyens utilisent vraiment (« intempéries »
        plutôt que « chômage temporaire force majeure »).
      </p>
      <div className="border rounded-md p-2 bg-background space-y-2">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs gap-1 pr-1">
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(idx)}
                  className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                  aria-label={`Retirer ${t}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="h-7 text-xs flex-1 border-0 focus-visible:ring-0 px-0"
          />
          <button
            type="button"
            onClick={() => {
              addTag(draft);
              setDraft("");
            }}
            disabled={!draft.trim()}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Ajouter"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
