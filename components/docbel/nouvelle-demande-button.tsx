"use client";

interface Props {
  bundleId: string;
  slug: string;
  variant?: "default" | "outline" | "ghost";
}

/** V1 compatibility for existing call sites: creating persisted runs is closed. */
export function NouvelleDemandeButton(props: Props) {
  void props;
  return null;
}
