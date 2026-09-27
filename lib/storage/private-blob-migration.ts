import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isPrivateBlobPath } from "./blob-storage";
import { changeFilePrivacy, FilePrivacyError, MAX_PRIVACY_FILES, PRIVACY_CLEANUP_PREFIX, retryPrivacyCleanup } from "./file-privacy";

type GroupResult = {
  sourceId: string;
  privateReferences: number;
  publicReferences: number;
  status: "ready" | "migrated" | "shared-public-blocked" | "group-too-large" | "failed";
  errorCode?: string;
};

/** No Blob requests or writes in the default dry-run. Reports only counts and a
 * source digest, never filenames, URLs, tokens or document contents. */
export async function migratePrivateBlobs(options: { apply?: boolean; maxFiles?: number; batchSize?: number } = {}) {
  const apply = options.apply === true;
  const maxFiles = options.maxFiles ?? 500;
  const batchSize = options.batchSize ?? 100;
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 10_000 ||
      !Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_PRIVACY_FILES) {
    throw new Error("Invalid bounded migration limits");
  }
  if (apply) await retryPrivacyCleanup(MAX_PRIVACY_FILES);
  const groups: GroupResult[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  let scanned = 0;
  let exhausted = false;
  while (scanned < maxFiles) {
    const rows = await prisma.file.findMany({
      where: { type: "file", isPrivate: true, filePath: { startsWith: "blobs:" }, ...(cursor ? { id: { gt: cursor } } : {}) },
      select: { id: true, filePath: true }, orderBy: { id: "asc" },
      take: Math.min(batchSize, maxFiles - scanned),
    });
    if (!rows.length) { exhausted = true; break; }
    for (const row of rows) {
      scanned++;
      cursor = row.id;
      if (!row.filePath || isPrivateBlobPath(row.filePath) || seen.has(row.filePath)) continue;
      seen.add(row.filePath);
      const aliases = await prisma.file.findMany({
        where: { filePath: row.filePath },
        select: { id: true, isPrivate: true }, take: MAX_PRIVACY_FILES + 1,
      });
      const group: GroupResult = {
        sourceId: createHash("sha256").update(row.filePath).digest("hex").slice(0, 16),
        privateReferences: aliases.filter((alias) => alias.isPrivate).length,
        publicReferences: aliases.filter((alias) => !alias.isPrivate).length,
        status: "ready",
      };
      if (aliases.length > MAX_PRIVACY_FILES) group.status = "group-too-large";
      else if (group.publicReferences) group.status = "shared-public-blocked";
      else if (apply) {
        try {
          await changeFilePrivacy(aliases.map((alias) => alias.id), true);
          group.status = "migrated";
        } catch (error) {
          group.status = "failed";
          group.errorCode = error instanceof FilePrivacyError ? error.code : "STORAGE_OR_DATABASE_FAILURE";
        }
      }
      groups.push(group);
    }
  }
  return {
    mode: apply ? "apply" : "dry-run", scanned, scanLimitReached: !exhausted && scanned === maxFiles,
    groups,
    cleanupPending: await prisma.appSetting.count({ where: { key: { startsWith: PRIVACY_CLEANUP_PREFIX } } }),
  };
}
