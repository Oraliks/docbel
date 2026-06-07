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
    case 'set-tab': {
      if (action.target) {
        window.dispatchEvent(
          new CustomEvent('beldoc:set-tab', {
            detail: { id: action.target, value: action.value },
          })
        )
      }
      break
    }
    case 'play-video':
    case 'pause-video': {
      if (action.target) {
        window.dispatchEvent(
          new CustomEvent('beldoc:video-control', {
            detail: { id: action.target, playing: action.type === 'play-video' },
          })
        )
      }
      break
    }
    case 'animate': {
      if (action.target) {
        window.dispatchEvent(
          new CustomEvent('beldoc:animate', { detail: { id: action.target } })
        )
      }
      break
    }
    case 'share': {
      const url = safeHref(action.href) || window.location.href
      const title = action.text || document.title
      const nav = navigator as Navigator & {
        share?: (d: { title?: string; url?: string }) => Promise<void>
      }
      if (nav.share) {
        try {
          await nav.share({ title, url })
        } catch {
          /* partage annulé par l'utilisateur */
        }
      } else {
        try {
          await navigator.clipboard.writeText(url)
          toast.success('Lien copié')
        } catch {
          toast.error('Partage indisponible')
        }
      }
      break
    }
    case 'print': {
      window.print()
      break
    }
    case 'scroll-top': {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      break
    }
    case 'iframe-modal': {
      const href = safeHref(action.href)
      if (!href) return
      const overlay = document.createElement('div')
      overlay.setAttribute('role', 'dialog')
      overlay.setAttribute('aria-modal', 'true')
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);padding:24px'
      const close = () => {
        overlay.remove()
        document.removeEventListener('keydown', onKey)
      }
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') close()
      }
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close()
      })
      const frame = document.createElement('div')
      frame.style.cssText =
        'position:relative;width:100%;max-width:960px;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)'
      const iframe = document.createElement('iframe')
      iframe.src = href
      // Sécurité : l'iframe est créée dynamiquement à partir d'une URL fournie
      // par l'éditeur de page. On la confine via `sandbox` (scripts/same-origin
      // nécessaires aux players type YouTube/Vimeo, + popups/forms pour les CTA
      // internes) et on coupe la fuite de Referer.
      iframe.setAttribute(
        'sandbox',
        'allow-scripts allow-same-origin allow-popups allow-forms'
      )
      iframe.setAttribute('referrerpolicy', 'no-referrer')
      // `allow` restreint au strict utile pour un lecteur vidéo embarqué.
      iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture')
      iframe.style.cssText = 'width:100%;height:100%;border:0'
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('aria-label', 'Fermer')
      btn.textContent = '✕'
      btn.style.cssText =
        'position:absolute;top:8px;right:8px;z-index:2;width:32px;height:32px;border-radius:9999px;border:0;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;font-size:16px;line-height:1'
      btn.addEventListener('click', close)
      frame.appendChild(iframe)
      frame.appendChild(btn)
      overlay.appendChild(frame)
      document.body.appendChild(overlay)
      document.addEventListener('keydown', onKey)
      break
    }
  }
}
