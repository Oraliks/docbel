export type AppEnvironment = "development" | "ci" | "staging" | "production";

const APP_ENVIRONMENTS = new Set<AppEnvironment>([
  "development",
  "ci",
  "staging",
  "production",
]);

export function getAppEnvironment(env: NodeJS.ProcessEnv = process.env): AppEnvironment | null {
  const configured = env.APP_ENV?.trim();
  if (!configured) return null;
  if (!APP_ENVIRONMENTS.has(configured as AppEnvironment)) {
    throw new Error("APP_ENV must be development, ci, staging, or production");
  }
  return configured as AppEnvironment;
}

export function isStagingEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return getAppEnvironment(env) === "staging";
}

function normalizedDatabaseHost(value: string, name: string): { host: string; database: string } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL`);
  }
  if (!(["postgres:", "postgresql:"].includes(url.protocol)) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error(`${name} must identify a PostgreSQL host and database`);
  }
  return {
    host: url.hostname.toLowerCase().replace(/-pooler(?=\.|$)/, ""),
    database: decodeURIComponent(url.pathname.slice(1)),
  };
}

export function assertStagingDatabaseTarget(env: NodeJS.ProcessEnv = process.env): void {
  if (getAppEnvironment(env) !== "staging") return;

  const databaseUrl = env.DATABASE_URL?.trim();
  const directUrl = env.DIRECT_URL?.trim();
  const expectedTarget = env.APP_DATABASE_TARGET?.trim().toLowerCase();
  const productionTarget = env.APP_PRODUCTION_DATABASE_TARGET?.trim().toLowerCase();
  if (!databaseUrl || !directUrl || !expectedTarget || !productionTarget) {
    throw new Error("Staging database target and both connection URLs must be configured");
  }

  const pooled = normalizedDatabaseHost(databaseUrl, "DATABASE_URL");
  const direct = normalizedDatabaseHost(directUrl, "DIRECT_URL");
  if (pooled.host !== direct.host || pooled.database !== direct.database) {
    throw new Error("DATABASE_URL and DIRECT_URL must target the same staging database");
  }
  if (pooled.host !== expectedTarget || expectedTarget === productionTarget) {
    throw new Error("Staging database target does not match its isolated target identity");
  }
}

export function assertStagingStorageTargets(env: NodeJS.ProcessEnv = process.env): void {
  if (getAppEnvironment(env) !== "staging") return;
  const publicTarget = env.APP_PUBLIC_BLOB_STORE_ID?.trim();
  const privateTarget = env.APP_PRIVATE_BLOB_STORE_ID?.trim();
  const productionPublicTarget = env.APP_PRODUCTION_PUBLIC_BLOB_STORE_ID?.trim();
  const productionPrivateTarget = env.APP_PRODUCTION_PRIVATE_BLOB_STORE_ID?.trim();
  if (!publicTarget || !privateTarget || !productionPublicTarget || !productionPrivateTarget) {
    throw new Error("Staging and production Blob store identities must be configured");
  }
  if (
    new Set([publicTarget, privateTarget, productionPublicTarget, productionPrivateTarget]).size !== 4
  ) {
    throw new Error("Staging Blob stores must be distinct from each other and from production");
  }
}
