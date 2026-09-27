import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUploadDirectory, isLocalStoredPath, isPrivateStoredPath, resolveStoredFilePath } from "@/lib/file-storage";
import { deleteBlob, isBlobsPath, isPrivateBlobPath, moveBlob } from "./blob-storage";

export const MAX_PRIVACY_FILES = 500;
export const PRIVACY_CLEANUP_PREFIX = "storage-privacy-cleanup:";
type FileEntry = { id: string; type: string; filePath: string | null; isPrivate: boolean; updatedAt: Date };
type Cleanup = { source: string; destination: string; targetIsPrivate: boolean };

export class FilePrivacyError extends Error {
  constructor(public readonly code: string, public readonly status = 409) { super(code); }
}

export function needsPrivacyMove(file: Pick<FileEntry, "filePath" | "type">, isPrivate: boolean): boolean {
  if (file.type !== "file" || !file.filePath) return false;
  if (isBlobsPath(file.filePath)) return isPrivateBlobPath(file.filePath) !== isPrivate;
  if (isLocalStoredPath(file.filePath)) return isPrivateStoredPath(file.filePath) !== isPrivate;
  return isPrivate;
}

async function removeBytes(path: string) {
  if (isBlobsPath(path)) return deleteBlob(path);
  const absolute = resolveStoredFilePath(path);
  if (!absolute) throw new FilePrivacyError("UNSUPPORTED_STORAGE_PATH");
  try { await unlink(absolute); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function stageCopy(source: string, isPrivate: boolean): Promise<string> {
  if (isBlobsPath(source)) return moveBlob(source, isPrivate);
  const absolute = resolveStoredFilePath(source);
  if (!absolute) throw new FilePrivacyError("UNSUPPORTED_STORAGE_PATH");
  const directory = getUploadDirectory(isPrivate);
  await mkdir(directory.absoluteDir, { recursive: true });
  const name = `${randomUUID()}-${source.split("/").pop()}`;
  const destination = `${directory.relativeDir}/${name}`;
  const destinationAbsolute = join(directory.absoluteDir, name);
  await copyFile(absolute, destinationAbsolute);
  try {
    const [before, after] = await Promise.all([readFile(absolute), readFile(destinationAbsolute)]);
    if (!before.equals(after)) throw new FilePrivacyError("COPY_VERIFICATION_FAILED", 500);
  } catch (error) {
    await removeBytes(destination).catch(() => undefined);
    throw error;
  }
  return destination;
}

function cleanupKey(source: string) {
  return PRIVACY_CLEANUP_PREFIX + createHash("sha256").update(source).digest("hex");
}

/** Durable cleanup record is committed with the File references. Failed deletes
 * are never reported as a successful confidentiality change; a retry can resume. */
export async function finishPrivacyCleanup(key: string, cleanup: Cleanup): Promise<void> {
  const references = await prisma.file.count({ where: { filePath: cleanup.source } });
  if (references > 0) {
    if (cleanup.targetIsPrivate) throw new FilePrivacyError("SHARED_PUBLIC_SOURCE_REMAINS");
    // Publishing one private alias keeps the private source for other aliases.
  } else {
    await removeBytes(cleanup.source);
  }
  await prisma.appSetting.deleteMany({ where: { key } });
}

export async function retryPrivacyCleanup(limit = 100): Promise<{ completed: number; pending: number }> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { startsWith: PRIVACY_CLEANUP_PREFIX } },
    orderBy: { key: "asc" }, take: Math.min(Math.max(limit, 1), MAX_PRIVACY_FILES),
  });
  let completed = 0;
  for (const row of rows) {
    try { await finishPrivacyCleanup(row.key, JSON.parse(row.value) as Cleanup); completed++; }
    catch { /* Keep the journal row for a subsequent retry. */ }
  }
  return { completed, pending: rows.length - completed };
}

/** A private transition must include every alias of the public source. Otherwise
 * deleting it breaks public files, while keeping it falsely claims protection. */
export async function changeFilePrivacy(
  ids: string[], isPrivate: boolean,
  extra: { name?: string; parentId?: string | null } = {},
): Promise<{ updated: number; moved: number }> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length > MAX_PRIVACY_FILES) throw new FilePrivacyError("TOO_MANY_FILES", 413);
  const items: FileEntry[] = await prisma.file.findMany({
    where: { id: { in: uniqueIds } }, take: MAX_PRIVACY_FILES,
    select: { id: true, type: true, filePath: true, isPrivate: true, updatedAt: true },
  });
  const destinations = items.map((item) => item.filePath).filter((path): path is string => !!path);
  if (destinations.length) {
    const pending = await prisma.appSetting.findMany({
      where: {
        key: { startsWith: PRIVACY_CLEANUP_PREFIX },
        OR: destinations.map((destination) => ({ value: { contains: JSON.stringify(destination) } })),
      }, take: MAX_PRIVACY_FILES,
    });
    for (const row of pending) {
      const entry = JSON.parse(row.value) as Cleanup;
      if (destinations.includes(entry.destination)) {
        try { await finishPrivacyCleanup(row.key, entry); }
        catch { throw new FilePrivacyError("PRIVACY_CLEANUP_PENDING", 503); }
      }
    }
  }
  const moving = items.filter((item) => needsPrivacyMove(item, isPrivate));
  const sources = [...new Set(moving.map((item) => item.filePath!))];
  const copies = new Map<string, string>();
  const cleanup: Cleanup[] = [];
  let committed = false;
  try {
    for (const source of sources) {
      if (isPrivate && await prisma.file.count({ where: { filePath: source, id: { notIn: uniqueIds } } })) {
        throw new FilePrivacyError("SHARED_PUBLIC_SOURCE_SELECT_ALL_ALIASES");
      }
      copies.set(source, await stageCopy(source, isPrivate));
    }
    await prisma.$transaction(async (tx) => {
      for (const source of sources) {
        if (isPrivate && await tx.file.count({ where: { filePath: source, id: { notIn: uniqueIds } } })) {
          throw new FilePrivacyError("SHARED_PUBLIC_SOURCE_SELECT_ALL_ALIASES");
        }
      }
      for (const item of items) {
        const destination = item.filePath ? copies.get(item.filePath) : undefined;
        const updated = await tx.file.updateMany({
          where: { id: item.id, filePath: item.filePath, isPrivate: item.isPrivate, updatedAt: item.updatedAt },
          data: { ...extra, isPrivate, ...(destination ? { filePath: destination } : {}) },
        });
        if (updated.count !== 1) throw new FilePrivacyError("FILE_CHANGED_RETRY");
      }
      for (const [source, destination] of copies) {
        const entry = { source, destination, targetIsPrivate: isPrivate };
        cleanup.push(entry);
        await tx.appSetting.upsert({
          where: { key: cleanupKey(source) },
          create: { key: cleanupKey(source), value: JSON.stringify(entry) },
          update: { value: JSON.stringify(entry) },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    committed = true;
  } finally {
    if (!committed) {
      for (const destination of copies.values()) {
        // A lost connection can make commit acknowledgement ambiguous. Preserve
        // the copy unless DB confirms that no committed row references it.
        try {
          if (await prisma.file.count({ where: { filePath: destination } }) === 0) await removeBytes(destination);
        } catch { /* Keep recoverable bytes if DB or storage is unavailable. */ }
      }
    }
  }
  for (const entry of cleanup) {
    try { await finishPrivacyCleanup(cleanupKey(entry.source), entry); }
    catch { throw new FilePrivacyError("PRIVACY_CLEANUP_PENDING", 503); }
  }
  return { updated: items.length, moved: moving.length };
}
