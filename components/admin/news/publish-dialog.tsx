'use client';

import { useState } from 'react';
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

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  category: string;
  isPublished: boolean;
  onPublish: () => Promise<void>;
  onSchedule: (date: string, time: string) => Promise<void>;
}

export function PublishDialog({
  open,
  onOpenChange,
  title,
  category,
  isPublished,
  onPublish,
  onSchedule
}: PublishDialogProps) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [isLoading, setIsLoading] = useState(false);

  const handleSchedule = async () => {
    if (!scheduledDate) {
      alert('Veuillez sélectionner une date');
      return;
    }

    setIsLoading(true);
    try {
      await onSchedule(scheduledDate, scheduledTime);
      onOpenChange(false);
      setScheduledDate('');
      setScheduledTime('09:00');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Planifier la publication</DialogTitle>
          <DialogDescription>
            Choisissez la date et l'heure de publication de l'article
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-gray-500 mt-1">{category}</p>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="date" className="text-sm">Date</Label>
              <Input
                id="date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="time" className="text-sm">Heure</Label>
              <Input
                id="time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleSchedule} disabled={isLoading}>
            {isLoading ? 'Planification...' : 'Planifier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
