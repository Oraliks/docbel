"use client";

import React from "react";
import { NewsItem, Tool } from "@/lib/docbel-data";

interface HeroSectionProps {
  news: NewsItem[];
  newsIdx: number;
  setNewsIdx: (i: number | ((prev: number) => number)) => void;
  accent: string;
  heroStyle: "gradient" | "flat" | "bordered";
  onArticleClick?: (n: NewsItem) => void;
  featuredTools?: Tool[];
  onToolClick?: (t: Tool) => void;
}

const TAG_COLORS: Record<string, { bg: string; fg: string }> = {
  "Mise à jour": { bg: "#DBEAFE", fg: "#1D4ED8" },
  "Annonce ONEM": { bg: "#FEF3C7", fg: "#B45309" },
  CPAS: { bg: "#FCE7F3", fg: "#BE185D" },
  Réforme: { bg: "#EDE9FE", fg: "#6D28D9" },
  Nouveau: { bg: "#DBEAFE", fg: "#1D4ED8" },
};

function tagColor(tag: string) {
  return TAG_COLORS[tag] || { bg: "#E5E7EB", fg: "#374151" };
}

export function HeroSection({
  news,
  newsIdx,
  setNewsIdx,
  accent,
  onArticleClick,
  featuredTools = [],
  onToolClick,
}: HeroSectionProps) {
  if (!news.length) return null;
  const main = news[newsIdx];
  const tag = tagColor(main.tag);

  return (
    <section className="mb-9">
      <h2 className="text-2xl font-black text-foreground mb-4" style={{ letterSpacing: "-0.5px" }}>
        Actualités
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 18 }}>
        {/* Main featured news card */}
        <button
          onClick={() => onArticleClick?.(main)}
          style={{
            position: "relative",
            background: main.image
              ? "transparent"
              : "linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 50%, #FDF4FF 100%)",
            border: `1px solid ${main.image ? "transparent" : "#E0E7FF"}`,
            borderRadius: 16,
            padding: 0,
            textAlign: "left",
            cursor: "pointer",
            overflow: "hidden",
            minHeight: 280,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            transition: "transform 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
        >
          {main.image ? (
            /* Real article image as full background */
            <>
              {/* Hero media comes from dynamic article content and is intentionally rendered as-is. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={main.image}
                alt={main.title}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: 16,
                }}
              />
              {/* Gradient overlay for text legibility */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 16,
                  background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)",
                }}
              />
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  padding: "28px 32px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 999,
                    background: tag.bg,
                    color: tag.fg,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    width: "fit-content",
                  }}
                >
                  {main.tag}
                </span>
                <h3
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#fff",
                    lineHeight: 1.25,
                    letterSpacing: "-0.4px",
                    margin: 0,
                  }}
                >
                  {main.title}
                </h3>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{main.date}</span>
                  <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>Lire l&apos;article complet →</span>
                </div>
              </div>
            </>
          ) : (
            /* Fallback: decorative document card (no image) */
            <div style={{ padding: "32px 36px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
              <div
                style={{
                  position: "absolute",
                  top: 24,
                  right: 28,
                  width: 165,
                  height: 210,
                  background: "white",
                  borderRadius: 12,
                  boxShadow: "0 8px 24px rgba(99,102,241,0.15)",
                  transform: "rotate(6deg)",
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  opacity: 0.95,
                }}
              >
                <div style={{ height: 8, background: "#E5E7EB", borderRadius: 4, width: "70%" }} />
                <div style={{ height: 6, background: "#F3F4F6", borderRadius: 4, width: "100%" }} />
                <div style={{ height: 6, background: "#F3F4F6", borderRadius: 4, width: "90%" }} />
                <div style={{ height: 6, background: "#F3F4F6", borderRadius: 4, width: "95%" }} />
                <div
                  style={{
                    marginTop: 10,
                    width: 52,
                    height: 52,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #A5B4FC 0%, #C4B5FD 100%)",
                    alignSelf: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                  }}
                >
                  ⚖️
                </div>
                <div style={{ height: 5, background: "#F3F4F6", borderRadius: 4, width: "80%", marginTop: 8 }} />
                <div style={{ height: 5, background: "#F3F4F6", borderRadius: 4, width: "65%" }} />
              </div>

              <div style={{ position: "relative", zIndex: 1, maxWidth: "60%" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 999,
                    background: tag.bg,
                    color: tag.fg,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: 14,
                  }}
                >
                  {main.tag}
                </span>
                <h3
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "#1F2937",
                    lineHeight: 1.25,
                    letterSpacing: "-0.5px",
                    marginBottom: 12,
                  }}
                >
                  {main.title}
                </h3>
                <p style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.6, margin: 0 }}>
                  {main.desc.length > 120 ? main.desc.slice(0, 120) + "…" : main.desc}
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  position: "relative",
                  zIndex: 1,
                  maxWidth: "60%",
                }}
              >
                <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>{main.date}</span>
                <span style={{ fontSize: 13, color: accent, fontWeight: 600 }}>Lire l&apos;article complet →</span>
              </div>
            </div>
          )}
        </button>

        {/* Right: 2 featured tool cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {featuredTools.slice(0, 2).map((tool) => (
            <FeaturedToolCard
              key={tool.id}
              tool={tool}
              accent={accent}
              onClick={() => onToolClick?.(tool)}
            />
          ))}
        </div>
      </div>

      {/* Indicator dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {news.map((_, i) => (
          <button
            key={i}
            onClick={() => setNewsIdx(i)}
            className="rounded-sm border-none cursor-pointer transition-all p-0"
            style={{
              width: i === newsIdx ? 22 : 7,
              height: 7,
              background: i === newsIdx ? accent : "var(--color-border)",
            }}
          />
        ))}
      </div>
    </section>
  );
}

function FeaturedToolCard({
  tool,
  accent,
  onClick,
}: {
  tool: Tool;
  accent: string;
  onClick: () => void;
}) {
  const [hov, setHov] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="flex-1 bg-surface border rounded-lg px-5 py-4.5 text-left cursor-pointer flex items-center gap-3.5 transition-all hover:shadow-md"
      style={{
        border: `1px solid ${hov ? accent + "50" : "var(--color-border)"}`,
        boxShadow: hov ? `0 4px 14px ${accent}10` : "none",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          background: `${accent}10`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          flexShrink: 0,
        }}
      >
        {tool.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {tool.popular && (
          <span
            className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-1.5"
            style={{
              background: `${accent}15`,
              color: accent,
              letterSpacing: "0.04em",
            }}
          >
            Populaire
          </span>
        )}
        <div className="text-sm font-bold text-foreground leading-tight mb-1">
          {tool.title}
        </div>
        <div
          className="text-xs text-text-muted leading-relaxed line-clamp-2"
        >
          {tool.desc}
        </div>
      </div>
      <span style={{ fontSize: 13, color: accent, fontWeight: 600, flexShrink: 0 }}>
        Utiliser →
      </span>
    </button>
  );
}
