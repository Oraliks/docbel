"use client";

import { useState } from "react";
import { StickyNote } from "lucide-react";

import { getNote, setNote } from "./notes-store";

/**
 * Éditeur de note personnelle sur un article (localStorage, par poste).
 * Init paresseux depuis le stockage (aucun setState dans un effet) ; persistance
 * à chaque frappe. Rendu discret — replié si aucune note.
 */
export function NoteEditor({
  riolexId,
  label,
  placeholder,
}: {
  riolexId: string;
  label: string;
  placeholder: string;
}) {
  const [value, setValue] = useState(() => getNote(riolexId));
  const [open, setOpen] = useState(() => getNote(riolexId).length > 0);

  const onChange = (v: string) => {
    setValue(v);
    setNote(riolexId, v);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground print:hidden"
        suppressHydrationWarning
      >
        <StickyNote className="size-4" aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border bg-amber-50/40 p-3 print:hidden" suppressHydrationWarning>
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-amber-700">
        <StickyNote className="size-4" aria-hidden />
        {label}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-y rounded-md border bg-card px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/30"
      />
      <p className="mt-1 text-xs text-muted-foreground">
        Note privée, enregistrée sur ce poste uniquement.
      </p>
    </div>
  );
}
