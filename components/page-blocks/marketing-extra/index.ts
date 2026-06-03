import { pricingTable } from './pricing-table'
import { compareTable } from './compare-table'
import { countdown } from './countdown'
import { notificationBar } from './notification-bar'
import { newsletter } from './newsletter'
import { trustBadges } from './trust-badges'
import { pressMentions } from './press-mentions'
import { starRating } from './star-rating'
import { leadMagnet } from './lead-magnet'
import { exitIntent } from './exit-intent'

export const marketingExtraBlocks = {
  pricingTable,
  compareTable,
  countdown,
  notificationBar,
  newsletter,
  trustBadges,
  pressMentions,
  starRating,
  leadMagnet,
  exitIntent,
} as const
