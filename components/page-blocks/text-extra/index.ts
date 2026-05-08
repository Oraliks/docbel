import { codeBlock } from './code-block'
import { pullQuote } from './pull-quote'
import { dropCap } from './drop-cap'
import { definitionList } from './definition-list'
import { highlight } from './highlight'
import { prosCons } from './pros-cons'
import { checklist } from './checklist'

export const textExtraBlocks = {
  codeBlock,
  pullQuote,
  dropCap,
  definitionList,
  highlight,
  prosCons,
  checklist,
} as const
