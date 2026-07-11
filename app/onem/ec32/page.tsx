// =====================================================================
//  /onem/ec32 — Page eC3.2 (carte de contrôle, simulation pédagogique)
// ---------------------------------------------------------------------
//  Server Component. Si une page builder publiée existe au slug
//  `onem-ec32`, on rend ses blocs (le builder devient la source de
//  vérité éditable). Sinon, repli sur l'expérience par défaut alimentée
//  par `ec32DefaultContent`. La page hérite du shell glass global.
// =====================================================================

import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import type { BlockProps } from '@/lib/page-builder/types'
import { RenderedPage, resolveGlobalBlocks } from '@/lib/page-builder/render-page'
import { ec32DefaultContent } from '@/lib/ec32/content'
import { Ec32Experience } from '@/components/docbel/ec32/ec32-experience'
import { getSiteSettings } from '@/lib/site-settings.server'

const BUILDER_SLUG = 'onem-ec32'

export const revalidate = 60

/** Récupère la page builder publiée (ou planifiée échue) pour ce slug. */
async function getBuilderPage() {
  try {
    return await prisma.page.findFirst({
      where: {
        slug: BUILDER_SLUG,
        deletedAt: null,
        OR: [
          { status: 'published' },
          { status: 'scheduled', scheduledAt: { lte: new Date() } },
        ],
      },
    })
  } catch (error) {
    console.warn('[onem/ec32] DB indisponible, repli sur le contenu par défaut', error)
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getBuilderPage()

  const title = page?.metaTitle || ec32DefaultContent.seo.title
  const description = page?.metaDesc || ec32DefaultContent.seo.description
  const ogImages = page?.ogImage ? [{ url: page.ogImage }] : undefined
  const siteName = (await getSiteSettings()).identity.name

  return {
    title,
    description,
    robots: ec32DefaultContent.seo.noIndex ? { index: false, follow: false } : undefined,
    alternates: { canonical: '/onem/ec32' },
    openGraph: {
      type: 'website',
      title,
      description,
      url: '/onem/ec32',
      siteName,
      images: ogImages,
    },
  }
}

export default async function Ec32OnemPage() {
  const page = await getBuilderPage()

  if (page) {
    const blocks: BlockProps[] = Array.isArray(page.content)
      ? (page.content as unknown as BlockProps[])
      : []
    const globalMap = await resolveGlobalBlocks(blocks)

    return (
      <div className="w-full">
        <RenderedPage page={page} blocks={blocks} globalMap={globalMap} />
      </div>
    )
  }

  // Repli : aucune page builder enregistrée → contenu par défaut.
  return (
    <div className="w-full">
      <Ec32Experience content={ec32DefaultContent} />
    </div>
  )
}
