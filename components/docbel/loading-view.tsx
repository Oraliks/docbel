"use client";

import React, { useEffect, useState } from "react";
import { Tool } from "@/lib/docbel-data";

interface LoadingViewProps {
  accent: string;
  tool: Tool | null;
}

export function LoadingView({ accent, tool }: LoadingViewProps) {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d + 1) % 4), 280);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
      <div className="relative w-[72px] h-[72px]">
        <svg width="72" height="72" viewBox="0 0 72 72" className="absolute inset-0">
          <circle cx="36" cy="36" r="32" fill="none" stroke="currentColor" strokeWidth="4" className="text-border" />
          <circle
            cx="36"
            cy="36"
            r="32"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray="201"
            strokeDashoffset="50"
            strokeLinecap="round"
            className="animate-spin"
            style={{ color: accent, transformOrigin: "center", animation: "docbel-spin 1s linear infinite" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          {tool?.icon}
        </div>
      </div>
      <div className="text-center">
        <div className="text-base font-bold text-foreground mb-1.5">
          Chargement{".".repeat(dots)}
        </div>
        <div className="text-sm text-muted-foreground">{tool?.title}</div>
      </div>
    </div>
  );
}
