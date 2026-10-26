import { put, del, get } from "@vercel/blob";
import { AsyncLocalStorage } from "node:async_hooks";
import { assertStagingStorageTargets } from "@/lib/config/runtime-environment";

const BLOB_PREFIX = "blobs:";
type BlobAccess = "public" | "private";

/**
 * Frontière strictement réservée aux recettes serveur. Elle n'est jamais
 * sélectionnée par une requête HTTP : sans installation explicite par du code
 * exécuté sous NODE_ENV=test, les fonctions ci-dessous utilisent Vercel Blob.
 */
export interface BlobStorageTestAdapter {
  save(buffer: Buffer, key: string, isPrivate: boolean): Promise<string>;
  get(filePath: string): Promise<Buffer | null>;
  delete(filePath: string): Promise<void>;
}

const testAdapters = new AsyncLocalStorage<BlobStorageTestAdapter>();

export async function withBlobStorageTestAdapter<T>(
  adapter: BlobStorageTestAdapter,
  callback: () => Promise<T>
): Promise<T> {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Blob storage test adapter is only available under NODE_ENV=test");
  }
  return testAdapters.run(adapter, callback);
}

export function isBlobsEnabled(): boolean {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_PRIVATE_READ_WRITE_TOKEN);
}

export function isBlobsPath(filePath: string | null | undefined): boolean {
  return !!filePath && filePath.startsWith(BLOB_PREFIX);
}

function blobLocation(filePath: string): { url: string; access: BlobAccess } {
  if (!isBlobsPath(filePath)) throw new Error("Invalid Blob path");
  const url = new URL(filePath.slice(BLOB_PREFIX.length));
  const match = url.hostname.match(/^[a-z0-9-]+\.(public|private)\.blob\.vercel-storage\.com$/i);
  if (!match || url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("Invalid Blob origin");
  }
  return { url: url.href, access: match[1].toLowerCase() as BlobAccess };
}

export function isPrivateBlobPath(filePath: string | null | undefined): boolean {
  if (!isBlobsPath(filePath)) return false;
  try { return blobLocation(filePath!).access === "private"; } catch { return false; }
}

function blobToken(access: BlobAccess): string {
  const token = access === "private"
    ? process.env.BLOB_PRIVATE_READ_WRITE_TOKEN
    : process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error(`Missing ${access} Blob store configuration`);
  if (access === "private" && token === process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Private Blob storage requires a separate private store");
  }
  return token;
}

export async function saveBlob(buffer: Buffer, key: string, isPrivate = false): Promise<string> {
  const testAdapter = testAdapters.getStore();
  if (testAdapter) return testAdapter.save(buffer, key, isPrivate);
  assertStagingStorageTargets();
  const access = isPrivate ? "private" : "public";
  const token = blobToken(access);
  const { url } = await put(key, buffer, { access, token, addRandomSuffix: true });
  const storedPath = `${BLOB_PREFIX}${url}`;
  if (blobLocation(storedPath).access !== access) {
    await del(url, { token });
    throw new Error("Blob store returned the wrong access level");
  }
  return storedPath;
}

/** Caller must authorize private reads. Legacy private/ keys in a PUBLIC store
 * stay readable until migration; the hostname, never the key, identifies access. */
export async function getBlob(filePath: string): Promise<Buffer | null> {
  const testAdapter = testAdapters.getStore();
  if (testAdapter) return testAdapter.get(filePath);
  assertStagingStorageTargets();
  const { url, access } = blobLocation(filePath);
  if (access === "public") {
    const response = await fetch(url, { cache: "no-store", redirect: "error" });
    return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
  }
  const result = await get(url, { access, token: blobToken(access), useCache: false });
  if (result?.statusCode !== 200) return null;
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

export async function deleteBlob(filePath: string): Promise<void> {
  const testAdapter = testAdapters.getStore();
  if (testAdapter) return testAdapter.delete(filePath);
  assertStagingStorageTargets();
  const { url, access } = blobLocation(filePath);
  await del(url, { token: blobToken(access) });
}

/** Stage a verified copy. The caller commits references, then deletes the source
 * only when unreferenced. Never remove source bytes before the DB commit. */
export async function moveBlob(filePath: string, targetIsPrivate: boolean): Promise<string> {
  assertStagingStorageTargets();
  const { url, access } = blobLocation(filePath);
  if ((access === "private") === targetIsPrivate) return filePath;
  blobToken(targetIsPrivate ? "private" : "public");
  const data = await getBlob(filePath);
  if (!data) throw new Error("Source Blob is missing");
  const name = new URL(url).pathname.split("/").pop() || "file";
  const newPath = await saveBlob(data, `${targetIsPrivate ? "private" : "public"}/${name}`, targetIsPrivate);
  try {
    const copied = await getBlob(newPath);
    if (!copied || !data.equals(copied)) throw new Error("Blob copy verification failed");
  } catch (error) {
    await deleteBlob(newPath).catch(() => undefined);
    throw error;
  }
  return newPath;
}
