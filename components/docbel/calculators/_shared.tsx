"use client";

/**
 * Building blocks partagés par tous les calculateurs sous /outils/calc-*.
 *
 * Pourquoi ce fichier : sans lui, chaque calc dupliquait les inputs glassy,
 * la carte de résultat, l'alerte "indicatif", etc. (cf. CalcCP dans
 * tool-views.tsx). Avec ces primitives, ajouter un calc = écrire la logique
 * pure + un composant qui assemble les blocs.
 *
 * Convention : tous les composants reçoivent un `accent` (couleur thème de
 * l'outil, vient de ToolPage). Ils restent stylés via les tokens .glass-* +
 * shadcn quand c'est pertinent (Input, Label) pour rester cohérent.
 */

import React from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/* ------------------------------------------------------------------ */
/*  Wrapper "intro + body"                                            */
/* ------------------------------------------------------------------ */

export function CalcLayout({
  intro,
  children,
}: {
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      {intro ? (
        <p className="text-[13px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          {intro}
        </p>
      ) : null}
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Grille de champs (responsive 1-2 col)                             */
/* ------------------------------------------------------------------ */

export function CalcGrid({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: 1 | 2 | 3;
}) {
  const map = {
    1: "grid grid-cols-1 gap-3",
    2: "grid grid-cols-1 gap-3 sm:grid-cols-2",
    3: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
  } as const;
  return <div className={map[cols]}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/*  Champ générique (Input shadcn)                                    */
/* ------------------------------------------------------------------ */

interface CalcFieldProps {
  id: string;
  label: string;
  hint?: string;
  type?: "number" | "text" | "date";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export function CalcField({
  id,
  label,
  hint,
  type = "number",
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  suffix,
}: CalcFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={id}
        className="text-[12px] font-semibold text-[color:var(--glass-ink)]"
      >
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className="h-11 rounded-xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 text-[14px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus-visible:border-[color:var(--glass-accent-deep)] focus-visible:ring-0"
          style={suffix ? { paddingRight: 44 } : undefined}
        />
        {suffix ? (
          <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[12px] font-semibold text-[color:var(--glass-ink-faint)]">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Select stylisé (utilise un <select> natif pour rester léger)      */
/* ------------------------------------------------------------------ */

interface CalcSelectProps<T extends string> {
  id: string;
  label: string;
  hint?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}

export function CalcSelect<T extends string>({
  id,
  label,
  hint,
  value,
  onChange,
  options,
}: CalcSelectProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={id}
        className="text-[12px] font-semibold text-[color:var(--glass-ink)]"
      >
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-11 w-full rounded-xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 text-[14px] text-[color:var(--glass-ink)] outline-none focus:border-[color:var(--glass-accent-deep)]"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Radio en pills (choix qualitatif court)                           */
/* ------------------------------------------------------------------ */

interface CalcRadioProps<T extends string> {
  label: string;
  hint?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  accent: string;
}

export function CalcRadio<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
  accent,
}: CalcRadioProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-[color:var(--glass-ink)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className="rounded-full border-[1.5px] px-3.5 py-1.5 text-[12.5px] font-semibold transition"
              style={{
                background: active ? accent : "var(--glass-surface)",
                color: active ? "white" : "var(--glass-ink-soft)",
                borderColor: active ? accent : "var(--glass-border)",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint ? (
        <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bouton primaire "Calculer"                                        */
/* ------------------------------------------------------------------ */

export function CalcSubmitButton({
  accent,
  children,
  onClick,
  disabled,
}: {
  accent: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-1 h-11 w-full rounded-xl text-[14px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: accent,
        fontFamily: "'Manrope', sans-serif",
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Carte de résultat (montant principal + détails)                   */
/* ------------------------------------------------------------------ */

interface CalcResultRow {
  label: string;
  value: string;
  emphasis?: boolean;
}

export function CalcResult({
  accent,
  eyebrow,
  headline,
  unit,
  subtext,
  rows,
  footer,
}: {
  accent: string;
  eyebrow?: string;
  headline: string;
  unit?: string;
  subtext?: React.ReactNode;
  rows?: CalcResultRow[];
  footer?: React.ReactNode;
}) {
  const t = useTranslations("public.outils");
  const eyebrowLabel = eyebrow ?? t("sharedResultEyebrow");
  return (
    <div
      className="mt-2 rounded-2xl p-5 sm:p-6"
      style={{
        background: `${accent}10`,
        border: `1.5px solid ${accent}30`,
      }}
    >
      <div
        className="text-[11px] font-bold uppercase tracking-[0.06em]"
        style={{ color: accent }}
      >
        {eyebrowLabel}
      </div>
      <div
        className="mt-1.5 font-extrabold tracking-[-0.5px] text-[color:var(--glass-ink)]"
        style={{ fontSize: 30, lineHeight: 1.1 }}
      >
        {headline}
        {unit ? (
          <span
            className="ml-1.5 align-baseline"
            style={{ fontSize: 15, fontWeight: 600 }}
          >
            {unit}
          </span>
        ) : null}
      </div>
      {subtext ? (
        <div className="mt-1.5 text-[12.5px] text-[color:var(--glass-ink-soft)]">
          {subtext}
        </div>
      ) : null}

      {rows && rows.length > 0 ? (
        <div className="mt-4 flex flex-col gap-1.5 rounded-xl bg-[color:var(--glass-surface)] p-3.5">
          {rows.map((r, i) => (
            <div
              key={i}
              className="flex items-baseline justify-between gap-3 text-[12.5px]"
            >
              <span className="text-[color:var(--glass-ink-soft)]">
                {r.label}
              </span>
              <span
                className={
                  r.emphasis
                    ? "font-bold text-[color:var(--glass-ink)]"
                    : "font-semibold text-[color:var(--glass-ink)]"
                }
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {footer ? (
        <div className="mt-3.5 rounded-xl bg-[color:var(--glass-surface)] p-3.5 text-[11.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bandeau d'erreur (input invalide)                                 */
/* ------------------------------------------------------------------ */

export function CalcError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border-[1.5px] border-amber-300/40 bg-amber-50/50 p-3 text-[12px] text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Info note (encadré pédagogique au-dessus / sous le formulaire)    */
/* ------------------------------------------------------------------ */

export function CalcInfo({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3 text-[12px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
      <Info className="mt-0.5 size-4 shrink-0 text-[color:var(--glass-ink-faint)]" />
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Badge "pill" (utilisé pour BE / ATN 2026 / Données 2026, etc.)    */
/* ------------------------------------------------------------------ */

export function CalcBadge({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border-[1.5px] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em]"
      style={{
        background: accent ? `${accent}15` : "var(--glass-surface)",
        borderColor: accent ? `${accent}40` : "var(--glass-border)",
        color: accent ?? "var(--glass-ink-soft)",
      }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Carte glass arrondie (form ou résultat)                           */
/* ------------------------------------------------------------------ */

export function CalcCard({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-5 sm:p-6 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle pill segmenté Non/Oui (boolean visuel)                     */
/* ------------------------------------------------------------------ */

export function YesNoToggle({
  label,
  hint,
  value,
  onChange,
  accent,
  yesLabel,
  noLabel,
}: {
  label: string;
  hint?: string;
  value: "oui" | "non";
  onChange: (v: "oui" | "non") => void;
  accent: string;
  yesLabel?: string;
  noLabel?: string;
}) {
  const t = useTranslations("public.outils");
  const yesText = yesLabel ?? t("sharedYes");
  const noText = noLabel ?? t("sharedNo");
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-[color:var(--glass-ink)]">
        {label}
      </span>
      <div
        className="inline-flex rounded-full border-[1.5px] p-0.5"
        style={{ borderColor: "var(--glass-border)", background: "var(--glass-surface)" }}
      >
        {(["non", "oui"] as const).map((v) => {
          const active = v === value;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className="rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition"
              style={{
                background: active ? accent : "transparent",
                color: active ? "white" : "var(--glass-ink-soft)",
              }}
            >
              {v === "oui" ? yesText : noText}
            </button>
          );
        })}
      </div>
      {hint ? (
        <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ligne de détail dans un panneau résultat (avec sens +/− optionnel)*/
/* ------------------------------------------------------------------ */

export function ResultRow({
  label,
  value,
  direction = "neutral",
  emphasis = false,
}: {
  label: string;
  value: string;
  direction?: "plus" | "minus" | "neutral";
  emphasis?: boolean;
}) {
  const sign =
    direction === "minus" ? "−" : direction === "plus" ? "+" : null;
  const signColor =
    direction === "minus"
      ? "var(--glass-ink-faint)"
      : direction === "plus"
        ? "#22a06b"
        : "var(--glass-ink-faint)";
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${emphasis ? "border-t pt-2 mt-1" : ""}`}
      style={emphasis ? { borderTopColor: "var(--glass-ink-line)" } : undefined}
    >
      <span
        className={`text-[12.5px] ${emphasis ? "font-bold text-[color:var(--glass-ink)]" : "text-[color:var(--glass-ink-soft)]"}`}
      >
        {label}
      </span>
      <span
        className={`flex items-baseline gap-1 ${
          emphasis ? "text-[16px] font-extrabold" : "text-[13px] font-semibold"
        }`}
        style={{ color: "var(--glass-ink)" }}
      >
        {sign ? (
          <span className="text-[12px] font-bold" style={{ color: signColor }}>
            {sign}
          </span>
        ) : null}
        <span>{value}</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers de format (€, %)                                          */
/* ------------------------------------------------------------------ */

export const fmtEUR = (n: number, fractionDigits = 2) =>
  new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);

export const fmtNumber = (n: number, fractionDigits = 0) =>
  new Intl.NumberFormat("fr-BE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);

export const fmtPct = (n: number, fractionDigits = 1) =>
  `${fmtNumber(n, fractionDigits)} %`;

/** Tolère "1234,56" et "1 234,56" en plus de "1234.56". */
export function parseNum(s: string): number {
  if (!s) return NaN;
  const cleaned = s.replace(/\s/g, "").replace(",", ".");
  return parseFloat(cleaned);
}
