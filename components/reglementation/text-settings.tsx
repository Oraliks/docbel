"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { AArrowDown, AArrowUp, Type } from "lucide-react";

type Density = "compact" | "confort" | "large";

const STORAGE_KEY = "regl-density";

/** Presets de lecture : taille de police, interligne, mesure (largeur de colonne). */
const PRESETS: Record<Density, { fs: string; lh: string; measure: string }> = {
  compact: { fs: "14px", lh: "1.55", measure: "62ch" },
  confort: { fs: "15px", lh: "1.7", measure: "72ch" },
  large: { fs: "17px", lh: "1.8", measure: "88ch" },
};

const OPTIONS: { key: Density; label: string; icon: typeof Type }[] = [
  { key: "compact", label: "Compact", icon: AArrowDown },
  { key: "confort", label: "Confort", icon: Type },
  { key: "large", label: "Large", icon: AArrowUp },
];

/**
 * Enveloppe le texte de loi et pose trois variables CSS (--legal-fs / --legal-lh
 * / --legal-measure) que `LegalText` consomme. Choix persisté en localStorage
 * (init paresseux → aucun setState dans un effet). La colonne peut ainsi profiter
 * de la pleine largeur ou rester dense selon la préférence du conseiller.
 */
export function TextSettings({ children }: { children: ReactNode }) {
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === "undefined") return "confort";
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "compact" || v === "large" ? v : "confort";
  });

  const choose = (d: Density) => {
    setDensity(d);
    try {
      window.localStorage.setItem(STORAGE_KEY, d);
    } catch {
      /* stockage indisponible (mode privé) : préférence non persistée */
    }
  };

  const preset = PRESETS[density];
  const vars = {
    "--legal-fs": preset.fs,
    "--legal-lh": preset.lh,
    "--legal-measure": preset.measure,
  } as CSSProperties;

  return (
    <div>
      <div className="mb-3 flex items-center gap-1 print:hidden" suppressHydrationWarning>
        <span className="mr-1 text-xs text-muted-foreground">Lecture</span>
        <div className="inline-flex overflow-hidden rounded-lg border">
          {OPTIONS.map((opt, i) => {
            const Icon = opt.icon;
            const active = density === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => choose(opt.key)}
                aria-pressed={active}
                title={opt.label}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors ${
                  i > 0 ? "border-l" : ""
                } ${
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div style={vars} suppressHydrationWarning>
        {children}
      </div>
    </div>
  );
}
