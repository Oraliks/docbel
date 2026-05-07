import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { PublicRenderer } from '@/components/page-builder/public-renderer'
import { BlockProps } from '@/lib/page-builder/types'
import { buildPageJsonLd } from '@/lib/page-builder/schema-org'

export const dynamicParams = true
export const revalidate = 60

export async function generateStaticParams() {
  const pages = await prisma.page.findMany({
    where: { status: 'published', deletedAt: null },
    select: { slug: true },
  })
  return pages.map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = await prisma.page.findFirst({
    where: { slug, status: 'published', deletedAt: null },
  })

  if (!page) return {}

  return {
    title: page.metaTitle || page.title,
    description: page.metaDesc,
    openGraph: {
      title: page.metaTitle || page.title,
      description: page.metaDesc || undefined,
      images: page.ogImage ? [{ url: page.ogImage }] : undefined,
    },
  }
}

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const page = await prisma.page.findFirst({
    where: { slug, status: 'published', deletedAt: null },
  })

  if (!page) notFound()

  const blocks: BlockProps[] = Array.isArray(page.content)
    ? (page.content as unknown as BlockProps[])
    : []

  const jsonLd = buildPageJsonLd(blocks, {
    title: page.title,
    metaTitle: page.metaTitle,
    metaDesc: page.metaDesc,
    ogImage: page.ogImage,
    slug: page.slug,
    updatedAt: page.updatedAt,
  })

  return (
    <>
      {jsonLd.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
      <PublicRenderer
        blocks={blocks}
        context={{
          site: { name: 'Docbel' },
          page: {
            title: page.title,
            slug: page.slug,
            description: page.metaDesc ?? undefined,
          },
        }}
      />
    </>
  )
}
