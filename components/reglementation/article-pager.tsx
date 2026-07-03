"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PagerLink {
  riolexId: string;
  articleNumber: string;
}

/**
 * Navigation « article précédent / suivant » dans un même texte de loi.
 * Flèches ← / → au clavier (hors champs de saisie) pour tourner les pages
 * comme dans un code papier.
 */
export function ArticlePager({
  prev,
  next,
  labelPrev,
  labelNext,
}: {
  prev: PagerLink | null;
  next: PagerLink | null;
  labelPrev: string;
  labelNext: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (el?.isContentEditable) return;
      if (e.key === "ArrowLeft" && prev) {
        router.push(`/partenaire/reglementation/${encodeURIComponent(prev.riolexId)}`);
      } else if (e.key === "ArrowRight" && next) {
        router.push(`/partenaire/reglementation/${encodeURIComponent(next.riolexId)}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);

  if (!prev && !next) return null;

  return (
    <nav className="flex items-center justify-between gap-3 print:hidden">
      {prev ? (
        <Link
          href={`/partenaire/reglementation/${encodeURIComponent(prev.riolexId)}`}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent"
        >
          <ChevronLeft className="size-4" aria-hidden />
          <span className="text-muted-foreground">{labelPrev}</span>
          <span className="font-medium">Art. {prev.articleNumber}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={`/partenaire/reglementation/${encodeURIComponent(next.riolexId)}`}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent"
        >
          <span className="font-medium">Art. {next.articleNumber}</span>
          <span className="text-muted-foreground">{labelNext}</span>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
