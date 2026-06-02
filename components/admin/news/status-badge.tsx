'use client';

import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
  onClick?: () => void;
}

export function StatusBadge({ status, onClick }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'published':
        return {
          label: 'Publié',
          variant: 'success' as const,
          className: ''
        };
      case 'draft':
        return {
          label: 'Brouillon',
          variant: 'outline' as const,
          className: 'bg-muted text-muted-foreground'
        };
      case 'scheduled':
        return {
          label: 'Planifié',
          variant: 'info' as const,
          className: ''
        };
      case 'archived':
        return {
          label: 'Archivé',
          variant: 'destructive' as const,
          className: ''
        };
      default:
        return {
          label: status,
          variant: 'outline' as const,
          className: ''
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge variant={config.variant} className={config.className} onClick={onClick}>
      {config.label}
    </Badge>
  );
}
