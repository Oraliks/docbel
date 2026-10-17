import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { getBlob, isBlobsPath } from '@/lib/storage/blob-storage'
import { sha256 } from '@/lib/baremes/hash'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

/**
 * Téléchargement du fichier .xlsx source d'un import — admin uniquement.
 *
 * Les nouveaux imports sont stockés en Blob privé. Les imports legacy locaux
 * restent supportés en lecture seule pour préserver leur accès admin.
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
      select: { name: true, filePath: true, fileHash: true, fileSize: true },
    })
  )
  if (!file || !file.filePath) {
    return NextResponse.json(
      { error: 'Fichier source indisponible' },
      { status: 404, headers: jsonHeaders }
    )
  }

  let buffer: Buffer | null
  try {
    if (isBlobsPath(file.filePath)) {
      buffer = await getBlob(file.filePath)
    } else {
      // Repli lecture seule pour les imports historiques qui pointent encore
      // vers le disque local. Les nouveaux imports n'utilisent jamais ce chemin.
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
        return NextResponse.json(
          { error: 'Chemin de fichier invalide' },
          { status: 400, headers: jsonHeaders }
        )
      }
      buffer = await readFile(fullPath)
    }
  } catch {
    return NextResponse.json(
      { error: 'Fichier source original indisponible' },
      { status: 404, headers: jsonHeaders }
    )
  }

  if (!buffer) {
    return NextResponse.json(
      { error: 'Fichier source original indisponible' },
      { status: 404, headers: jsonHeaders }
    )
  }

  // Un hash/taille présents sont la preuve d'identité du nouvel import. Ne
  // jamais servir des octets différents sous l'étiquette d'un original exact.
  if (
    (file.fileSize !== null && buffer.byteLength !== file.fileSize) ||
    (file.fileHash !== null && sha256(buffer) !== file.fileHash)
  ) {
    return NextResponse.json(
      { error: 'Intégrité du fichier source non vérifiée' },
      { status: 409, headers: jsonHeaders }
    )
  }

  const downloadName = file.name.toLowerCase().endsWith('.xlsx') ? file.name : `${file.name}.xlsx`
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${downloadName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
