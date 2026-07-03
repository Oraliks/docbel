"use client";

import { useState } from "react";
import { FolderPlus, Check, Plus } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useDossiers,
  addToDossier,
  removeFromDossier,
  createDossier,
} from "./dossiers-store";
import type { RegItem } from "./pins-store";

/** Bouton « Ajouter à un dossier » : bascule l'appartenance ou crée un dossier. */
export function DossierPicker({ item, label }: { item: RegItem; label: string }) {
  const dossiers = useDossiers();
  const [name, setName] = useState("");

  const toggle = (id: string, inside: boolean) => {
    if (inside) removeFromDossier(id, item.riolexId);
    else addToDossier(id, item);
  };

  const create = () => {
    if (!name.trim()) return;
    const id = createDossier(name);
    addToDossier(id, item);
    setName("");
  };

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground print:hidden"
        title={label}
      >
        <FolderPlus className="size-4" aria-hidden />
        {label}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-1">
        {dossiers.length === 0 && (
          <p className="px-1 py-1 text-xs text-muted-foreground">
            Aucun dossier — créez-en un ci-dessous.
          </p>
        )}
        {dossiers.map((d) => {
          const inside = d.items.some((i) => i.riolexId === item.riolexId);
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => toggle(d.id, inside)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="min-w-0 truncate">{d.name}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                {d.items.length}
                {inside && <Check className="size-4 text-primary" aria-hidden />}
              </span>
            </button>
          );
        })}
        <div className="flex items-center gap-1 border-t pt-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
            placeholder="Nouveau dossier…"
            className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
          />
          <button
            type="button"
            onClick={create}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Créer"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
