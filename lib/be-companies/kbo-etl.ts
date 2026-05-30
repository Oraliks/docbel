/// Pipeline d'ingestion des CSV KBO Open Data dans Postgres.
///
/// **Stratégie** :
/// - Téléchargement du ZIP depuis kbopub.economie.fgov.be (basic auth via
///   `KBO_OPEN_DATA_USER` / `KBO_OPEN_DATA_PASSWORD`).
/// - Extraction en mémoire (adm-zip) puis parsing streaming des CSV.
/// - TRUNCATE puis bulk-insert par lots dans une transaction.
/// - Log dans `KboEtlRun` (statut, durée, métriques).
///
/// **Limites Vercel** : un ingest complet (~2M entreprises + 4M dénominations
/// + 3M adresses) dépasse les 300s d'une fonction Pro. La cron de production
/// devrait pointer vers un fichier "delta" (publié quotidiennement par la
/// FPS) ou être déclenchée depuis une GitHub Action pour la première
/// hydratation. La librairie ci-dessous est résumable au niveau du lot.

import AdmZip from "adm-zip";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import {
  streamKboCsv,
  rowToEnterprise,
  rowToDenomination,
  rowToAddress,
  rowToActivity,
} from "./kbo-csv-parser";

const KBO_DOWNLOAD_URL =
  process.env.KBO_OPEN_DATA_URL ||
  "https://kbopub.economie.fgov.be/kbo-open-data/files/KboOpenData_latest.zip";

const BATCH_SIZE = 2_000;

export interface EtlResult {
  ok: boolean;
  enterprisesUpserted: number;
  denominationsUpserted: number;
  addressesUpserted: number;
  activitiesUpserted: number;
  durationMs: number;
  fileName?: string;
  error?: string;
}

export function isKboConfigured(): boolean {
  return !!(process.env.KBO_OPEN_DATA_USER && process.env.KBO_OPEN_DATA_PASSWORD);
}

