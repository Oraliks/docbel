import { quiz } from './quiz'
import { poll } from './poll'
import { calculator } from './calculator'
import { reactions } from './reactions'
import { shareButtons } from './share-buttons'

export const engagementBlocks = {
  quiz,
  poll,
  calculator,
  reactions,
  shareButtons,
} as const
