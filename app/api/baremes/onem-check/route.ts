import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { compareWithPublishedOnem, ONEM_BAREME_HUB_URL } from '@/lib/baremes/onemSync'
import { sha256 } from '@/lib/baremes/hash'
import { getBlob, isBlobsPath } from '@/lib/storage/blob-storage'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

type CheckStatus =
  | 'content_match'
  | 'external_newer'
  | 'content_different_same_date'
  | 'internal_newer'
  | 'inconclusive'
  | 'external_unavailable'

function serializeDate(date: Date | null): string | null {
  return date?.toISOString() ?? null
}

function resolvePrivateBaremePath(filePath: string): string | null {
  const relative = filePath.replace(/^\//, '')
  const baseDir = relative.startsWith('uploads/')
    ? path.join(process.cwd(), 'public')
    : process.cwd()
  const fullPath = path.resolve(baseDir, relative)
  const roots = [
    path.resolve(process.cwd(), 'private', 'uploads', 'baremes'),
    path.resolve(process.cwd(), 'public', 'uploads', 'baremes'),
  ]
  return roots.some((root) => fullPath.startsWith(root + path.sep)) ? fullPath : null
}

function response(
  status: CheckStatus,
  message: string,
  details: Record<string, unknown>,
  ok = true
) {
  return NextResponse.json(
    {
      ok,
      status,
      message,
      checkedAt: new Date().toISOString(),
      method: 'comparaison manuelle des cellules normalisées du classeur',
      scope:
        "Compare les feuilles et valeurs lisibles par l'import ; ne prouve ni l'identité binaire du ZIP XLSX, ni ses métadonnées ou formules non calculées.",
      ...details,
    },
    { headers: jsonHeaders }
  )
}

/**
 * Contrôle externe ONEM, déclenché explicitement par un administrateur.
 * Il télécharge ponctuellement la référence officielle et la compare au
 * classeur original du dernier publié de la famille `onem-rates` : aucune
 * importation, publication ou planification automatique n'est effectuée.
 */
export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  const published = await prisma.baremeFile.findFirst({
    where: { status: 'published', fileType: 'onem-rates' },
    orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }],
    select: { id: true, name: true, filePath: true, fileHash: true, fileSize: true, validFrom: true },
  })
  if (!published) {
    return response(
      'inconclusive',
      "Aucun barème ONEM publié n'est disponible pour comparaison.",
      { hubUrl: ONEM_BAREME_HUB_URL, ours: null },
      false
    )
  }

  const ours = {
    id: published.id,
    name: published.name,
    validFrom: serializeDate(published.validFrom),
    fileHash: published.fileHash,
    fileSize: published.fileSize,
  }
  if (!published.filePath) {
    return response(
      'inconclusive',
      "Le classeur original interne est indisponible ; aucun résultat positif ne peut être établi.",
      { hubUrl: ONEM_BAREME_HUB_URL, ours, reason: 'original_missing' },
      false
    )
  }

  let original: Buffer
  try {
    if (isBlobsPath(published.filePath)) {
      const blob = await getBlob(published.filePath)
      if (!blob) throw new Error('Blob source missing')
      original = blob
    } else {
      const sourcePath = resolvePrivateBaremePath(published.filePath)
      if (!sourcePath) throw new Error('Invalid source path')
      original = await readFile(sourcePath)
    }
  } catch {
    return response(
      'inconclusive',
      "Le classeur original interne est introuvable dans ce déploiement ; aucun résultat positif ne peut être établi.",
      { hubUrl: ONEM_BAREME_HUB_URL, ours, reason: 'original_unreadable' },
      false
    )
  }
  if (
    (published.fileHash && sha256(original) !== published.fileHash) ||
    (published.fileSize != null && original.byteLength !== published.fileSize)
  ) {
    return response(
      'inconclusive',
      "L'intégrité du classeur interne ne correspond plus à l'import publié ; contrôle interrompu.",
      { hubUrl: ONEM_BAREME_HUB_URL, ours, reason: 'original_integrity_mismatch' },
      false
    )
  }

  const comparison = await compareWithPublishedOnem(original)
  if (!comparison) {
    return response(
      'external_unavailable',
      "La référence ONEM est inaccessible ou non exploitable ; le contrôle ne conclut pas que le barème est à jour.",
      { hubUrl: ONEM_BAREME_HUB_URL, ours, reason: 'external_unavailable' },
      false
    )
  }

  const onem = {
    url: comparison.onem.url,
    fileName: comparison.onem.fileName,
    validFrom: serializeDate(comparison.onem.validFrom),
  }
  const diff = {
    identical: comparison.identical,
    counts: comparison.counts,
    onlyInOurs: comparison.onlyInOurs,
    onlyInTheirs: comparison.onlyInTheirs,
  }
  if (!published.validFrom || !comparison.onem.validFrom) {
    return response(
      'inconclusive',
      "Une date d'effet est absente ou indéterminée ; la comparaison de contenu est fournie, sans conclusion positive de fraîcheur.",
      { hubUrl: ONEM_BAREME_HUB_URL, ours, onem, diff, reason: 'missing_effective_date' },
      false
    )
  }

  const dateOrder = comparison.onem.validFrom.getTime() - published.validFrom.getTime()
  if (dateOrder > 0) {
    return response(
      'external_newer',
      "La référence ONEM a une date d'effet plus récente que le barème interne publié.",
      { hubUrl: ONEM_BAREME_HUB_URL, ours, onem, diff }
    )
  }
  if (dateOrder < 0) {
    return response(
      'internal_newer',
      "Le barème interne a une date d'effet plus récente que la référence ONEM actuellement trouvée.",
      { hubUrl: ONEM_BAREME_HUB_URL, ours, onem, diff }
    )
  }
  if (!comparison.identical) {
    return response(
      'content_different_same_date',
      "Les deux classeurs ont la même date d'effet mais leur contenu normalisé diffère.",
      { hubUrl: ONEM_BAREME_HUB_URL, ours, onem, diff }
    )
  }
  return response(
    'content_match',
    "Le contenu normalisé du classeur publié concorde avec la référence ONEM pour la même date d'effet.",
    { hubUrl: ONEM_BAREME_HUB_URL, ours, onem, diff }
  )
}
