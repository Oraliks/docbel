"use client";

import React from "react";
import { BelgianFlag } from "./icons";

interface FooterProps {
  accent: string;
}

export function Footer({ accent }: FooterProps) {
  return (
    <footer className="border-t border-border px-10 py-7 bg-surface mt-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2.5">
          <BelgianFlag />
          <span className="text-xs font-bold text-foreground">DroitPublic</span>
        </div>
        <div className="flex gap-6">
          {["Mentions légales", "Vie privée", "Accessibilité", "Contact"].map((l) => (
            <a
              key={l}
              href="#"
              className="text-xs text-text-muted no-underline font-medium transition-colors"
              style={{
                color: undefined,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
            >
              {l}
            </a>
          ))}
        </div>
        <div className="text-xs text-text-faint">© 2026 DroitPublic</div>
      </div>
    </footer>
  );
}
