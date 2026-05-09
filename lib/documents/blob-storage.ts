import { put, del } from "@vercel/blob";

const BLOB_PREFIX = "blobs:";

export function isBlobsEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function isBlobsPath(filePath: string | null | undefined): boolean {
  return !!filePath && filePath.startsWith(BLOB_PREFIX);
}

function blobsUrl(filePath: string): string {
  return filePath.slice(BLOB_PREFIX.length);
}

export async function saveBlob(buffer: Buffer, key: string): Promise<string> {
  const { url } = await put(key, buffer, {
    access: "public",
    addRandomSuffix: true,
  });
  return `${BLOB_PREFIX}${url}`;
}

export async function getBlob(filePath: string): Promise<Buffer | null> {
  const url = blobsUrl(filePath);
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export async function deleteBlob(filePath: string): Promise<void> {
  const url = blobsUrl(filePath);
  await del(url);
}

export async function moveBlob(
  filePath: string,
  targetIsPrivate: boolean
): Promise<string> {
  if (!isBlobsPath(filePath)) return filePath;

  const url = blobsUrl(filePath);
  const path = new URL(url).pathname.slice(1);
  const slash = path.indexOf("/");
  const currentFolder = slash >= 0 ? path.slice(0, slash) : "";
  const remainder = slash >= 0 ? path.slice(slash + 1) : path;
  const targetFolder = targetIsPrivate ? "private" : "public";
  if (currentFolder === targetFolder) return filePath;

  // Vercel Blob ne supporte pas le rename : copier puis supprimer.
  const data = await getBlob(filePath);
  if (!data) return filePath;
  const newPath = await saveBlob(data, `${targetFolder}/${remainder}`);
  await del(url).catch(() => {});
  return newPath;
}
