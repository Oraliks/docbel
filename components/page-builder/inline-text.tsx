'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface InlineTextProps {
  value: string
  onChange: (next: string) => void
  multiline?: boolean
  placeholder?: string
  className?: string
  /** When true, renders as a contenteditable that mirrors the styled element below. */
  editing?: boolean
  as?: keyof React.JSX.IntrinsicElements
}

/**
 * Inline editable plain-text component. Single contentEditable (no <input>),
 * so it inherits the surrounding typography. Commits the value on blur and
 * also on Enter (single-line) / Cmd+Enter (multiline).
 */
export function InlineText({
  value,
  onChange,
  multiline = false,
  placeholder = '',
  className,
  editing = true,
  as: Tag = 'span',
}: InlineTextProps) {
  const ref = React.useRef<HTMLElement>(null)
  const lastCommitted = React.useRef(value)

  // Keep the DOM in sync if `value` changes from outside (e.g. undo/redo)
  // *without* clobbering the user's caret while they're typing.
  React.useEffect(() => {
    if (!ref.current) return
    if (ref.current.innerText === value) return
    if (document.activeElement === ref.current) return
    ref.current.innerText = value
    lastCommitted.current = value
  }, [value])

  const commit = () => {
    const text = ref.current?.innerText ?? ''
    if (text === lastCommitted.current) return
    lastCommitted.current = text
    onChange(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (!multiline && e.key === 'Enter') {
      e.preventDefault()
      ;(e.target as HTMLElement).blur()
    }
    if (multiline && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      ;(e.target as HTMLElement).blur()
    }
  }

  // Initial DOM children = initial text. After mount we sync via ref to avoid
  // clobbering the user's caret on each render.
  return React.createElement(
    Tag,
    {
      ref,
      contentEditable: editing,
      suppressContentEditableWarning: true,
      spellCheck: false,
      'data-placeholder': placeholder,
      className: cn(
        'outline-none focus:outline-2 focus:outline-primary/40 focus:outline-offset-2 rounded-sm',
        'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:pointer-events-none',
        className
      ),
      onBlur: commit,
      onKeyDown: handleKeyDown,
      onPaste: (e: React.ClipboardEvent) => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        document.execCommand('insertText', false, text)
      },
    },
    value
  )
}
