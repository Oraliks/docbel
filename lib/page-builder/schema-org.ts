// =====================================================================
//  Auto-generate Schema.org JSON-LD from a page's blocks.
//  Big SEO win: Google renders FAQ blocks as rich results, articles get
//  metadata badges, etc.
// =====================================================================

import type { BlockProps, FaqProps, HeadingProps, StepsProps } from './types'

interface FaqJsonLd {
  '@context': 'https://schema.org'
  '@type': 'FAQPage'
  mainEntity: Array<{
    '@type': 'Question'
    name: string
    acceptedAnswer: { '@type': 'Answer'; text: string }
  }>
}

interface ArticleJsonLd {
  '@context': 'https://schema.org'
  '@type': 'Article'
  headline: string
  description?: string
  image?: string[]
  datePublished?: string
  dateModified?: string
}

interface BreadcrumbJsonLd {
  '@context': 'https://schema.org'
  '@type': 'BreadcrumbList'
  itemListElement: Array<{
    '@type': 'ListItem'
    position: number
    name: string
    item: string
  }>
}

interface HowToJsonLd {
  '@context': 'https://schema.org'
  '@type': 'HowTo'
  name: string
  description?: string
  step: Array<{
    '@type': 'HowToStep'
    position: number
    name: string
    text: string
  }>
}

export type PageJsonLd = FaqJsonLd | ArticleJsonLd | BreadcrumbJsonLd | HowToJsonLd

interface PageMetadata {
  title: string
  metaTitle?: string | null
  metaDesc?: string | null
  ogImage?: string | null
  slug: string
  baseUrl?: string
  publishedAt?: Date | null
  updatedAt?: Date
}

export function buildPageJsonLd(
  blocks: BlockProps[],
  meta: PageMetadata
): PageJsonLd[] {
  const out: PageJsonLd[] = []

  // FAQ block → FAQPage schema
  const faqs = blocks.filter((b) => b.type === 'faq')
  for (const faq of faqs) {
    const props = faq.props as FaqProps
    if (!props.items || props.items.length === 0) continue
    out.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: props.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    })
  }

  // Steps block → HowTo schema
  const steps = blocks.filter((b) => b.type === 'steps')
  for (const step of steps) {
    const props = step.props as StepsProps
    if (!props.items || props.items.length === 0) continue
    out.push({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: props.title || meta.title,
      description: props.subtitle || meta.metaDesc || undefined,
      step: props.items.map((item, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: item.title,
        text: item.description,
      })),
    })
  }

  // Article schema (only if the page has at least one heading + text/quote)
  const hasHeading = blocks.some((b) => b.type === 'heading' && (b.props as HeadingProps).level <= 2)
  const hasText = blocks.some((b) => b.type === 'text' || b.type === 'quote')
  if (hasHeading && hasText) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: meta.metaTitle || meta.title,
      description: meta.metaDesc || undefined,
      image: meta.ogImage ? [meta.ogImage] : undefined,
      datePublished: meta.publishedAt?.toISOString(),
      dateModified: meta.updatedAt?.toISOString(),
    })
  }

  return out
}
