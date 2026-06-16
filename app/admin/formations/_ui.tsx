"use client";

import { Badge } from "@/components/ui/badge";
import {
  TRAINING_STATUS_LABELS,
  type TrainingStatus,
} from "@/lib/formations/constants";

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "info"
  | "warning"
  | "outline";

const STATUS_VARIANT: Record<TrainingStatus, BadgeVariant> = {
  draft: "secondary",
  pending_review: "warning",
  changes_requested: "warning",
  approved: "info",
  published: "success",
  suspended: "destructive",
  rejected: "destructive",
  archived: "outline",
};

/** Badge de statut formation — couleur dérivée du statut, libellé FR. */
export function StatusBadge({ status }: { status: string }) {
  const known = status as TrainingStatus;
  const variant = STATUS_VARIANT[known] ?? "outline";
  const label = TRAINING_STATUS_LABELS[known] ?? status;
  return (
    <Badge variant={variant} className="text-[11px]">
      {label}
    </Badge>
  );
}

/** Format date court FR-BE (sérialisé en ISO côté serveur). */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/** Format prix. Renvoie "Gratuite" si null/0. */
export function formatPrice(
  amount: number | null,
  currency: string = "EUR",
): string {
  if (amount == null || amount === 0) return "Gratuite";
  try {
    return new Intl.NumberFormat("fr-BE", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
