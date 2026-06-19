import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';
import { requireAdminAuth } from '@/lib/auth-check';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Type de fichier non supporté. Utilisez JPG, PNG, WebP ou GIF.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux. Taille maximale : 5 Mo.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

    // Production (serverless) : le système de fichiers est en LECTURE SEULE
    // (mkdir/writeFile sur public/ → ENOENT). On stocke donc sur Vercel Blob —
    // même mécanisme que les assets calculateurs / PDF — dès que
    // BLOB_READ_WRITE_TOKEN est configuré. L'URL publique renvoyée part dans
    // News.image et s'utilise telle quelle (<img>, OG, /api/featured).
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`news/${filename}`, buffer, {
        access: 'public',
        contentType: file.type,
        addRandomSuffix: true,
      });
      return NextResponse.json({ url: blob.url }, { headers: jsonHeaders });
    }

    // Dev (pas de token) : écriture disque locale sous public/uploads/news.
    try {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'news');
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), buffer);
      return NextResponse.json({ url: `/uploads/news/${filename}` }, { headers: jsonHeaders });
    } catch {
      // FS en lecture seule (serverless) ET pas de Blob configuré → message clair.
      return NextResponse.json(
        {
          error:
            "Stockage d'images indisponible. En production, définissez BLOB_READ_WRITE_TOKEN (Vercel Blob) pour activer l'upload.",
        },
        { status: 503, headers: jsonHeaders }
      );
    }
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json({ error: 'Erreur lors du téléchargement' }, { status: 500 });
  }
}
