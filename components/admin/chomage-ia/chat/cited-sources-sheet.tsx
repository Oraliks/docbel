"use client";

/**
 * Drawer droit (Shadcn Sheet) qui affiche les sources de la knowledge base
 * citées dans la conversation courante.
 *
 * Toggle via bouton dans la barre du chat. Logique réutilisée depuis l'ancien
 * `cited-sources-panel.tsx` mais encapsulée dans un Sheet pour libérer l'espace
 * principal du chat.
 */

import { ExternalLink, Inbox } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getKindIcon, getKindLabel } from "../_shared";
import type { CitedSourceLite } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: CitedSourceLite[];
}

export function CitedSourcesSheet({ open, onOpenChange, sources }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[340px] sm:max-w-[340px]"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Sources citées ({sources.length})</SheetTitle>
          <SheetDescription>
            Sources de la knowledge base référencées par l&apos;IA dans cette
            conversation.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-hidden">
          {sources.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center text-muted-foreground">
              <Inbox className="size-6 opacity-50" />
              <p className="text-[12px] leading-relaxed">
                Les sources citées par l&apos;IA dans cette conversation
                apparaîtront ici.
              </p>
            </div>
          ) : (
            <ul className="flex-1 space-y-1.5 overflow-y-auto p-2">
              {sources.map((src) => {
                const Icon = getKindIcon(src.kind);
                const hasUrl = !!src.sourceUrl;
                return (
                  <li
                    key={src.id}
                    className="rounded-lg border border-border bg-background/60 p-2 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"
                        title={getKindLabel(src.kind)}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        {hasUrl ? (
                          <a
                            href={src.sourceUrl ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex items-start gap-1 text-[12.5px] font-semibold leading-snug text-primary hover:underline"
                          >
                            <span className="line-clamp-2">{src.title}</span>
                            <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-60 group-hover:opacity-100" />
                          </a>
                        ) : (
                          <span className="text-[12.5px] font-semibold leading-snug text-foreground line-clamp-2">
                            {src.title}
                          </span>
                        )}
                        {src.summary ? (
                          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground line-clamp-3">
                            {src.summary}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[10.5px] uppercase tracking-wider text-muted-foreground/80">
                          {getKindLabel(src.kind)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
