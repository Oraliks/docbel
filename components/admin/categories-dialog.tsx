'use client';

import { useState } from 'react';
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
import { Plus } from 'lucide-react';

interface CategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoriesUpdated?: () => void;
}

export function CategoriesDialog({ open, onOpenChange, onCategoriesUpdated }: CategoriesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#C8102E');

  const handleAddCategory = async () => {
    if (!newName.trim()) {
      toast.error('Entrez un nom de catégorie');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, color: newColor })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erreur lors de la création');
      }

      await res.json();
      setNewName('');
      setNewColor('#C8102E');
      toast.success('Catégorie créée');
      onCategoriesUpdated?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Créer une catégorie</DialogTitle>
          <DialogDescription>
            Ajoutez une nouvelle catégorie pour les articles
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Add new category */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Nom</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Mise à jour"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Couleur</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <Input
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="font-mono text-sm flex-1"
                />
              </div>
            </div>
            <Button
              onClick={handleAddCategory}
              disabled={loading}
              className="w-full"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Créer la catégorie
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
