/// Exécution serveur des checks de santé. UN SEUL I/O réseau : le ping DB.
/// Tout le reste = présence de configuration (variables d'environnement),
/// synchrone et instantané. On NE martèle PAS les API externes et on n'importe
/// AUCUN module lourd (imapflow/@vercel/blob/adm-zip) juste pour lire un flag :
/// on lit directement les mêmes variables d'env que les helpers métier.

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { classifyOverall } from "./classify";
import type {
  DbHealth,
  DependencyHealth,
  HealthReport,
  HealthSummary,
  RuntimeInfo,
} from "./types";

/** Ping DB avec timeout dédié — on veut MESURER l'échec, pas le masquer par retry. */
export const pingDatabase = cache(async (timeoutMs = 3000): Promise<DbHealth> => {
  const start = Date.now();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`timeout ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
    return { status: "up", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "down",
      latencyMs: null,
      error: err instanceof Error ? err.message : "erreur inconnue",
    };
  }
});

function present(v: string | undefined | null): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Présence de configuration des dépendances, par lecture directe des variables
 * d'environnement (mêmes clés que les helpers métier : lib/inbox/imap,
 * lib/storage/blob-storage, lib/be-companies/kbo-etl, lib/chomage-ia/*).
 * Synchrone : aucune I/O, aucun import lourd, ne peut pas faire échouer le rapport.
 */
export function collectDependencies(): DependencyHealth[] {
  const env = process.env;
  const deps: DependencyHealth[] = [];

  const dep = (
    key: string,
    label: string,
    configured: boolean,
    okDetail: string,
    koDetail: string,
  ): void => {
    deps.push({ key, label, kind: "optional", configured, detail: configured ? okDetail : koDetail });
  };

  dep(
    "email",
    "Email (Resend)",
    present(env.RESEND_API_KEY),
    "Clé API présente",
    "RESEND_API_KEY absente",
  );

  const imapOk =
    present(env.CONTACT_IMAP_HOST) &&
    present(env.CONTACT_IMAP_PORT) &&
    present(env.CONTACT_IMAP_USER) &&
    present(env.CONTACT_IMAP_PASSWORD);
  dep("imap", "IMAP (réception inbox)", imapOk, "Config OVH complète", "CONTACT_IMAP_* incomplète");

  dep(
    "anthropic",
    "IA Claude (Anthropic)",
    present(env.ANTHROPIC_API_KEY),
    "Clé API présente",
    "ANTHROPIC_API_KEY absente",
  );

  const embProvider = present(env.VOYAGE_API_KEY)
    ? "voyage"
    : present(env.OPENAI_API_KEY)
      ? "openai"
      : null;
  dep(
    "embeddings",
    "Embeddings RAG",
    embProvider !== null,
    `Provider : ${embProvider}`,
    "Aucun provider (Voyage/OpenAI)",
  );

  dep(
    "web-search",
    "Recherche web (Brave)",
    present(env.BRAVE_SEARCH_API_KEY),
    "Clé API présente",
    "BRAVE_SEARCH_API_KEY absente",
  );

  dep(
    "blob",
    "Stockage fichiers (Vercel Blob)",
    present(env.BLOB_READ_WRITE_TOKEN),
    "Token présent",
    "Repli disque local",
  );

  const kboOk = present(env.KBO_OPEN_DATA_USER) && present(env.KBO_OPEN_DATA_PASSWORD);
  dep("kbo", "KBO / BCE (entreprises)", kboOk, "Identifiants présents", "KBO_OPEN_DATA_* absents");

  dep(
    "stripe",
    "Paiement (Stripe)",
    present(env.STRIPE_SECRET_KEY),
    "Clé secrète présente",
    "STRIPE_SECRET_KEY absente",
  );

  return deps;
}

export function collectRuntime(): RuntimeInfo {
  return {
    env: process.env.NODE_ENV ?? "unknown",
    vercelEnv: process.env.VERCEL_ENV ?? null,
    region: process.env.VERCEL_REGION ?? null,
    buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? null,
    nodeVersion: process.version,
  };
}

export const getHealthReport = cache(async (): Promise<HealthReport> => {
  const db = await pingDatabase();
  return {
    status: classifyOverall(db),
    db,
    dependencies: collectDependencies(),
    runtime: collectRuntime(),
    checkedAt: new Date().toISOString(),
  };
});

export const getHealthSummary = cache(async (): Promise<HealthSummary> => {
  const db = await pingDatabase();
  return { status: classifyOverall(db), db, checkedAt: new Date().toISOString() };
});

// ── Historique persistant (Part D) ──────────────────────────────────────────
// Écrit par le cron /api/cron/health-snapshot ; lu par la page /admin/monitoring.

/** Enregistre un instantané de santé. Best-effort : n'échoue jamais bruyamment. */
export async function recordSnapshot(): Promise<void> {
  const summary = await getHealthSummary();
  try {
    await prisma.apiHealthSnapshot.create({
      data: {
        status: summary.status,
        dbUp: summary.db.status === "up",
        dbLatencyMs: summary.db.latencyMs,
      },
    });
  } catch (err) {
    console.error("[health] recordSnapshot failed:", err);
  }
}

export interface SnapshotPoint {
  status: string;
  dbLatencyMs: number | null;
  createdAt: Date;
}

/** Les `limit` derniers instantanés, du plus ancien au plus récent (pour tracer). */
export const getRecentSnapshots = cache(async (limit = 96): Promise<SnapshotPoint[]> => {
  const rows = await prisma.apiHealthSnapshot.findMany({
    select: { status: true, dbLatencyMs: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.reverse();
});
