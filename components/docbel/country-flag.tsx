"use client";

import { cn } from "@/lib/utils";

interface CountryFlagProps {
  code: string | null | undefined;
  country?: string;
  className?: string;
  /** Width in pixels. Height is computed at a 4:3 ratio. */
  size?: number;
}

/**
 * Renders a country flag as an SVG image from flagcdn.com (a free, no-auth CDN).
 * Falls back to a neutral placeholder when the ISO code is missing.
 *
 * Why an external CDN? Emoji flags rely on the OS shipping an emoji font that
 * supports regional indicators — Windows does not, so emoji flags render as
 * the raw 2-letter code (e.g. "EE" instead of 🇪🇪). SVGs work everywhere.
 */
export function CountryFlag({
  code,
  country,
  className,
  size = 20,
}: CountryFlagProps) {
  const width = size;
  const height = Math.round(size * 0.75);

  if (!code || code.length !== 2) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-block rounded-[2px] bg-muted ring-1 ring-border/40",
          className
        )}
        style={{ width, height }}
      />
    );
  }

  const lower = code.toLowerCase();
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`https://flagcdn.com/${lower}.svg`}
      alt={country ? `Drapeau ${country}` : ""}
      width={width}
      height={height}
      loading="lazy"
      className={cn(
        "inline-block rounded-[2px] object-cover ring-1 ring-border/40",
        className
      )}
      style={{ width, height }}
    />
  );
}