/// Télécharge le ZIP KBO complet et renvoie son buffer.
/// Lève si les credentials sont absents.
export async function downloadKboZip(): Promise<Buffer> {
  const user = process.env.KBO_OPEN_DATA_USER;
  const pwd = process.env.KBO_OPEN_DATA_PASSWORD;
  if (!user || !pwd) throw new Error("Credentials KBO absents (KBO_OPEN_DATA_USER/PASSWORD)");
  const auth = Buffer.from(`${user}:${pwd}`).toString("base64");
  const res = await fetch(KBO_DOWNLOAD_URL, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Téléchargement KBO échoué (HTTP ${res.status})`);
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

interface RunOptions {
  /// Si fourni, court-circuite le téléchargement (utile en tests / dev local).
  zipBuffer?: Buffer;
  /// Limite le nombre d'entreprises traitées (debug / smoke-test).
  maxEnterprises?: number;
}

/// Lance une ingestion complète. Crée un `KboEtlRun` pour traçabilité.
export async function runKboEtl(opts: RunOptions = {}): Promise<EtlResult> {
  const startedAt = Date.now();
  const run = await prisma.kboEtlRun.create({
    data: { status: "running" },
  });

  const counts = { enterprises: 0, denominations: 0, addresses: 0, activities: 0 };
  let fileName: string | undefined;

  try {
    const buffer = opts.zipBuffer ?? (await downloadKboZip());
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    fileName = entries.find((e) => /enterprise\.csv$/i.test(e.entryName))?.entryName ?? "kbo.zip";

    // TRUNCATE en transaction unique pour éviter un état partiel exposé en
    // lecture pendant l'ingest. Cascade nettoie les tables filles.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "KboEnterprise", "KboDenomination", "KboAddress", "KboActivity" CASCADE'
    );

    const findEntry = (re: RegExp) => entries.find((e) => re.test(e.entryName));

    const enterpriseEntry = findEntry(/^enterprise\.csv$/i);
    const denominationEntry = findEntry(/^denomination\.csv$/i);
    const addressEntry = findEntry(/^address\.csv$/i);
    const activityEntry = findEntry(/^activity\.csv$/i);
    if (!enterpriseEntry) throw new Error("enterprise.csv absent du ZIP");

    counts.enterprises = await ingestEnterprises(enterpriseEntry.getData(), opts.maxEnterprises);
    if (denominationEntry) counts.denominations = await ingestDenominations(denominationEntry.getData());
    if (addressEntry) counts.addresses = await ingestAddresses(addressEntry.getData());
    if (activityEntry) counts.activities = await ingestActivities(activityEntry.getData());

    await prisma.kboEtlRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        fileName,
        enterprisesUpserted: counts.enterprises,
      },
    });

    return {
      ok: true,
      enterprisesUpserted: counts.enterprises,
      denominationsUpserted: counts.denominations,
      addressesUpserted: counts.addresses,
      activitiesUpserted: counts.activities,
      durationMs: Date.now() - startedAt,
      fileName,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    await prisma.kboEtlRun
      .update({
        where: { id: run.id },
        data: { status: "error", finishedAt: new Date(), errorMessage: message, fileName },
      })
      .catch(() => {});
    return {
      ok: false,
      enterprisesUpserted: counts.enterprises,
      denominationsUpserted: counts.denominations,
      addressesUpserted: counts.addresses,
      activitiesUpserted: counts.activities,
      durationMs: Date.now() - startedAt,
      fileName,
      error: message,
    };
  }
}

async function ingestEnterprises(buffer: Buffer, maxEnterprises?: number): Promise<number> {
  let total = 0;
  await streamKboCsv(Readable.from(buffer), {
    batchSize: BATCH_SIZE,
    onBatch: async (rows) => {
      const data = rows.map(rowToEnterprise).filter((r): r is NonNullable<typeof r> => r !== null);
      if (maxEnterprises && total + data.length > maxEnterprises) {
        data.splice(maxEnterprises - total);
      }
      if (!data.length) return;
      await prisma.kboEnterprise.createMany({ data, skipDuplicates: true });
      total += data.length;
    },
    filter: maxEnterprises ? () => total < maxEnterprises : undefined,
  });
  return total;
}

async function ingestDenominations(buffer: Buffer): Promise<number> {
  let total = 0;
  await streamKboCsv(Readable.from(buffer), {
    batchSize: BATCH_SIZE,
    onBatch: async (rows) => {
      const data = rows.map(rowToDenomination).filter((r): r is NonNullable<typeof r> => r !== null);
      if (!data.length) return;
      // Filtrer les références orphelines (sub-units sans entreprise correspondante).
      const valid = await filterByExistingEnterprise(data);
      if (!valid.length) return;
      await prisma.kboDenomination.createMany({ data: valid, skipDuplicates: true });
      total += valid.length;
    },
  });
  return total;
}

async function ingestAddresses(buffer: Buffer): Promise<number> {
  let total = 0;
  await streamKboCsv(Readable.from(buffer), {
    batchSize: BATCH_SIZE,
    onBatch: async (rows) => {
      const data = rows.map(rowToAddress).filter((r): r is NonNullable<typeof r> => r !== null);
      if (!data.length) return;
      const valid = await filterByExistingEnterprise(data);
      if (!valid.length) return;
      await prisma.kboAddress.createMany({ data: valid, skipDuplicates: true });
      total += valid.length;
    },
  });
  return total;
}

async function ingestActivities(buffer: Buffer): Promise<number> {
  let total = 0;
  await streamKboCsv(Readable.from(buffer), {
    batchSize: BATCH_SIZE,
    onBatch: async (rows) => {
      const data = rows.map(rowToActivity).filter((r): r is NonNullable<typeof r> => r !== null);
      if (!data.length) return;
      const valid = await filterByExistingEnterprise(data);
      if (!valid.length) return;
      await prisma.kboActivity.createMany({ data: valid, skipDuplicates: true });
      total += valid.length;
    },
  });
  return total;
}

/// Filtre un lot pour ne garder que les lignes dont `enterpriseNumber` existe
/// déjà dans `KboEnterprise`. Évite les violations de clé étrangère venant des
/// EntityNumber d'établissements (commencent par "2." dans la KBO).
async function filterByExistingEnterprise<T extends { enterpriseNumber: string }>(
  rows: T[]
): Promise<T[]> {
  const numbers = Array.from(new Set(rows.map((r) => r.enterpriseNumber)));
  const existing = await prisma.kboEnterprise.findMany({
    where: { enterpriseNumber: { in: numbers } },
    select: { enterpriseNumber: true },
  });
  const set = new Set(existing.map((e) => e.enterpriseNumber));
  return rows.filter((r) => set.has(r.enterpriseNumber));
}
