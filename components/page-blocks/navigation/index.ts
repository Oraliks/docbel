import { openingHours } from './opening-hours'
import { lastUpdated } from './last-updated'
import { tableOfContents } from './table-of-contents'
import { anchorMenu } from './anchor-menu'
import { backToTop } from './back-to-top'
import { readingProgress } from './reading-progress'

export const navigationBlocks = {
  openingHours,
  lastUpdated,
  tableOfContents,
  anchorMenu,
  backToTop,
  readingProgress,
} as const
