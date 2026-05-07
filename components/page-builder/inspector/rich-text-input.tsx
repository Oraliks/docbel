'use client'

import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  Strikethrough,
  Code as CodeIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Quote as QuoteIcon,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface RichTextInputProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /** When true, expose H1-H3 buttons (for Text block). Hidden for Quote since it's already a quote. */
  allowHeadings?: boolean
  /** When true, allow blockquote toggle. Defaults to true. */
  allowQuote?: boolean
  className?: string
}

export function RichTextInput({
  value,
  onChange,
  placeholder = 'Commencez à écrire…',
  allowHeadings = true,
  allowQuote = true,
  className,
}: RichTextInputProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: allowHeadings ? { levels: [1, 2, 3] } : false,
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    immediatelyRender: false,
  })

  // Keep editor in sync if external value changes (undo/redo, template apply)
  React.useEffect(() => {
    if (!editor) return
    if (editor.isFocused) return
    if (editor.getHTML() === value) return
    editor.commands.setContent(value || '', false)
  }, [editor, value])

  if (!editor) return null

  const tools: {
    icon: React.ElementType
    title: string
    isActive: () => boolean
    action: () => void
    show?: boolean
  }[] = [
    {
      icon: Bold,
      title: 'Gras',
      isActive: () => editor.isActive('bold'),
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      icon: Italic,
      title: 'Italique',
      isActive: () => editor.isActive('italic'),
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      icon: Strikethrough,
      title: 'Barré',
      isActive: () => editor.isActive('strike'),
      action: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      icon: CodeIcon,
      title: 'Code',
      isActive: () => editor.isActive('code'),
      action: () => editor.chain().focus().toggleCode().run(),
    },
    {
      icon: Heading1,
      title: 'Titre 1',
      show: allowHeadings,
      isActive: () => editor.isActive('heading', { level: 1 }),
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      icon: Heading2,
      title: 'Titre 2',
      show: allowHeadings,
      isActive: () => editor.isActive('heading', { level: 2 }),
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      icon: Heading3,
      title: 'Titre 3',
      show: allowHeadings,
      isActive: () => editor.isActive('heading', { level: 3 }),
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      icon: List,
      title: 'Liste à puces',
      isActive: () => editor.isActive('bulletList'),
      action: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered,
      title: 'Liste numérotée',
      isActive: () => editor.isActive('orderedList'),
      action: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      icon: QuoteIcon,
      title: 'Citation',
      show: allowQuote,
      isActive: () => editor.isActive('blockquote'),
      action: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      icon: LinkIcon,
      title: 'Lien',
      isActive: () => editor.isActive('link'),
      action: () => {
        const prev = (editor.getAttributes('link').href as string) || ''
        const url = prompt('URL du lien (vide pour retirer) :', prev)
        if (url === null) return
        if (url === '') {
          editor.chain().focus().unsetLink().run()
        } else {
          editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }
      },
    },
  ]

  return (
    <div className={cn('rounded-md border bg-background overflow-hidden', className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1">
        {tools
          .filter((t) => t.show !== false)
          .map((tool, i) => {
            const Icon = tool.icon
            return (
              <button
                key={i}
                type="button"
                onClick={tool.action}
                title={tool.title}
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded transition',
                  tool.isActive()
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground'
                )}
              >
                <Icon className="size-3.5" />
              </button>
            )
          })}
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Annuler"
          >
            <Undo className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Rétablir"
          >
            <Redo className="size-3.5" />
          </Button>
        </div>
      </div>
      <EditorContent
        editor={editor}
        className="prose-sm prose-neutral max-w-none p-3 min-h-[140px] text-sm focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[100px] [&_.ProseMirror_p.is-editor-empty:first-child:before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child:before]:text-muted-foreground/50 [&_.ProseMirror_p.is-editor-empty:first-child:before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child:before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child:before]:h-0"
      />
    </div>
  )
}
