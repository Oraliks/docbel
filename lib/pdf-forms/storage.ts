import { writeFile, readFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { nanoid } from "nanoid";
import {
  getUploadDirectory,
  buildStoredFilePath,
  resolveStoredFilePath,
} from "@/lib/file-storage";

/// Stockage des PDF SOURCES (formulaires vierges officiels). Indépendant du
/// modèle File. Vercel Blob si configuré, sinon disque local privé.
///
/// ⚠️ Les PDF *générés* (remplis) ne sont JAMAIS stockés ici (RGPD).

const BLOB_PREFIX = "blobs:";

function blobEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function isBlobPath(p: string | null | undefined): boolean {
  return !!p && p.startsWith(BLOB_PREFIX);
}

/// Enregistre un PDF source et renvoie son chemin de stockage opaque.
export async function saveSourcePdf(buffer: Buffer, originalName: string): Promise<string> {
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "form.pdf";

  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    const { url } = await put(`pdf-forms/${nanoid()}-${safe}`, buffer, {
      access: "public",
      addRandomSuffix: true,
    });
    return `${BLOB_PREFIX}${url}`;
  }

  const { relativeDir, absoluteDir } = getUploadDirectory(true);
  if (!existsSync(absoluteDir)) await mkdir(absoluteDir, { recursive: true });
  const fileName = `pdfform-${Date.now()}-${safe}`;
  await writeFile(join(absoluteDir, fileName), buffer);
  return buildStoredFilePath(relativeDir, fileName);
}

/// Lit un PDF source par son chemin de stockage.
export async function readSourcePdf(storagePath: string): Promise<Buffer | null> {
  if (isBlobPath(storagePath)) {
    try {
      const res = await fetch(storagePath.slice(BLOB_PREFIX.length));
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  const full = resolveStoredFilePath(storagePath);
  if (!full || !existsSync(full)) return null;
  return readFile(full);
}

/// Supprime un PDF source (à l'archivage/hard delete d'un formulaire).
export async function deleteSourcePdf(storagePath: string): Promise<void> {
  if (isBlobPath(storagePath)) {
    try {
      const { del } = await import("@vercel/blob");
      await del(storagePath.slice(BLOB_PREFIX.length));
    } catch {
      /* ignore */
    }
    return;
  }
  const full = resolveStoredFilePath(storagePath);
  if (full && existsSync(full)) {
    try {
      await unlink(full);
    } catch {
      /* ignore */
    }
  }
}
