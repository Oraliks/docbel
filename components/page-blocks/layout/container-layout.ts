// Pure helper (server-safe, no React) mapping a container's child-layout props
// to the className applied to the element that DIRECTLY wraps its children.
// Shared by the editor (ChildrenList) and the public renderer so flex/grid
// layouts look identical in both. Returns null in default 'stack' mode so each
// caller keeps its existing spacing behavior.
import { cn } from '@/lib/utils'

export interface ChildLayout {
  layoutMode?: 'stack' | 'row' | 'grid'
  layoutGap?: 'sm' | 'md' | 'lg' | 'xl'
  layoutJustify?: 'start' | 'center' | 'end' | 'between' | 'around'
  layoutAlign?: 'start' | 'center' | 'end' | 'stretch'
  layoutCols?: 2 | 3 | 4
  layoutWrap?: boolean
}

const GAP: Record<NonNullable<ChildLayout['layoutGap']>, string> = {
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-10',
}

const JUSTIFY: Record<NonNullable<ChildLayout['layoutJustify']>, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
}

const ALIGN: Record<NonNullable<ChildLayout['layoutAlign']>, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
}

const GRID_COLS: Record<NonNullable<ChildLayout['layoutCols']>, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
}

export function childLayoutClass(props: ChildLayout): string | null {
  const mode = props.layoutMode ?? 'stack'
  if (mode === 'stack') return null
  const gap = GAP[props.layoutGap ?? 'md']
  if (mode === 'grid') {
    return cn(
      'grid',
      GRID_COLS[props.layoutCols ?? 2],
      gap,
      ALIGN[props.layoutAlign ?? 'stretch']
    )
  }
  // row (flexbox)
  return cn(
    'flex flex-row',
    props.layoutWrap === false ? 'flex-nowrap' : 'flex-wrap',
    gap,
    JUSTIFY[props.layoutJustify ?? 'start'],
    ALIGN[props.layoutAlign ?? 'start']
  )
}
