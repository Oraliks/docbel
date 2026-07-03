"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { parseQueryIntent } from "@/lib/reglementation/query-intent";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

interface IndexItem {
  riolexId: string;
  loi: string;
  articleNumber: string;
  nature: string;
  abroge: boolean;
  title: string;
}

/** Événement custom permettant d'ouvrir la palette depuis un bouton. */
export const OPEN_PALETTE_EVENT = "regl:open-palette";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");

/**
 * Palette de commande (Ctrl/⌘+K) : saut direct vers un article par numéro
 * (« 131bis », « am 75ter ») ou par titre. Charge l'index léger du corpus une
 * seule fois, filtre côté client en priorisant le match exact de numéro.
 */
export function CommandPalette() {
  const t = useTranslations("public.pro");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<IndexItem[]>([]);
  const loadedRef = useRef(false);

  // Ouverture au clavier + via événement custom.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  // Chargement paresseux de l'index (une seule fois, à la première ouverture).
  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    fetch("/api/partenaire/reglementation/index")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch(() => {
        loadedRef.current = false; // autorise une nouvelle tentative
      });
  }, [open]);

  const results = useMemo(() => {
    const query = norm(q.trim());
    if (!query) return items.slice(0, 40);
    const intent = parseQueryIntent(q);
    const scored: { it: IndexItem; score: number }[] = [];
    for (const it of items) {
      const num = it.articleNumber.toLowerCase();
      const title = norm(it.title);
      const loi = norm(it.loi);
      let score = -1;
      if (intent.articleNumber && num === intent.articleNumber) {
        score = intent.nature && it.nature === intent.nature ? 120 : 100;
      } else if (num === query) score = 100;
      else if (num.startsWith(query)) score = 80;
      else if (title.includes(query)) score = 45;
      else if (loi.includes(query)) score = 25;
      else if (`${loi} art ${num}`.includes(query)) score = 15;
      if (score >= 0) scored.push({ it, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 40).map((s) => s.it);
  }, [q, items]);

  const go = (riolexId: string) => {
    setOpen(false);
    setQ("");
    router.push(`/partenaire/reglementation/${encodeURIComponent(riolexId)}`);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("reglPaletteTitle")}
      description={t("reglPaletteHint")}
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={q}
          onValueChange={setQ}
          placeholder={t("reglPalettePlaceholder")}
        />
        <CommandList>
          <CommandEmpty>{t("reglEmpty")}</CommandEmpty>
          <CommandGroup>
            {results.map((it) => (
              <CommandItem
                key={it.riolexId}
                value={it.riolexId}
                onSelect={() => go(it.riolexId)}
                className="gap-2"
              >
                <span className="shrink-0 font-medium tabular-nums">
                  Art. {it.articleNumber}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {it.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{it.loi}</span>
                {it.abroge && (
                  <Badge variant="destructive" className="shrink-0">
                    {t("reglAbroge")}
                  </Badge>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
