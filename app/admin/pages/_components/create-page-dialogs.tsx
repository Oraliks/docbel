'use client'

// =====================================================================
//  Admin pages list — "Create page" + "Choose template" dialogs.
//  Controlled/presentational: extracted verbatim from page.tsx so the
//  list component stays lean. All state + the create action stay in the
//  parent; this only renders and wires the two dialogs.
// =====================================================================

import { useTranslations } from 'next-intl'
import { PAGE_TEMPLATES } from '@/lib/page-builder/page-templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface CreatePageDialogsProps {
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
  templateOpen: boolean
  onTemplateOpenChange: (open: boolean) => void
  title: string
  onTitleChange: (value: string) => void
  selectedTemplate: string
  onSelectTemplate: (id: string) => void
  isCreating: boolean
  onCreate: () => void
}

export function CreatePageDialogs({
  createOpen,
  onCreateOpenChange,
  templateOpen,
  onTemplateOpenChange,
  title,
  onTitleChange,
  selectedTemplate,
  onSelectTemplate,
  isCreating,
  onCreate,
}: CreatePageDialogsProps) {
  const t = useTranslations('admin.pages')

  return (
    <>
      {/* Create Page Dialog */}
      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createDialogTitle')}</DialogTitle>
            <DialogDescription>{t('createDialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('pageTitleLabel')}</label>
              <Input
                placeholder={t('pageTitlePlaceholder')}
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && title.trim()) {
                    onCreate()
                  }
                }}
                disabled={isCreating}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('templateLabel')}</label>
              <Button
                variant="outline"
                className="w-full justify-start text-left"
                onClick={() => onTemplateOpenChange(true)}
              >
                {PAGE_TEMPLATES.find((tpl) => tpl.id === selectedTemplate)?.name ||
                  t('chooseTemplate')}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                onCreateOpenChange(false)
                onTitleChange('')
              }}
              disabled={isCreating}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={onCreate}
              disabled={isCreating || !title.trim()}
              className=""
            >
              {isCreating ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Selection Dialog */}
      <Dialog open={templateOpen} onOpenChange={onTemplateOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('chooseTemplate')}</DialogTitle>
            <DialogDescription>{t('chooseTemplateDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            {PAGE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  onSelectTemplate(template.id)
                  onTemplateOpenChange(false)
                }}
                className={`p-4 border rounded-lg text-left transition-all ${
                  selectedTemplate === template.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <h3 className="font-semibold text-sm">{template.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                {template.blocks.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('blocksCount', { count: template.blocks.length })}
                  </p>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
