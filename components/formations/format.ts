/** Helpers d'affichage du module Formations (purs, isomorphes). */
import {
  FORMAT_LABELS,
  LEVEL_LABELS,
  CERTIFICATE_LABELS,
  type TrainingFormat,
  type TrainingLevel,
  type CertificateType,
} from "@/lib/formations/constants";

export function formatPrice(
  priceType: string,
  amount: number | null | undefined,
  currency = "EUR",
): string {
  if (priceType !== "paid") return "Gratuit";
  if (amount == null) return "Payant";
  const symbol = currency === "EUR" ? "€" : currency;
  const value = Number.isInteger(amount) ? `${amount}` : amount.toFixed(2);
  return `${value} ${symbol}`;
}

export function formatLabel(format: string): string {
  return FORMAT_LABELS[format as TrainingFormat] ?? format;
}

export function levelLabel(level: string): string {
  return LEVEL_LABELS[level as TrainingLevel] ?? level;
}

export function certificateLabel(type: string): string {
  return CERTIFICATE_LABELS[type as CertificateType] ?? type;
}

export function durationText(hours: number | null, label: string | null): string | null {
  if (label) return label;
  if (hours == null) return null;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (Number.isInteger(hours)) return `${hours} h`;
  return `${hours.toFixed(1)} h`;
}

const DATE_FMT = new Intl.DateTimeFormat("fr-BE", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const DATETIME_FMT = new Intl.DateTimeFormat("fr-BE", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string | Date | null): string | null {
  if (!iso) return null;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;
  return DATE_FMT.format(d);
}

export function formatDateTime(iso: string | Date | null): string | null {
  if (!iso) return null;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;
  return DATETIME_FMT.format(d);
}

export type ChipTone = "green" | "violet" | "blue" | "amber" | "neutral";

export interface DerivedChip {
  label: string;
  tone: ChipTone;
}

/** Pastilles dérivées des attributs d'une formation (carte catalogue). */
export function deriveChips(t: {
  priceType: string;
  priceAmount: number | null;
  currency: string;
  format: string;
  level: string;
  certificateType: string;
  isVerifiedByDocbel?: boolean;
  isDocbelRecommended?: boolean;
}): DerivedChip[] {
  const chips: DerivedChip[] = [];
  chips.push({
    label: formatPrice(t.priceType, t.priceAmount, t.currency),
    tone: t.priceType === "free" ? "green" : "violet",
  });
  chips.push({ label: formatLabel(t.format), tone: "blue" });
  if (t.certificateType && t.certificateType !== "none")
    chips.push({ label: "Attestation", tone: "amber" });
  return chips;
}
