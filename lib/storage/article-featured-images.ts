import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function saveFeaturedImage(buffer: Buffer, ext: string = "jpg"): Promise<string> {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`featured/${filename}`, buffer, {
      access: "public",
      contentType: ext === "png" ? "image/png" : "image/jpeg",
      addRandomSuffix: true,
    });
    return blob.url;
  }

  // Dev : écriture disque locale.
  // TODO prod sans Blob : le FS serverless est en lecture seule → exige un stockage durable
  //      (Vercel Blob via BLOB_READ_WRITE_TOKEN, ou S3).
  const dir = path.join(process.cwd(), "public", "uploads", "featured");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return `/uploads/featured/${filename}`;
}
