import { pricingTable } from './pricing-table'
import { compareTable } from './compare-table'
import { countdown } from './countdown'
import { notificationBar } from './notification-bar'
import { newsletter } from './newsletter'
import { trustBadges } from './trust-badges'
import { pressMentions } from './press-mentions'
import { starRating } from './star-rating'

export const marketingExtraBlocks = {
  pricingTable,
  compareTable,
  countdown,
  notificationBar,
  newsletter,
  trustBadges,
  pressMentions,
  starRating,
} as const
