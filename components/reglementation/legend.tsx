"use client";

import { useTranslations } from "next-intl";

import { NATURE_ORDER, natureMeta } from "@/lib/reglementation/nature";
import { NatureTile } from "./nature-badge";

export function RegLegend() {
  const t = useTranslations("public.pro");

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {/* Natures juridiques */}
      {NATURE_ORDER.map((key) => {
        const m = natureMeta(key);
        return (
          <span key={key} className="flex items-center gap-1.5">
            <NatureTile nature={key} className="size-6 rounded-md" />
            <span>{m.label}</span>
          </span>
        );
      })}

      {/* Séparateur visuel */}
      <span className="mx-1 self-center text-border">|</span>

      {/* Statuts */}
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
        <span>{t("reglStatutVigueur")}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-destructive" aria-hidden />
        <span>{t("reglStatutAbroge")}</span>
      </span>
    </div>
  );
}
