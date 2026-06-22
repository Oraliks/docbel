'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface NewsPreviewProps {
  title: string;
  emoji: string;
  category: string;
  excerpt: string;
  content: string;
  color: string;
  readingTime?: number | null;
}

export function NewsPreview({
  title,
  emoji,
  category,
  excerpt,
  content,
  color,
  readingTime
}: NewsPreviewProps) {
  const t = useTranslations('admin.news');
  return (
    <div className="space-y-6">
      <div className="text-sm font-semibold text-muted-foreground uppercase">{category}</div>
      <h1 className="text-4xl font-bold text-foreground">{title || t('previewTitlePlaceholder')}</h1>

      <div className="flex gap-6 text-sm text-muted-foreground">
        <span>📅 {t('previewToday')}</span>
        {readingTime && <span>⏱️ {t('previewReadingTime', { minutes: readingTime })}</span>}
      </div>

      <div className="flex justify-center py-12">
        <div
          className="w-32 h-32 rounded-lg flex items-center justify-center text-6xl"
          style={{ backgroundColor: `${color}20`, border: `2px solid ${color}40` }}
        >
          {emoji}
        </div>
      </div>

      <div className="prose prose-sm max-w-none">
        <p className="text-foreground leading-relaxed">{excerpt || t('previewExcerptPlaceholder')}</p>

        {content && (
          <div className="mt-8 text-foreground whitespace-pre-wrap">
            {content.split('\n').map((paragraph, idx) => (
              <p key={idx} className="mb-4">
                {paragraph}
              </p>
            ))}
          </div>
        )}
      </div>

      <Card className="mt-12">
        <CardHeader className="text-center">
          <h3 className="font-semibold">{t('previewHelpfulTitle')}</h3>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          {t('previewHelpfulBody')}
        </CardContent>
      </Card>
    </div>
  );
}
