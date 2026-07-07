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

  // Sur Vercel le filesystem est read-only (sauf /tmp éphémère) : refuser le
  // fallback disque avec un message actionnable plutôt que de laisser planter
  // sur EROFS quelques lignes plus bas.
  if (process.env.VERCEL === "1" || process.env.VERCEL === "true") {
    throw new Error(
      "Storage non configuré : BLOB_READ_WRITE_TOKEN absent en runtime. " +
        "Crée un Vercel Blob store (Dashboard → Storage → Create → Blob) " +
        "et vérifie qu'il est activé pour l'environnement Production, " +
        "puis redéploie."
    );
  }

  const { relativeDir, absoluteDir } = getUploadDirectory(true);
  if (!existsSync(absoluteDir)) await mkdir(absoluteDir, { recursive: true });
  const fileName = `pdfform-${Date.now()}-${safe}`;
  await writeFile(join(absoluteDir, fileName), buffer);
  return buildStoredFilePath(relativeDir, fileName);
}

/// Lit un PDF source par son chemin de stockage. Si le storagePath est
/// obsolète / absent (ex. importé avant le passage à Vercel Blob, ou le
/// fichier upload a été purgé), on retombe sur `private/pdfs/{fallbackName}`
/// — les PDFs officiels de référence sont versionnés dans le repo et bundlés
/// avec le deploy Vercel (Oraliks 2026-07-07 : "PDF source introuvable" en
/// prod car sourceStoragePath pointait vers un fichier upload disparu).
export async function readSourcePdf(
  storagePath: string,
  fallbackName?: string | null
): Promise<Buffer | null> {
  if (isBlobPath(storagePath)) {
    try {
      const res = await fetch(storagePath.slice(BLOB_PREFIX.length));
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {
      /* fall through to reference PDF fallback */
    }
  } else {
    const full = resolveStoredFilePath(storagePath);
    if (full && existsSync(full)) return readFile(full);
  }
  // Fallback : PDF officiel de référence dans le repo.
  if (fallbackName) {
    const safe = fallbackName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ref = join(process.cwd(), "private", "pdfs", safe);
    if (existsSync(ref)) return readFile(ref);
  }
  return null;
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
