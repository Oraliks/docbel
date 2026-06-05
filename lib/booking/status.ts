// Libellés FR partagés (UI équipe + page de gestion citoyen).

import type { BookingStatus } from "@prisma/client";

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_approval: "En attente de validation",
  confirmed: "Confirmé",
  rejected: "Refusé",
  cancelled_citizen: "Annulé par le citoyen",
  cancelled_partner: "Annulé par l'équipe",
  no_show: "Absent",
  completed: "Honoré",
};

// Couleur de badge (classes Tailwind), pour l'agenda équipe.
export const STATUS_BADGE: Record<BookingStatus, string> = {
  pending_approval: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  cancelled_citizen: "bg-gray-100 text-gray-700",
  cancelled_partner: "bg-gray-100 text-gray-700",
  no_show: "bg-orange-100 text-orange-800",
  completed: "bg-violet-100 text-violet-800",
};

export const CATEGORY_LABELS: Record<string, string> = {
  unemployment: "Chômage",
  social_aid: "Aide sociale (CPAS)",
  municipal: "Démarche communale",
  private: "Entreprise",
  other: "Autre",
};
