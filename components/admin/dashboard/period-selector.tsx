"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Period } from "@/lib/admin/dashboard-stats-helpers";

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 j" },
  { value: "30d", label: "30 j" },
  { value: "90d", label: "90 j" },
];

export function PeriodSelector({ period }: { period: Period }) {
  const router = useRouter();
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5 text-xs">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => router.replace(`/admin?period=${p.value}`, { scroll: false })}
          className={cn(
            "rounded-md px-2.5 py-1 tabular-nums transition-colors",
            period === p.value
              ? "bg-primary/10 font-medium text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
