"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface CopyButtonProps {
  value: string;
  title?: string;
}

/**
 * Petit bouton copy-to-clipboard. Utilisé par la sidebar pour l'URL
 * publique et le snippet iframe. Affiche un check pendant ~1,5s puis
 * revient à l'icône Copy.
 */
export function CopyButton({ value, title = "Copier" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copié dans le presse-papiers");
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      toast.error("Impossible de copier", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={title}
      className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {copied ? (
        <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="size-3" />
      )}
    </button>
  );
}
