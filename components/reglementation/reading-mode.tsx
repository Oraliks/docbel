"use client";

import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";

/**
 * « Mode guichet » : bascule le texte de loi en plein écran, gros caractères,
 * chrome masqué — pour tourner l'écran vers l'affilié et lui montrer la règle.
 *
 * Le contenu est déplacé dans un portal (document.body) : il échappe ainsi aux
 * variables CSS de densité (TextSettings) et adopte la mise en page « lecture ».
 * Échap ou le bouton ferment.
 */
export function ReadingMode({
  title,
  label,
  children,
}: {
  title: string;
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const bigVars = {
    "--legal-fs": "19px",
    "--legal-lh": "1.95",
    "--legal-measure": "80ch",
  } as CSSProperties;

  return (
    <>
      <div className="mb-2 flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Maximize2 className="size-3.5" aria-hidden />
          {label}
        </button>
      </div>

      {!open && children}

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[70] overflow-auto bg-background">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 px-6 py-3 backdrop-blur">
              <h2 className="truncate font-semibold">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <X className="size-4" aria-hidden />
                Fermer <kbd className="ml-1 text-xs text-muted-foreground">Échap</kbd>
              </button>
            </div>
            <div className="mx-auto max-w-[82ch] px-6 py-10" style={bigVars}>
              {children}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
