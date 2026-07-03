"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Bouton « copier » polyvalent :
 *  - `value` → copie une chaîne fixe (ex. citation « AR 25/11/1991, art. 44… ») ;
 *  - `anchor` → copie le permalien profond de la page vers cette ancre (#par-2),
 *    calculé au clic depuis l'URL courante.
 * `iconOnly` rend une petite icône discrète (utilisée par ancre de §).
 */
export function CopyButton({
  value,
  anchor,
  label,
  copiedLabel = "Copié",
  iconOnly = false,
}: {
  value?: string;
  anchor?: string;
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const text = anchor
      ? `${window.location.origin}${window.location.pathname}#${anchor}`
      : (value ?? "");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papier indisponible (contexte non sécurisé) */
    }
  };

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={onCopy}
        title={label ?? "Copier le lien vers ce paragraphe"}
        aria-label={label ?? "Copier le lien vers ce paragraphe"}
        className="inline-flex size-6 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 focus:opacity-100 print:hidden"
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
      </button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={onCopy} className="gap-1.5">
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? copiedLabel : (label ?? "Copier")}
    </Button>
  );
}
