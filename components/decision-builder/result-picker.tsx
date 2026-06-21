"use client";

/// Combobox de sélection d'un DocumentBundle pour un nœud résultat.
/// Construit sur Command + Popover (pas de composant combobox dans le repo).
/// `value` = slug du bundle, ou `null` pour « bientôt disponible ».

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, FolderOpen, CircleDashed } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface BundleOption {
  slug: string;
  name: string;
  organism: string | null;
}

export function ResultPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (slug: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [bundles, setBundles] = useState<BundleOption[]>([]);

  useEffect(() => {
    fetch("/api/documents/bundles")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { slug: string; name: string; organism?: string | null }[]) =>
        setBundles(
          (Array.isArray(rows) ? rows : []).map((b) => ({
            slug: b.slug,
            name: b.name,
            organism: b.organism ?? null,
          })),
        ),
      )
      .catch(() => setBundles([]));
  }, []);

  const selected = useMemo(
    () => bundles.find((b) => b.slug === value) ?? null,
    [bundles, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <span className="flex min-w-0 items-center gap-2">
          {value === null ? (
            <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">
            {value === null
              ? "Bientôt disponible (aucun dossier)"
              : (selected?.name ?? value)}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[320px] max-w-[90vw] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un dossier…" />
          <CommandList>
            <CommandEmpty>Aucun dossier trouvé.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__ bientôt disponible"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <CircleDashed className="size-4 text-muted-foreground" />
                <span className="flex-1">Bientôt disponible (aucun dossier)</span>
                <Check
                  className={cn(
                    "size-4",
                    value === null ? "opacity-100" : "opacity-0",
                  )}
                />
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Dossiers">
              {bundles.map((b) => (
                <CommandItem
                  key={b.slug}
                  value={`${b.name} ${b.slug} ${b.organism ?? ""}`}
                  onSelect={() => {
                    onChange(b.slug);
                    setOpen(false);
                  }}
                >
                  <FolderOpen className="size-4 text-muted-foreground" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{b.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {b.organism ? `${b.organism} · ` : ""}
                      {b.slug}
                    </span>
                  </span>
                  <Check
                    className={cn(
                      "size-4",
                      value === b.slug ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
