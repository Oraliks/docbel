import { htmlRaw } from './html-raw'
import { customCss } from './custom-css'
import { gdprNotice } from './gdpr-notice'
import { mapEmbed } from './map-embed'
import { marquee } from './marquee'
import { tiltCard } from './tilt-card'
import { imageHotspots } from './image-hotspots'

export const utilityBlocks = {
  htmlRaw,
  customCss,
  gdprNotice,
  mapEmbed,
  marquee,
  tiltCard,
  imageHotspots,
} as const
