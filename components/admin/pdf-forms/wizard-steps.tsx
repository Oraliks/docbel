"use client";

import { Fragment } from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function WizardSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => (
        <Fragment key={label}>
          <li className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-bold transition",
                i < current && "bg-primary text-primary-foreground",
                i === current && "border-2 border-primary bg-primary/20 text-primary",
                i > current && "bg-muted text-muted-foreground"
              )}
            >
              {i < current ? <CheckIcon className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden text-sm sm:inline",
                i === current ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </li>
          {i < steps.length - 1 && <div className="h-0.5 min-w-4 flex-1 bg-border" />}
        </Fragment>
      ))}
    </ol>
  );
}
