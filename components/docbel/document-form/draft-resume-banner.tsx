"use client";

import { SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GLASS_PRIMARY_STYLE } from "@/lib/glass-classes";

interface DraftResumeBannerProps {
  updatedAt: string;
  onResume: () => void;
  onDiscard: () => void;
}

export function DraftResumeBanner({
  updatedAt,
  onResume,
  onDiscard,
}: DraftResumeBannerProps) {
  return (
    <div className="glass-surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
          }}
        >
          <SaveIcon className="size-4" />
        </span>
        <p className="text-[13px] text-[color:var(--glass-ink)]">
          Vous avez un brouillon en cours, sauvegardé le{" "}
          <strong>{new Date(updatedAt).toLocaleString("fr-BE")}</strong>.
          Souhaitez-vous le reprendre ?
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onDiscard}
          className="rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55"
        >
          Recommencer
        </Button>
        <Button
          size="sm"
          onClick={onResume}
          className="rounded-full font-bold"
          style={GLASS_PRIMARY_STYLE}
        >
          Reprendre
        </Button>
      </div>
    </div>
  );
}
