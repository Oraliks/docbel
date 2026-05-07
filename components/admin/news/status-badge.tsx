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
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-200 dark:hover:bg-green-900/60'
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
          variant: 'secondary' as const,
          className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
        };
      case 'archived':
        return {
          label: 'Archivé',
          variant: 'destructive' as const,
          className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
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
