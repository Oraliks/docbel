'use client'

// Client-side dispatcher for block actions. Best-effort + graceful: actions that
// need backend/keys (Stripe) degrade to a toast if not configured.
import { toast } from 'sonner'
import { safeHref } from './url-utils'
import type { PageActionConfig } from './action-schema'

export async function runAction(
  action: PageActionConfig | undefined,
  evt?: { currentTarget?: EventTarget | null }
): Promise<void> {
  if (!action || !action.type || action.type === 'none') return

  switch (action.type) {
    case 'url': {
      const href = safeHref(action.href)
      if (!href) return
      if (action.newTab) window.open(href, '_blank', 'noopener,noreferrer')
      else window.location.href = href
      break
    }
    case 'scroll': {
      const t = (action.target || '').replace(/^#/, '')
      if (!t) return
      const el =
        document.getElementById(t) ||
        document.querySelector(`[data-anchor="${CSS.escape(t)}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    }
    case 'copy': {
      if (!action.text) return
      try {
        await navigator.clipboard.writeText(action.text)
        toast.success('Copié')
      } catch {
        toast.error('Copie impossible')
      }
      break
    }
    case 'download': {
      const href = safeHref(action.href)
      if (!href) return
      const a = document.createElement('a')
      a.href = href
      if (action.filename) a.download = action.filename
      a.rel = 'noopener'
      a.click()
      break
    }
    case 'analytics': {
      const name = action.event || 'cta_click'
      const w = window as unknown as {
        dataLayer?: unknown[]
        gtag?: (...args: unknown[]) => void
      }
      w.dataLayer?.push({ event: name })
      w.gtag?.('event', name)
      window.dispatchEvent(new CustomEvent('beldoc:analytics', { detail: { event: name } }))
      break
    }
    case 'calendly': {
      const href = safeHref(action.href)
      if (!href) return
      window.open(href, '_blank', 'noopener,noreferrer,width=1000,height=700')
      break
    }
    case 'checkout': {
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId: action.priceId }),
        })
        if (!res.ok) {
          toast.error('Paiement indisponible')
          return
        }
        const data = (await res.json().catch(() => ({}))) as { url?: string }
        if (data?.url) window.location.href = data.url
        else toast.error('Paiement indisponible')
      } catch {
        toast.error('Paiement indisponible')
      }
      break
    }
    case 'modal': {
      window.dispatchEvent(
        new CustomEvent('beldoc:open-modal', { detail: { id: action.target } })
      )
      break
    }
    case 'submit': {
      const node = evt?.currentTarget as HTMLElement | undefined
      node?.closest('form')?.requestSubmit()
      break
    }
    case 'toggle-visibility': {
      if (action.target) {
        window.dispatchEvent(
          new CustomEvent('beldoc:toggle-block', { detail: { id: action.target } })
        )
      }
      break
    }
  }
}
