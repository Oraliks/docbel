'use client'

// =====================================================================
//  Rendu public LAZY des blocs — code-splitting par catégorie.
//
//  Le rendu public ne doit PAS charger les 133 blocs (ni leurs éditeurs
//  `Fields`) sur chaque page. Ici, chaque catégorie est chargée via
//  `next/dynamic` (chunk séparé) UNIQUEMENT quand un bloc de cette catégorie
//  apparaît sur la page. `ssr: true` (défaut) → le contenu reste rendu côté
//  serveur (HTML complet pour le SEO), le chunk client est juste hydraté.
//
//  L'éditeur, lui, garde le registry synchrone (block-picker/inspector/…),
//  hors bundle public.
// =====================================================================

import dynamic from 'next/dynamic'
import type { ComponentType, FC, ReactNode } from 'react'
import type { BlockDefinition } from '@/lib/page-builder/block-definition'
import { categoryOf, type CategorySource } from '@/lib/page-builder/block-categories'

interface CatRenderProps {
  type: string
  props: unknown
  slot?: ReactNode
  slotByIndex?: (idx: number) => ReactNode
}

type Barrel = Record<string, BlockDefinition>

/** Fabrique un composant qui, dans un barrel de catégorie chargé, rend le
 *  `Render` du bloc demandé par `type`. */
function makeCatRenderer(barrel: Barrel): FC<CatRenderProps> {
  return function CategoryRenderer({ type, props, slot, slotByIndex }: CatRenderProps) {
    const def = barrel[type]
    if (!def) return null
    const Render = def.Render as FC<{
      props: unknown
      slot?: ReactNode
      slotByIndex?: (idx: number) => ReactNode
    }>
    return <Render props={props} slot={slot} slotByIndex={slotByIndex} />
  }
}

// Un composant dynamique par catégorie. Le `import('…')` littéral est extrait
// par Next → un chunk par catégorie, chargé à la demande.
const CATEGORY_RENDERERS: Record<CategorySource, ComponentType<CatRenderProps>> = {
  text: dynamic(() => import('@/components/page-blocks/text').then((m) => ({ default: makeCatRenderer(m.textBlocks) }))),
  textExtra: dynamic(() => import('@/components/page-blocks/text-extra').then((m) => ({ default: makeCatRenderer(m.textExtraBlocks) }))),
  layout: dynamic(() => import('@/components/page-blocks/layout').then((m) => ({ default: makeCatRenderer(m.layoutBlocks) }))),
  media: dynamic(() => import('@/components/page-blocks/media').then((m) => ({ default: makeCatRenderer(m.mediaBlocks) }))),
  mediaExtra: dynamic(() => import('@/components/page-blocks/media-extra').then((m) => ({ default: makeCatRenderer(m.mediaExtraBlocks) }))),
  ui: dynamic(() => import('@/components/page-blocks/ui').then((m) => ({ default: makeCatRenderer(m.uiBlocks) }))),
  marketing: dynamic(() => import('@/components/page-blocks/marketing').then((m) => ({ default: makeCatRenderer(m.marketingBlocks) }))),
  marketingExtra: dynamic(() => import('@/components/page-blocks/marketing-extra').then((m) => ({ default: makeCatRenderer(m.marketingExtraBlocks) }))),
  docbel: dynamic(() => import('@/components/page-blocks/docbel').then((m) => ({ default: makeCatRenderer(m.docbelBlocks) }))),
  docbelExtra: dynamic(() => import('@/components/page-blocks/docbel-extra').then((m) => ({ default: makeCatRenderer(m.docbelExtraBlocks) }))),
  charts: dynamic(() => import('@/components/page-blocks/charts').then((m) => ({ default: makeCatRenderer(m.chartsBlocks) }))),
  engagement: dynamic(() => import('@/components/page-blocks/engagement').then((m) => ({ default: makeCatRenderer(m.engagementBlocks) }))),
  navigation: dynamic(() => import('@/components/page-blocks/navigation').then((m) => ({ default: makeCatRenderer(m.navigationBlocks) }))),
  editorial: dynamic(() => import('@/components/page-blocks/editorial').then((m) => ({ default: makeCatRenderer(m.editorialBlocks) }))),
  utility: dynamic(() => import('@/components/page-blocks/utility').then((m) => ({ default: makeCatRenderer(m.utilityBlocks) }))),
  flexible: dynamic(() => import('@/components/page-blocks/flexible').then((m) => ({ default: makeCatRenderer(m.flexibleBlocks) }))),
  global: dynamic(() => import('@/components/page-blocks/global').then((m) => ({ default: makeCatRenderer(m.globalBlocks) }))),
  onem: dynamic(() => import('@/components/page-blocks/onem').then((m) => ({ default: makeCatRenderer(m.onemBlocks) }))),
}

interface LazyBlockContentProps {
  type: string
  props: unknown
  slot?: ReactNode
  slotByIndex?: (idx: number) => ReactNode
  /** En éditeur : affiche une quarantaine visible pour un type inconnu. */
  editorMode?: boolean
}

/**
 * Rend le contenu d'un bloc en chargeant seulement le chunk de sa catégorie.
 * Type inconnu → null en public, carte de quarantaine en éditeur (parité C2).
 */
export function LazyBlockContent({
  type,
  props,
  slot,
  slotByIndex,
  editorMode = false,
}: LazyBlockContentProps) {
  const category = categoryOf(type)
  if (!category) {
    if (!editorMode) return null
    return (
      <div className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
        <span className="font-medium">Bloc inconnu</span>{' '}
        <code className="rounded bg-amber-500/10 px-1 py-0.5 font-mono">{type}</code> — type absent
        du registry. Supprimez-le ou remplacez-le.
      </div>
    )
  }
  const Renderer = CATEGORY_RENDERERS[category]
  return <Renderer type={type} props={props} slot={slot} slotByIndex={slotByIndex} />
}
