/// Classification PURE de l'état global à partir de la santé DB. Aucun I/O.
/// Testé en vitest. La DB est la seule dépendance CRITIQUE : elle seule fait
/// basculer l'état global. Les dépendances optionnelles sont informatives.

import type { DbHealth, HealthStatus } from "./types";

/** Au-delà de cette latence DB (ms), on considère le service "dégradé". */
export const SLOW_DB_MS = 2000;

export function classifyOverall(db: DbHealth, slowMs: number = SLOW_DB_MS): HealthStatus {
  if (db.status === "down") return "down";
  if (db.latencyMs !== null && db.latencyMs > slowMs) return "degraded";
  return "ok";
}
