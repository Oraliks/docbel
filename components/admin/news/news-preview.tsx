'use client';

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
  return (
    <div className="space-y-6">
      <div className="text-sm font-semibold text-gray-500 uppercase">{category}</div>
      <h1 className="text-4xl font-bold text-gray-900">{title || 'Titre de l\'article'}</h1>

      <div className="flex gap-6 text-sm text-gray-600">
        <span>📅 Aujourd'hui</span>
        {readingTime && <span>⏱️ {readingTime} min de lecture</span>}
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
        <p className="text-gray-700 leading-relaxed">{excerpt || 'Votre description courte apparaîtra ici'}</p>

        {content && (
          <div className="mt-8 text-gray-800 whitespace-pre-wrap">
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
          <h3 className="font-semibold">Trouvez cette information utile?</h3>
        </CardHeader>
        <CardContent className="text-center text-sm text-gray-600">
          Partagez cet article avec votre réseau ou contactez-nous pour plus de précisions.
        </CardContent>
      </Card>
    </div>
  );
}
