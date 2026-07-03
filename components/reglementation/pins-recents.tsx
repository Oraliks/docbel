"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Pin, Star, History } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  usePins,
  useRecents,
  togglePin,
  pushRecent,
  type RegItem,
} from "./pins-store";

/** Étoile d'épinglage réutilisable (carte résultat + barre d'actions fiche). */
export function PinButton({ item, className = "" }: { item: RegItem; className?: string }) {
  const pins = usePins();
  const pinned = pins.some((p) => p.riolexId === item.riolexId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePin(item);
      }}
      aria-pressed={pinned}
      title={pinned ? "Retirer des épingles" : "Épingler"}
      className={`inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent ${
        pinned ? "text-amber-500" : "text-muted-foreground/50 hover:text-foreground"
      } ${className}`}
    >
      <Star className="size-4" fill={pinned ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}

/** Enregistre la visite d'une fiche dans l'historique récent (rendu invisible). */
export function RecordVisit({ item }: { item: RegItem }) {
  useEffect(() => {
    pushRecent(item);
    // riolexId identifie la fiche ; les autres champs en dépendent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.riolexId]);
  return null;
}

function ChipRow({
  label,
  icon: Icon,
  items,
}: {
  label: string;
  icon: typeof Pin;
  items: RegItem[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </span>
      {items.map((it) => (
        <Link
          key={it.riolexId}
          href={`/partenaire/reglementation/${encodeURIComponent(it.riolexId)}`}
          className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs transition-colors hover:bg-accent"
          title={it.title}
        >
          <span className="font-medium tabular-nums">Art. {it.articleNumber}</span>
          <span className="text-muted-foreground">{it.loi}</span>
        </Link>
      ))}
    </div>
  );
}

/** Deux rangées de chips en tête de liste : épingles + consultés récemment. */
export function PinsRecents() {
  const t = useTranslations("public.pro");
  const pins = usePins();
  const recents = useRecents();
  if (pins.length === 0 && recents.length === 0) return null;
  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
      <ChipRow label={t("reglPinned")} icon={Pin} items={pins} />
      <ChipRow label={t("reglRecents")} icon={History} items={recents} />
    </div>
  );
}
