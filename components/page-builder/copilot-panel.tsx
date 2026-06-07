'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Bot, Loader2, SendHorizontal, User } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { usePageBuilderStore } from '@/lib/page-builder/store'
import type { BlockProps } from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'

interface CopilotPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** Number of blocks inserted by this assistant turn (for the badge). */
  inserted?: number
}

/**
 * Keys whose string values hold human-readable text on a block's props.
 * Kept local & in sync with the editor's own extractor — we only need a rough
 * snapshot of the page to give the copilot context, not a perfect dump.
 */
const TEXT_KEYS = [
  'text',
  'html',
  'title',
  'subtitle',
  'description',
  'content',
  'quote',
  'caption',
  'answer',
  'question',
]

/** Flatten the current page's blocks to plain text for the copilot context. */
function extractPageText(blocks: BlockProps[]): string {
  const parts: string[] = []
  for (const b of blocks) {
    const p = b.props as Record<string, unknown>
    for (const k of TEXT_KEYS) {
      const v = p[k]
      if (typeof v === 'string' && v.trim()) parts.push(v)
    }
  }
  return parts
    .join('\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000)
}

const EXAMPLES = [
  'Quelles sections ajouter pour une page sur le chômage temporaire ?',
  'Ajoute une intro + une FAQ sur les conditions d’admissibilité',
  'Comment améliorer la structure de cette page ?',
]

export function CopilotPanel({ open, onOpenChange }: CopilotPanelProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to the latest message whenever the conversation grows or while
  // the copilot is "thinking".
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || loading) return

    // Snapshot the page text + history BEFORE mutating local state.
    const blocks = usePageBuilderStore.getState().blocks
    const pageText = extractPageText(blocks)
    const history = messages.map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/page-builder/ai-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, pageText }),
      })
      const data = await res.json()

      if (data?.aiDisabled) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'L’assistant IA n’est pas configuré sur cet environnement (ANTHROPIC_API_KEY manquante).',
          },
        ])
        return
      }
      if (!res.ok || data?.error) {
        const msg = data?.error || 'Échec de l’appel au copilote'
        toast.error(msg)
        setMessages((prev) => [...prev, { role: 'assistant', content: msg }])
        return
      }

      const reply: string =
        typeof data?.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : 'D’accord.'
      const newBlocks = data?.blocks as BlockProps[] | null | undefined

      let inserted = 0
      if (Array.isArray(newBlocks) && newBlocks.length > 0) {
        // The store re-maps ids and inserts; we don't mutate it here.
        usePageBuilderStore.getState().insertTemplate(newBlocks)
        inserted = newBlocks.length
        toast.success(
          `${inserted} bloc${inserted > 1 ? 's' : ''} inséré${inserted > 1 ? 's' : ''}`
        )
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, inserted: inserted || undefined },
      ])
    } catch {
      const msg = 'Erreur réseau — réessayez.'
      toast.error(msg)
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="size-4 text-primary" />
            Copilote IA
          </SheetTitle>
          <SheetDescription>
            Pose tes questions ou demande d’ajouter des sections : le copilote
            insère de vrais blocs éditables.
          </SheetDescription>
        </SheetHeader>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto p-4"
        >
          {messages.length === 0 && !loading && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Exemples pour démarrer :
              </p>
              <div className="flex flex-col gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => void send(ex)}
                    className="rounded-lg border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <Message key={i} message={m} />
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Le copilote réfléchit…
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={loading}
              placeholder="Écris un message… (Entrée pour envoyer, Maj+Entrée = nouvelle ligne)"
              className="max-h-40 min-h-[2.5rem] resize-none"
            />
            <Button
              size="icon"
              onClick={() => void send(input)}
              disabled={loading || !input.trim()}
              title="Envoyer"
              className="shrink-0"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizontal className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div
        className={cn(
          'max-w-[85%] space-y-1.5 rounded-2xl px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {typeof message.inserted === 'number' && message.inserted > 0 && (
          <p
            className={cn(
              'text-[11px] font-medium',
              isUser ? 'text-primary-foreground/80' : 'text-primary'
            )}
          >
            ✓ {message.inserted} bloc{message.inserted > 1 ? 's' : ''} inséré
            {message.inserted > 1 ? 's' : ''} dans la page
          </p>
        )}
      </div>
    </div>
  )
}
