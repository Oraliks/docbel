"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

type Commune = {
  id: string;
  insCode: string;
  nameFr: string;
  nameNl: string | null;
  region: string;
  postalCodes: string[];
};

export function CommuneCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Commune[]>([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/communes?limit=600")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems(data.items ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(() => items.find((c) => c.id === value) ?? null, [items, value]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items.slice(0, 60);
    return items
      .filter(
        (c) =>
          c.nameFr.toLowerCase().includes(s) ||
          (c.nameNl ?? "").toLowerCase().includes(s) ||
          c.insCode.includes(s) ||
          c.postalCodes.some((p) => p.startsWith(s))
      )
      .slice(0, 60);
  }, [items, search]);

  return (
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between">
            {selected ? (
              <span className="truncate">
                {selected.nameFr}
                {selected.nameNl && ` · ${selected.nameNl}`}{" "}
                <span className="text-xs text-muted-foreground">({selected.insCode})</span>
              </span>
            ) : (
              <span className="text-muted-foreground">— Choisir une commune —</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0">
          <div className="p-2 border-b">
            <Input
              placeholder="Recherche par nom, INS ou CP"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>
          <ScrollArea className="h-72">
            {!loaded && (
              <div className="p-4 text-center text-xs text-muted-foreground">Chargement…</div>
            )}
            {loaded && filtered.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">Aucune commune.</div>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={`h-4 w-4 mt-0.5 ${value === c.id ? "opacity-100" : "opacity-0"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {c.nameFr}
                    {c.nameNl && (
                      <span className="text-muted-foreground"> · {c.nameNl}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    INS {c.insCode}
                    {c.postalCodes.length > 0 && ` · ${c.postalCodes.slice(0, 3).join(", ")}`}
                    {c.postalCodes.length > 3 && "…"}
                  </div>
                </div>
              </button>
            ))}
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange("")}
          title="Retirer"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
