"use client";

// recharts (~300 Ko) sort du bundle initial : même pattern dynamic ssr:false
// que l'ancien overview, avec un skeleton de forme proche.
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/skeletons";
import type { DailyPoint } from "@/lib/admin/dashboard-stats";

const DailyChart = dynamic(
  () => import("./daily-chart").then((m) => ({ default: m.DailyChart })),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export function DailyChartLazy({ data }: { data: DailyPoint[] }) {
  return <DailyChart data={data} />;
}
