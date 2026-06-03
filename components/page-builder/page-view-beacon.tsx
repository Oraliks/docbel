'use client'

import { useEffect } from 'react'

/**
 * Fire-and-forget page-view beacon for published pages. Runs once per mount,
 * client-side (so it counts even with ISR/cache). Uses sendBeacon when available.
 */
export function PageViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      const w = window.innerWidth
      const device = w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop'
      const payload = JSON.stringify({
        slug,
        device,
        referrer: document.referrer || undefined,
      })
      const url = '/api/page-views'
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }))
      } else {
        void fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        })
      }
    } catch {
      // ignore — analytics must never break the page
    }
  }, [slug])

  return null
}
