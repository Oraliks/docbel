// Shared Tailwind class strings for the glass design language.
//
// Why these live here rather than in the components: every page that needs a
// glass-styled shadcn Card or input copied the exact same className string,
// which means a single visual tweak (e.g. `rounded-2xl` → `rounded-xl`) would
// have to be applied in 5+ places. Centralising the strings here makes "what
// does a glass field look like" a one-line answer and a one-edit change.
//
// Usage:
//   <Card className={GLASS_CARD}>...
//   <Input className={GLASS_INPUT} ... />
//   <Label className={GLASS_LABEL}>Nom</Label>
//   <button className={GLASS_PRIMARY_BUTTON}>Enregistrer</button>

/**
 * Strips the default shadcn Card chrome (bg, border, shadow) so the
 * `.glass-surface` class declared in globals.css can paint without conflict.
 * Add `glass-surface` first, then this string — order doesn't matter because
 * we use `!` important on the cancellations.
 */
export const GLASS_CARD =
  "glass-surface !border-0 !bg-transparent !shadow-none";

/**
 * Repeated clickable-card composition. Keeps the shadcn chrome reset from
 * `GLASS_CARD` and opts into the shared hover, press, focus and disabled
 * behavior from `.glass-interactive`.
 */
export const GLASS_INTERACTIVE_CARD = `${GLASS_CARD} glass-interactive`;

/**
 * Input / Select trigger / Textarea field surface. Uses glass tokens for
 * border + background and keeps text/placeholder colours readable in both
 * light and dark mode.
 */
export const GLASS_INPUT =
  "rounded-2xl border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)]";

/**
 * Small uppercase eyebrow used on form labels and section sub-titles. Pair
 * with a real `<Label htmlFor=...>` for accessibility.
 */
export const GLASS_LABEL =
  "text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]";

/**
 * Inline styles for the primary CTA pill (dark "ink" surface + light "bg-a"
 * text). The bg/color tokens flip in dark mode, so we expose them as a style
 * object rather than a className.
 */
export const GLASS_PRIMARY_STYLE = {
  background: "var(--glass-ink)",
  color: "var(--glass-bg-a)",
} as const;

/**
 * Inline style for the small, accent-tinted highlight pill (the "Populaire",
 * "À la une", etc. badges that sit on top of glass surfaces).
 */
export const GLASS_POP_STYLE = {
  background: "var(--glass-pop-bg)",
  color: "var(--glass-pop-fg)",
} as const;
