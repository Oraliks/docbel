'use client'

import * as React from 'react'
import { safeHref } from '@/lib/page-builder/url-utils'
import { runAction } from '@/lib/page-builder/run-action'
import type { PageActionConfig } from '@/lib/page-builder/action-schema'

/**
 * Renders an interactive element driven by an optional `action`.
 * - No action (or type 'url'): renders a real <a> (good for SEO/accessibility),
 *   using the action's href or the fallback `href`.
 * - Any other action type: renders a <button> that runs the action on click.
 * Backward compatible: pass only `href` and it behaves like a plain link.
 */
export function ActionButton({
  action,
  href,
  newTab,
  className,
  title,
  children,
}: {
  action?: PageActionConfig
  href?: string
  newTab?: boolean
  className?: string
  title?: string
  children: React.ReactNode
}) {
  const type = action?.type
  const isClick = !!type && type !== 'none' && type !== 'url'

  if (isClick) {
    return (
      <button
        type="button"
        className={className}
        title={title}
        onClick={(e) => {
          void runAction(action, e)
        }}
      >
        {children}
      </button>
    )
  }

  const url = safeHref((type === 'url' ? action?.href : undefined) || href)
  const openNew = type === 'url' ? action?.newTab : newTab
  return (
    <a
      href={url}
      target={openNew ? '_blank' : undefined}
      rel={openNew ? 'noopener noreferrer' : undefined}
      className={className}
      title={title}
    >
      {children}
    </a>
  )
}
