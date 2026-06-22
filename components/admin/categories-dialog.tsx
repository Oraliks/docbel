'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Save } from 'lucide-react';

export interface EditableCategory {
  id: string;
  name: string;
  color: string;
}

interface CategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoriesUpdated?: () => void;
  /** Catégorie à éditer ; absent = mode création. */
  category?: EditableCategory | null;
}

const DEFAULT_COLOR = '#7C3AED';

export function CategoriesDialog({
  open,
  onOpenChange,
  onCategoriesUpdated,
  category,
}: CategoriesDialogProps) {
  const t = useTranslations('admin.news');
  const isEdit = Boolean(category);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);

  // Pré-remplit (édition) ou réinitialise (création) chaque fois que le
  // dialog s'ouvre ou que la catégorie cible change.
  useEffect(() => {
    if (!open) return;
    if (category) {
      setName(category.name);
      setColor(category.color || DEFAULT_COLOR);
    } else {
      setName('');
      setColor(DEFAULT_COLOR);
    }
  }, [open, category]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t('catNameRequired'));
      return;
    }

    setLoading(true);
    try {
      // Mode édition : PATCH /api/categories/:id, sinon création POST.
      const url = isEdit ? `/api/categories/${category!.id}` : '/api/categories';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || (isEdit ? t('catUpdateError') : t('catCreateError')));
      }

      await res.json();
      toast.success(isEdit ? t('catUpdated') : t('catCreated'));
      onCategoriesUpdated?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toastError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('catEditTitle') : t('catCreate')}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? t('catEditDescription')
              : t('catCreateDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div>
              <Label className="text-sm">{t('catColName')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('catNamePlaceholder')}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">{t('catColColor')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="font-mono text-sm flex-1"
                />
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full"
              size="sm"
            >
              {isEdit ? (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {t('catSaveChanges')}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('catCreateButton')}
                </>
              )}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
