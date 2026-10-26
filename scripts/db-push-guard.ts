import { spawnSync } from "node:child_process";

const ALLOWED_DATABASE = "lookup_hardening_test";
const ALLOWED_HOST = "127.0.0.1";
const ALLOWED_PORT = "55434";
const ALLOWED_USER = "docbel_test";

export function assertDisposableDbPushTarget(env: NodeJS.ProcessEnv): string {
  if (env.APP_ENV === "staging" || env.APP_ENV === "production" || env.VERCEL === "1") {
    throw new Error("The guarded database command is unavailable in staging, production, or Vercel.");
  }
  if (env.DOCBEL_DB_PUSH_CONFIRM !== ALLOWED_DATABASE) {
    throw new Error(`Set DOCBEL_DB_PUSH_CONFIRM=${ALLOWED_DATABASE} for the local disposable database.`);
  }

  const targets = [env.DATABASE_URL, env.DIRECT_URL];
  if (targets.some((value) => !value)) {
    throw new Error("DATABASE_URL and DIRECT_URL are both required for the guarded local database command.");
  }

  const parsed = targets.map((value, index) => {
    let url: URL;
    try {
      url = new URL(value!);
    } catch {
      throw new Error("DATABASE_URL and DIRECT_URL must be valid PostgreSQL URLs.");
    }
    if (url.protocol !== "postgresql:") {
      throw new Error("The guarded database command only permits the PostgreSQL protocol.");
    }
    if (url.hostname !== ALLOWED_HOST || url.port !== ALLOWED_PORT) {
      throw new Error("The guarded command only permits the known local test host and port.");
    }
    if (url.username !== ALLOWED_USER) {
      throw new Error("The guarded command only permits the known local test role.");
    }
    const database = decodeURIComponent(url.pathname.slice(1));
    if (!database) throw new Error("The database URL must name a database.");
    if (url.hash || [...url.searchParams.keys()].some((key) => key !== "schema") ||
      url.searchParams.getAll("schema").some((schema) => schema !== "public") ||
      url.searchParams.getAll("schema").length > 1) {
      throw new Error("Only the Prisma schema=public URL option is permitted.");
    }
    return { host: url.hostname, port: url.port, user: url.username, database, label: index === 0 ? "DATABASE_URL" : "DIRECT_URL" };
  });

  if (parsed.some(({ database }) => database !== ALLOWED_DATABASE)) {
    throw new Error(`The guarded command only permits the ${ALLOWED_DATABASE} database.`);
  }
  if (parsed[0].host !== parsed[1].host || parsed[0].port !== parsed[1].port ||
    parsed[0].user !== parsed[1].user || parsed[0].database !== parsed[1].database) {
    throw new Error("DATABASE_URL and DIRECT_URL must identify the same local host, port, role, and database.");
  }
  return ALLOWED_DATABASE;
}

function runPnpm(args: string[]): number {
  const result = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error("Could not start the guarded database command.");
    return 1;
  }
  return result.status ?? 1;
}

function main(args: string[]): number {
  try {
    assertDisposableDbPushTarget(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unsafe database target.");
    return 1;
  }

  const [operation, ...extraArgs] = args;
  if (extraArgs.length > 0) {
    console.error("Additional Prisma flags are not accepted by the guarded database command.");
    return 1;
  }

  if (operation === "push") return runPnpm(["exec", "prisma", "db", "push"]);
  if (operation === "setup") {
    const pushStatus = runPnpm(["exec", "prisma", "db", "push"]);
    if (pushStatus !== 0) return pushStatus;
    const seedStatus = runPnpm(["seed"]);
    if (seedStatus !== 0) return seedStatus;
    return runPnpm(["exec", "tsx", "scripts/setup-local-auth.ts"]);
  }

  console.error("Usage: db-push-guard.ts <push|setup>");
  return 2;
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/db-push-guard.ts")) {
  process.exitCode = main(process.argv.slice(2));
}
