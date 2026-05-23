import { Prisma } from '@prisma/client'
import { prisma, withDbRetry } from '@/lib/prisma'

export type PublicationAction =
  | 'created'
  | 'published'
  | 'rejected'
  | 'archived'
  | 'rollback'
  | 'approved'
  | 'submitted_for_approval'
  | 'force_published'

export interface LogEventInput {
  fileId: string
  action: PublicationAction
  fromStatus?: string | null
  toStatus?: string | null
  actorEmail?: string | null
  details?: Record<string, unknown>
}

/**
 * Enregistre une entrée dans BaremePublicationLog. Best-effort : les erreurs
 * sont loguées mais n'invalident pas l'opération métier appelante.
 */
export async function logPublicationEvent(input: LogEventInput): Promise<void> {
  try {
    await withDbRetry(() =>
      prisma.baremePublicationLog.create({
        data: {
          fileId: input.fileId,
          action: input.action,
          fromStatus: input.fromStatus ?? null,
          toStatus: input.toStatus ?? null,
          actorEmail: input.actorEmail ?? null,
          details: input.details
            ? (input.details as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      })
    )
  } catch (err) {
    console.warn('[publicationLog] failed:', err)
  }
}

/**
 * Récupère l'historique d'un fichier (ordre chronologique inverse).
 */
export async function getPublicationHistory(fileId: string) {
  return withDbRetry(() =>
    prisma.baremePublicationLog.findMany({
      where: { fileId },
      orderBy: { createdAt: 'desc' },
    })
  )
}
