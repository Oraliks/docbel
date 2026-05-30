// Valeurs « système » isomorphes (client + serveur) pour les champs
// auto-remplis et composites. Aucune dépendance Node — utilisable dans le
// runner React comme dans les routes API.

import type { FieldValue, NameOrder } from "./types";
import { isFullNameValue } from "./types";

/// Date du jour au format ISO (AAAA-MM-JJ), fuseau Europe/Bruxelles.
/// Utilisée pour les champs `date` avec prefill `system.today` : c'est la
/// date à laquelle le document est généré. Le serveur la réinjecte de manière
/// autoritaire au moment de la génération (cf. route /generate).
export function todayISO(): string {
  // en-CA produit directement AAAA-MM-JJ.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/// Assemble une valeur composite `fullname` en une seule chaîne, selon l'ordre
/// configuré. Tolère une valeur déjà sous forme de chaîne (round-trip / legacy).
export function assembleFullName(value: FieldValue, order: NameOrder = "first-last"): string {
  if (typeof value === "string") return value.trim();
  if (!isFullNameValue(value)) return "";
  const first = (value.first ?? "").trim();
  const last = (value.last ?? "").trim();
  const parts = order === "last-first" ? [last, first] : [first, last];
  return parts.filter(Boolean).join(" ");
}
