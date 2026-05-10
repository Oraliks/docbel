"use client";

import React from "react";
import { dayLabelFr, type BureauHours } from "@/lib/bureaus/types";

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function BureauHoursDisplay({ hours }: { hours: BureauHours }) {
  return (
    <details className="text-[11px] text-[var(--text-muted)]">
      <summary className="cursor-pointer select-none">Horaires</summary>
      <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        {ORDER.map((d) => {
          const slots = hours.find((h) => h.day === d)?.slots ?? [];
          return (
            <React.Fragment key={d}>
              <span className="font-semibold">{dayLabelFr(d)}</span>
              <span>
                {slots.length === 0
                  ? "—"
                  : slots.map((s) => `${s.open}–${s.close}`).join(" · ")}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </details>
  );
}
