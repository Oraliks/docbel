import { getStore } from "@netlify/blobs";

const STORE_NAME = "beldoc-files";

export function isBlobsEnabled(): boolean {
  return (
    process.env.NETLIFY === "true" ||
    process.env.USE_NETLIFY_BLOBS === "true"
  );
}

export function isBlobsPath(filePath: string | null | undefined): boolean {
  return !!filePath && filePath.startsWith("blobs:");
}

function blobsKey(filePath: string): string {
  return filePath.slice("blobs:".length);
}

export async function saveBlob(buffer: Buffer, key: string): Promise<string> {
  const store = getStore(STORE_NAME);
  // Netlify Blobs accepte ArrayBuffer/Blob/Uint8Array; on convertit le Buffer Node.
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  await store.set(key, arrayBuffer);
  return `blobs:${key}`;
}

export async function getBlob(filePath: string): Promise<Buffer | null> {
  const store = getStore(STORE_NAME);
  const data = await store.get(blobsKey(filePath), { type: "arrayBuffer" });
  if (!data) return null;
  return Buffer.from(data);
}

export async function deleteBlob(filePath: string): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.delete(blobsKey(filePath));
}
