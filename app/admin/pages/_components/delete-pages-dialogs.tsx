'use client'

// =====================================================================
//  Admin pages list — single + bulk delete confirmation dialogs.
//  Controlled/presentational: extracted verbatim from page.tsx. Both use
//  the shared "type to confirm" field; the parent owns the typed value
//  and the delete actions.
// =====================================================================

import { useTranslations } from 'next-intl'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TypeToConfirmField, typeToConfirmMatches } from '@/components/ui/type-to-confirm-field'

interface DeletePagesDialogsProps {
  deleteOpen: boolean
  onDeleteOpenChange: (open: boolean) => void
  onConfirmDelete: () => void
  bulkOpen: boolean
  onBulkOpenChange: (open: boolean) => void
  bulkCount: number
  onConfirmBulkDelete: () => void
  typed: string
  onTypedChange: (value: string) => void
}

export function DeletePagesDialogs({
  deleteOpen,
  onDeleteOpenChange,
  onConfirmDelete,
  bulkOpen,
  onBulkOpenChange,
  bulkCount,
  onConfirmBulkDelete,
  typed,
  onTypedChange,
}: DeletePagesDialogsProps) {
  const t = useTranslations('admin.pages')

  return (
    <>
      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={onDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteDialogDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <TypeToConfirmField
            requireText={t('confirmWord')}
            value={typed}
            onChange={onTypedChange}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDelete}
              variant="destructive"
              disabled={!typeToConfirmMatches(typed, t('confirmWord'))}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkOpen} onOpenChange={onBulkOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('bulkDeleteDialogTitle', { count: bulkCount })}</AlertDialogTitle>
            <AlertDialogDescription>{t('bulkDeleteDialogDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <TypeToConfirmField
            requireText={t('confirmWord')}
            value={typed}
            onChange={onTypedChange}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmBulkDelete}
              variant="destructive"
              disabled={!typeToConfirmMatches(typed, t('confirmWord'))}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
