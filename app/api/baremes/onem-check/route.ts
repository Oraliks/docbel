import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { fetchLatestOnemBaremeUrl, ONEM_BAREME_HUB_URL } from '@/lib/baremes/onemSync'

/**
 * Contrôle externe ONEM (déclenchement manuel admin) : le hub onem.be publie-t-il
 * un barème plus récent que notre dernier publié ?
 *
 * Best-effort réseau (retourne ok:false si le hub est injoignable). La même logique
 * peut être branchée plus tard sur un cron (cf. checkOnemForNewBareme dans onemSync).
 */
export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  const latest = await fetchLatestOnemBaremeUrl()
  if (!latest) {
    return NextResponse.json({
      ok: false,
      reason: 'Hub ONEM injoignable ou structure de page modifiée — réessayer plus tard.',
      hubUrl: ONEM_BAREME_HUB_URL,
    })
  }

  const published = await prisma.baremeFile.findFirst({
    where: { status: 'published' },
    orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }],
    select: { name: true, validFrom: true },
  })

  const ourDate = published?.validFrom ?? null
  const hasNewer =
    latest.validFrom !== null &&
    (ourDate === null || latest.validFrom.getTime() > ourDate.getTime())

  return NextResponse.json({
    ok: true,
    onem: { url: latest.url, fileName: latest.fileName, validFrom: latest.validFrom },
    ours: published ? { name: published.name, validFrom: ourDate } : null,
    hasNewer,
    message: hasNewer
      ? `L'ONEM publie « ${latest.fileName} », plus récent que votre barème publié.`
      : "Vous êtes à jour avec le barème publié par l'ONEM.",
  })
}
