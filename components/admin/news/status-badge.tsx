'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
  onClick?: () => void;
}

export function StatusBadge({ status, onClick }: StatusBadgeProps) {
  const t = useTranslations('admin.news');
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'published':
        return {
          label: t('status', { status }),
          variant: 'success' as const,
          className: ''
        };
      case 'draft':
        return {
          label: t('status', { status }),
          variant: 'outline' as const,
          className: 'bg-muted text-muted-foreground'
        };
      case 'scheduled':
        return {
          label: t('status', { status }),
          variant: 'info' as const,
          className: ''
        };
      case 'archived':
        return {
          label: t('status', { status }),
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
