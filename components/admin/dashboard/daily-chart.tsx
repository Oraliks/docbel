"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyPoint } from "@/lib/admin/dashboard-stats";

function dayLabel(day: string): string {
  // "2026-07-10" → "10/07"
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

export function DailyChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
        <defs>
          <linearGradient id="cockpit-visitors" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
        <XAxis
          dataKey="day"
          tickFormatter={dayLabel}
          stroke="var(--muted-foreground)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip
          labelFormatter={(d) => dayLabel(String(d))}
          cursor={{ stroke: "var(--border)" }}
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 11,
            padding: "4px 8px",
          }}
        />
        <Area
          type="monotone"
          dataKey="visitors"
          name="Visiteurs"
          stroke="var(--primary)"
          strokeWidth={1.5}
          fill="url(#cockpit-visitors)"
        />
        <Area
          type="monotone"
          dataKey="runs"
          name="Dossiers"
          stroke="#0d9488"
          strokeWidth={1.5}
          fill="transparent"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
