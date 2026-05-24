import type { Reliability } from "@/lib/calculators/_methodology";

/**
 * Valeur du filtre de fiabilité dans la page overview admin.
 * "all" = pas de filtre, sinon une des 3 valeurs de Reliability.
 */
export type ReliabilityFilter = "all" | Reliability;
