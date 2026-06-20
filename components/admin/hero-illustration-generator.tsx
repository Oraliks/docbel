'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface HeroIllustrationGeneratorProps {
  defaultSubject?: string;
  onUse: (url: string) => void;
  className?: string;
}

const MAX_SUBJECT = 280;

export function HeroIllustrationGenerator({
  defaultSubject,
  onUse,
  className,
}: HeroIllustrationGeneratorProps) {
  const [subject, setSubject] = useState(defaultSubject ?? '');
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runGeneration = useCallback(async () => {
    setError(null);
    setLoading(true);
    setGeneratedUrl(null);
    try {
      const res = await fetch('/api/admin/hero-illustration/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || 'La génération de l’illustration a échoué. Réessayez dans un instant.');
        return;
      }

      if (!json?.url) {
        setError('Réponse inattendue du service d’illustration.');
        return;
      }

      setGeneratedUrl(json.url as string);
    } catch {
      setError('Impossible de contacter le service d’illustration. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, [subject]);

  const handleUse = useCallback(() => {
    if (!generatedUrl) return;
    onUse(generatedUrl);
    toast.success('Illustration sélectionnée');
  }, [generatedUrl, onUse]);

  const canGenerate = !loading && subject.trim().length >= 3;

  return (
    <Card className={`border bg-card p-5 shadow-none gap-0 ${className ?? ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <label htmlFor="hero-illustration-subject" className="block text-sm font-semibold">
          Générer une illustration pour le hero
        </label>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        L&apos;IA produit une illustration 3D propre, sans texte, sur fond doux.
      </p>

      {/* Sujet */}
      <label
        htmlFor="hero-illustration-subject"
        className="text-xs font-medium text-muted-foreground mb-1 block"
      >
        Sujet de l&apos;illustration
      </label>
      <Textarea
        id="hero-illustration-subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT))}
        maxLength={MAX_SUBJECT}
        placeholder="Ex: le mandat eC3.2 pour aider à remplir la carte de chômage temporaire."
        rows={3}
        className="resize-y"
        disabled={loading}
      />
      <div className="mt-1 flex justify-end text-xs text-muted-foreground">
        {subject.length}/{MAX_SUBJECT}
      </div>

      {/* Erreur */}
      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bouton principal */}
      <div className="mt-4">
        <Button
          type="button"
          onClick={runGeneration}
          disabled={!canGenerate}
          className="gap-2 w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Génération en cours…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Générer l&apos;illustration
            </>
          )}
        </Button>
      </div>

      {/* Aperçu + actions */}
      {generatedUrl && (
        <div className="mt-4 space-y-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted/30">
            {/* This project deliberately renders generated/uploaded images with raw <img>, not next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={generatedUrl}
              alt="Aperçu de l'illustration générée"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleUse}
              className="gap-2 flex-1"
            >
              <Check className="w-4 h-4" />
              Utiliser cette illustration
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={runGeneration}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Régénérer
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
