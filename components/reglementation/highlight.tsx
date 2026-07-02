import type { ReactNode } from "react";

/** Reconstruit les <mark> de ts_headline en JSX sûr (texte pur ailleurs). */
export function renderHeadline(headline: string): ReactNode {
  const parts = headline.split(/<\/?mark>/);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-sm bg-primary/15 px-0.5 font-medium text-primary">{part}</mark>
    ) : (<span key={i}>{part}</span>),
  );
}
