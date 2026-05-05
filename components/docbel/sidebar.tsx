"use client";

import React from "react";
import {
  DocIcon,
  CalcIcon,
  GroupIcon,
  HeartIcon,
  ScalesIcon,
  BookIcon,
  GridSquaresIcon,
  NewsIcon,
  HelpIcon,
  MoonIcon,
  SunIcon,
} from "./icons";
import { TOOLS_DATA } from "@/lib/docbel-data";

interface SidebarProps {
  accent: string;
  dark: boolean;
  setDark: (d: boolean | ((prev: boolean) => boolean)) => void;
  lang: string;
  setLang: (l: string) => void;
  activePage: string;
  setActivePage: (p: string) => void;
  userLoggedIn: boolean;
  setShowLoginModal: (s: boolean) => void;
  outilsOpen: boolean;
  setOutilsOpen: (o: boolean | ((prev: boolean) => boolean)) => void;
  width: number;
  userName?: string | null;
  toolsCat: string;
  setToolsCat: (c: string) => void;
  newsFilter?: string;
  setNewsFilter?: (f: string) => void;
}

const CATS = [
  { id: "Tous", label: "Les plus utilisés", Icon: GridSquaresIcon, color: "#7E3AF2" },
  { id: "Documents", label: "Documents", Icon: DocIcon, color: "#1A56DB" },
  { id: "Calculs", label: "Calculs", Icon: CalcIcon, color: "#F97316" },
  { id: "Organismes", label: "Organismes", Icon: GroupIcon, color: "#0E9F6E" },
  { id: "CPAS", label: "CPAS", Icon: HeartIcon, color: "#E11D48" },
  { id: "Juridique", label: "Juridique", Icon: ScalesIcon, color: "#6366F1" },
  { id: "Tutoriels", label: "Tutoriels", Icon: BookIcon, color: "#0891B2" },
];

const NEWS_FILTERS = [
  { id: "all", label: "Toutes les actualités", Icon: NewsIcon },
  { id: "updates", label: "Mes mises à jour", Icon: NewsIcon, badge: 2 },
];


export function Sidebar({
  accent,
  dark,
  setDark,
  width,
  toolsCat,
  setToolsCat,
  newsFilter = "all",
  setNewsFilter,
  setActivePage,
}: SidebarProps) {
  const counts: Record<string, number> = { Tous: TOOLS_DATA.length };
  TOOLS_DATA.forEach((t) => {
    counts[t.cat] = (counts[t.cat] || 0) + 1;
  });

  return (
    <nav
      style={{
        width,
        minWidth: width,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        flexShrink: 0,
        padding: "20px 16px 16px",
        gap: 18,
      }}
      className="bg-nav-bg border-r border-nav-border"
    >
      {/* News section */}
      <div>
        <div className="text-text-faint text-xs font-bold uppercase tracking-widest px-1 mb-2">Actualités</div>
        {NEWS_FILTERS.map((f) => {
          const active = newsFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => {
                setNewsFilter?.(f.id);
                setActivePage("actualites");
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-2.25 rounded-lg border-none text-sm transition-all ${
                active
                  ? "font-semibold"
                  : "font-medium text-text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
              style={{
                background: active ? `${accent}12` : undefined,
                color: active ? accent : undefined,
                marginBottom: 2,
              }}
            >
              <f.Icon size={15} />
              <span style={{ flex: 1 }}>{f.label}</span>
              {f.badge ? (
                <span className="text-xs font-bold px-1.75 py-0.5 rounded-full bg-surface-2 text-text-muted min-w-[20px] text-center">
                  {f.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Categories */}
      <div>
        <div className="text-text-faint text-xs font-bold uppercase tracking-widest px-1 mb-2">Catégories</div>
        {CATS.map((c) => {
          const active = toolsCat === c.id;
          const count = counts[c.id] || 0;
          return (
            <button
              key={c.id}
              onClick={() => {
                setToolsCat(c.id);
                setActivePage("outils");
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-2.25 rounded-lg border-none text-sm transition-all ${
                active
                  ? "font-semibold"
                  : "font-medium text-text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
              style={{
                background: active ? `${accent}12` : undefined,
                color: active ? accent : undefined,
                marginBottom: 2,
              }}
            >
              <span style={{ color: active ? accent : c.color, display: "flex" }}>
                <c.Icon size={15} />
              </span>
              <span style={{ flex: 1 }}>{c.label}</span>
              <span
                className={`text-xs font-bold px-1.75 py-0.5 rounded-full min-w-[20px] text-center ${
                  active ? "text-accent" : "text-text-faint bg-surface-2"
                }`}
                style={{
                  background: active ? `${accent}20` : undefined,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Help card */}
      <div
        style={{
          background: `linear-gradient(135deg, ${accent}10 0%, #7E3AF210 100%)`,
          border: `1px solid ${accent}25`,
          borderRadius: 12,
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: accent, display: "flex" }}>
            <HelpIcon size={16} />
          </span>
          <span className="text-sm font-bold text-foreground">Besoin d&apos;aide ?</span>
        </div>
        <p className="text-xs text-text-muted leading-relaxed m-0">
          Consultez nos guides ou contactez notre équipe.
        </p>
        <button
          onClick={() => setActivePage("tutoriels")}
          className="mt-1 px-3 py-1.75 rounded border border-border bg-surface text-foreground text-xs font-semibold hover:opacity-80 transition-opacity text-center"
        >
          Voir les tutoriels
        </button>
      </div>

      {/* Theme toggle */}
      <button
        onClick={() => setDark((d) => !d)}
        className="px-2 py-2 rounded-lg border border-border bg-transparent text-text-muted flex items-center justify-center gap-1.5 text-xs font-medium hover:bg-surface-2 transition-colors"
      >
        {dark ? <SunIcon size={14} /> : <MoonIcon size={14} />}
        <span>{dark ? "Mode clair" : "Mode sombre"}</span>
      </button>
    </nav>
  );
}
