"use client";

/**
 * File d'attente "À valider" (zone 2 du workspace veille).
 *
 * Liste de cards verticales : 1 IngestedDocument = 1 card avec titre cliquable,
 * source d'origine, dates, + actions Valider / Rejeter inline.
 */

import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtRelative } from "../_shared";
import type { IngestedDocumentListItem } from "@/lib/chomage-ia/types";

interface Props {
  items: IngestedDocumentListItem[];
  loading: boolean;
  actingDocId: string | null;
  onRefresh: () => void;
  onAct: (
    doc: IngestedDocumentListItem,
    action: "validate" | "reject",
  ) => void | Promise<void>;
}

export function IngestionQueueList({
  items,
  loading,
  actingDocId,
  onRefresh,
  onAct,
}: Props) {
  return (
    <>
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold">
          À valider
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums">
            {items.length}
          </span>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>
      </header>
      <div className="mt-2 flex flex-col gap-2">
        {loading ? (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            File d&apos;attente vide. Lance un check pour scanner les sources.
          </div>
        ) : (
          items.map((doc) => (
            <article
              key={doc.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <a
                  href={doc.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-[13px] font-semibold hover:text-primary"
                >
                  {doc.title}
                  <ExternalLink className="ml-1 inline size-3" />
                </a>
                <div className="mt-0.5 flex flex-wrap gap-2 text-[10.5px] text-muted-foreground">
                  <span>Source : {doc.ingestionSourceName}</span>
                  <span>Détecté {fmtRelative(doc.fetchedAt)}</span>
                  {doc.publishedAt ? (
                    <span>Publié {fmtRelative(doc.publishedAt)}</span>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 inline-flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actingDocId === doc.id}
                  onClick={() => onAct(doc, "validate")}
                >
                  <CheckCircle2 className="size-3.5" />
                  Valider
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={actingDocId === doc.id}
                  onClick={() => onAct(doc, "reject")}
                >
                  <XCircle className="size-3.5" />
                  Rejeter
                </Button>
              </div>
            </article>
          ))
        )}
      </div>
    </>
  );
}
