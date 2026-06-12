import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'

export const runtime = 'nodejs'

/**
 * Téléchargement du fichier .xlsx source d'un import — admin uniquement.
 *
 * Les nouveaux imports sont stockés dans private/uploads/baremes (jamais servis
 * statiquement). Les imports legacy (filePath commençant par /uploads/) restent
 * sous public/ et sont streamés ici aussi pour uniformiser l'accès.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  const { id } = await params
  const file = await withDbRetry(() =>
    prisma.baremeFile.findUnique({
      where: { id },
      select: { name: true, filePath: true },
    })
  )
  if (!file || !file.filePath) {
    return NextResponse.json({ error: 'Fichier source indisponible' }, { status: 404 })
  }

  // Résolution du chemin disque selon l'époque du stockage, en neutralisant
  // toute traversée (le filePath vient de la DB mais on reste défensif).
  const relative = file.filePath.replace(/^\//, '')
  const baseDir = relative.startsWith('uploads/')
    ? path.join(process.cwd(), 'public')
    : process.cwd()
  const fullPath = path.resolve(baseDir, relative)
  const allowedRoots = [
    path.resolve(process.cwd(), 'private', 'uploads', 'baremes'),
    path.resolve(process.cwd(), 'public', 'uploads', 'baremes'),
  ]
  if (!allowedRoots.some((root) => fullPath.startsWith(root + path.sep))) {
    return NextResponse.json({ error: 'Chemin de fichier invalide' }, { status: 400 })
  }

  try {
    const buffer = await readFile(fullPath)
    const downloadName = file.name.toLowerCase().endsWith('.xlsx') ? file.name : `${file.name}.xlsx`
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${downloadName.replace(/"/g, '')}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Fichier source introuvable sur le disque (peut-être importé sur un autre environnement)' },
      { status: 404 }
    )
  }
}
