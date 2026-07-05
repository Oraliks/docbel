"use client";

import { useState } from "react";
import { InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
  text: string;
  className?: string;
}

/// Petite icône "i" : affiche `text` au survol/focus (desktop, via le
/// Tooltip base-ui existant) ET au tap (mobile — le Tooltip base-ui ne gère
/// pas le tactile nativement, donc on pilote l'ouverture manuellement).
export function InfoTooltip({ text, className }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          type="button"
          aria-label={text}
          onClick={(e) => {
            e.preventDefault();
            setOpen((o) => !o);
          }}
          className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[color:var(--glass-ink-soft)] transition-colors hover:text-[color:var(--glass-accent-deep,#5B46E5)] ${className ?? ""}`}
        >
          <InfoIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] text-left">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
