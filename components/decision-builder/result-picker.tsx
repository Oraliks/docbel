"use client";

/// Combobox de sélection d'un DocumentBundle pour un nœud résultat.
/// Construit sur Command + Popover (pas de composant combobox dans le repo).
/// `value` = slug du bundle, ou `null` pour « bientôt disponible ».

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronsUpDown,
  FolderOpen,
  CircleDashed,
  ExternalLink,
  TriangleAlert,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BundleOption {
  slug: string;
  name: string;
  organism: string | null;
  id: string | null;
  /// Nombre de formulaires PDF publiés inclus dans ce dossier.
  formCount: number;
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
    type Row = {
      id?: string;
      slug: string;
      name: string;
      organism?: string | null;
      items?: { pdfForm?: { status?: string } | null }[];
    };
    fetch("/api/documents/bundles")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Row[]) =>
        setBundles(
          (Array.isArray(rows) ? rows : []).map((b) => ({
            slug: b.slug,
            name: b.name,
            organism: b.organism ?? null,
            id: b.id ?? null,
            formCount: Array.isArray(b.items)
              ? b.items.filter((it) => it.pdfForm?.status === "published").length
              : 0,
          })),
        ),
      )
      .catch(() => setBundles([]));
  }, []);

  const selected = useMemo(
    () => bundles.find((b) => b.slug === value) ?? null,
    [bundles, value],
  );

  // Le dossier ciblé existe-t-il et est-il actif ? La liste ne contient que les
  // dossiers actifs → un `value` absent = dossier inactif ou supprimé (alerte).
  const missing = value !== null && bundles.length > 0 && selected === null;

  return (
    <div className="space-y-1.5">
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

      {/* État du dossier ciblé : garde-fou d'intégrité (inactif/introuvable)
          + accès direct à l'éditeur du dossier. */}
      {value !== null && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {missing ? (
            <Badge variant="destructive" className="gap-1">
              <TriangleAlert className="size-3" />
              Dossier inactif ou introuvable
            </Badge>
          ) : selected ? (
            <>
              <Badge variant={selected.formCount > 0 ? "success" : "secondary"}>
                {selected.formCount} formulaire{selected.formCount > 1 ? "s" : ""}
              </Badge>
              {selected.id && (
                <Link
                  href={`/admin/pdf/dossiers/${selected.id}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Ouvrir le dossier
                  <ExternalLink className="size-3" />
                </Link>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
