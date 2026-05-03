import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { PageLayout } from '@/components/page-builder/page-layout'
import { BlockProps } from '@/lib/page-builder/types'

export async function generateStaticParams() {
  const pages = await prisma.page.findMany({
    where: { status: 'published' },
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
    where: { slug, status: 'published' },
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
  console.log('🔍 Cherchant page avec slug:', slug)

  const page = await prisma.page.findFirst({
    where: {
      slug,
      status: 'published',
    },
  })

  console.log('✅ Page trouvée:', page?.slug || 'AUCUNE')

  if (!page) {
    console.log('❌ Page non trouvée, affichage 404')
    notFound()
  }

  let blocks: BlockProps[] = []
  try {
    blocks = JSON.parse(page.content)
  } catch {
    blocks = []
  }

  return <PageLayout blocks={blocks} title={page.title} />
}
