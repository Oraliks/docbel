// =====================================================================
//  Block Definition — single source of truth for every block.
//  A block file exports one defineBlock() with: schema, defaults,
//  meta, Render, Fields. The TS prop type is derived from the schema.
// =====================================================================

import type { z } from 'zod'
import type { FC, ReactNode } from 'react'
import type { BlockCategory } from './types'

export interface BlockDefMeta {
  name: string
  description: string
  category: BlockCategory
  icon: string
  shortcuts?: string[]
  variants?: Array<{ id: string; name: string; description?: string }>
  canHaveChildren?: boolean
}

export interface BlockRenderProps<TProps> {
  props: TProps
  slot?: ReactNode
  slotByIndex?: (index: number) => ReactNode
}

export interface BlockFieldsProps<TProps> {
  props: TProps
  onChange: (partial: Partial<TProps>) => void
}

export interface BlockDefinition<
  TName extends string = string,
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
> {
  type: TName
  schema: TSchema
  defaults: z.infer<TSchema>
  meta: BlockDefMeta
  Render: FC<BlockRenderProps<z.infer<TSchema>>>
  Fields: FC<BlockFieldsProps<z.infer<TSchema>>>
}

export function defineBlock<
  TName extends string,
  TSchema extends z.ZodTypeAny,
>(def: BlockDefinition<TName, TSchema>): BlockDefinition<TName, TSchema> {
  return def
}
