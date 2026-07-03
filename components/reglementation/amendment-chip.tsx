"use client";

import { History } from "lucide-react";

import { naturePhrase } from "@/lib/reglementation/nature";
import type { AmendmentRef } from "@/lib/reglementation/parse-amendments";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Puce cliquable rendue à la place d'une référence d'acte modificateur
 * `(AR 30.7.2022 - MB 23.8 - EV 1.10)` : compacte dans le fil du texte, elle
 * ouvre au clic un popover décodant l'abréviation en clair.
 *
 * ⚠️ Le prop s'appelle `amendment` (et non `ref`) : `ref` est réservé par React
 * et déclencherait « Refs cannot be used in Server Components » au rendu.
 */
export function AmendmentChip({ amendment }: { amendment: AmendmentRef }) {
  const short =
    amendment.nature === "Loi-programme" ? "L-P" : amendment.nature ?? "réf.";
  const year = amendment.dateEV?.slice(-4) ?? amendment.dateActe?.slice(-4) ?? "";

  return (
    <Popover>
      <PopoverTrigger
        className="mx-0.5 inline-flex items-baseline gap-0.5 rounded bg-primary/10 px-1 align-baseline text-[0.72em] font-medium text-primary transition-colors hover:bg-primary/20"
        title="Voir la modification"
      >
        <History className="size-3 translate-y-0.5" aria-hidden />
        <span>
          {short}
          {year ? ` ${year}` : ""}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-xs space-y-1.5 text-sm">
        <p className="font-medium text-foreground">Modification du texte</p>
        <p className="text-muted-foreground">
          Modifié par {naturePhrase(amendment.nature)}
          {amendment.dateActe ? ` du ${amendment.dateActe}` : ""}.
        </p>
        <dl className="space-y-0.5 text-xs text-muted-foreground">
          {amendment.dateMB && (
            <div className="flex justify-between gap-3">
              <dt>Moniteur belge</dt>
              <dd className="text-foreground">{amendment.dateMB}</dd>
            </div>
          )}
          {amendment.dateEV && (
            <div className="flex justify-between gap-3">
              <dt>Entrée en vigueur</dt>
              <dd className="text-foreground">{amendment.dateEV}</dd>
            </div>
          )}
        </dl>
        <p className="border-t pt-1.5 text-[0.7rem] leading-snug text-muted-foreground/80">
          Référence RioLex : <span className="font-mono">{amendment.raw}</span>
        </p>
      </PopoverContent>
    </Popover>
  );
}
