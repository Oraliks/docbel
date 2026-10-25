'use client'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { Difference, Workspace } from '@/lib/baremes-autonome/types'
import { ChangeValues, SourceDetails, useRateLabels } from './value-view'
export function DifferenceDialog({
  row,
  workspace,
  onClose,
}: {
  row: Difference
  workspace: Workspace
  onClose: () => void
}) {
  const { t, e, label } = useRateLabels(),
    value = (row.after ?? row.before)!
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-2xl">
        <DialogClose
          aria-label={t('cancel')}
          render={<Button variant="ghost" size="icon-sm" className="absolute right-2 top-2" />}
        >
          <X className="size-4" />
        </DialogClose>
        <DialogHeader className="pr-8">
          <DialogTitle>{label(value)}</DialogTitle>
          <DialogDescription>{value.context.join(' · ')}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('code')}: {value.code}
        </p>
        <ChangeValues row={row} />
        <p className="rounded-lg bg-muted p-3 text-sm">{e('independent')}</p>
        {row.formulaChanged && <p className="text-sm">{e('formulaChange')}</p>}
        <SourceDetails row={row} workspace={workspace} />
        <DialogClose render={<Button variant="outline" />}>{t('cancel')}</DialogClose>
      </DialogContent>
    </Dialog>
  )
}
