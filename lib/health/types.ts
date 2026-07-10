/// Types partagés du système de santé (module serveur `lib/health`).

export type HealthStatus = "ok" | "degraded" | "down";

export interface DbHealth {
  status: "up" | "down";
  /** Latence du ping SELECT 1 en ms. null si l'échec est survenu avant la mesure. */
  latencyMs: number | null;
  /** Message d'erreur court si status === "down". */
  error?: string;
}

export type DependencyKind = "critical" | "optional";

/**
 * État d'une dépendance NON pingée en direct : on rapporte sa PRÉSENCE DE
 * CONFIGURATION (clé d'env / helper de détection), pas sa liveness. Le seul
 * vrai I/O réseau du health check est le ping DB (cf. DbHealth).
 */
export interface DependencyHealth {
  key: string;
  label: string;
  kind: DependencyKind;
  configured: boolean;
  detail: string;
}

export interface RuntimeInfo {
  env: string;
  vercelEnv: string | null;
  region: string | null;
  buildId: string | null;
  nodeVersion: string;
}

export interface HealthReport {
  status: HealthStatus;
  db: DbHealth;
  dependencies: DependencyHealth[];
  runtime: RuntimeInfo;
  /** ISO 8601. */
  checkedAt: string;
}

/** Charge utile publique minimale de /api/health (pas de détail sensible). */
export interface HealthSummary {
  status: HealthStatus;
  db: DbHealth;
  checkedAt: string;
}
