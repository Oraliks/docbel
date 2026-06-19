'use client';

import { useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, RefreshCw, Check, Upload, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface FeaturedImageGeneratorProps {
  /** Article id. If absent, it is read from useParams() (key `newsId`) — may be "new". */
  articleId?: string;
  title?: string;
  defaultSummary?: string;
  onUse: (url: string) => void;
  className?: string;
}

const MAX_SUMMARY = 280;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 Mo
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export function FeaturedImageGenerator({
  articleId,
  title,
  defaultSummary,
  onUse,
  className,
}: FeaturedImageGeneratorProps) {
  const params = useParams();
  // Prefer the explicit prop, otherwise read the route param (`newsId`). Value can be "new".
  const paramId = typeof params?.newsId === 'string' ? params.newsId : undefined;
  const id = articleId ?? paramId;
  const hasRealId = Boolean(id) && id !== 'new';

  const [summary, setSummary] = useState(defaultSummary ?? '');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    // Reset the native input so re-selecting the same file fires onChange again.
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setReferenceFile(null);
      setError('Format non supporté. Utilisez PNG, JPEG ou WebP.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setReferenceFile(null);
      setError('Image de référence trop lourde (8 Mo maximum).');
      return;
    }
    setReferenceFile(file);
  }, []);

  const removeReference = useCallback(() => {
    setReferenceFile(null);
    setError(null);
  }, []);

  const runGeneration = useCallback(async () => {
    if (summary.trim() === '') {
      setError('Ajoutez un résumé visuel avant de générer l’image.');
      return;
    }
    if (!id) {
      setError('Impossible de déterminer l’article. Enregistrez le brouillon, puis réessayez.');
      return;
    }

    setError(null);
    setLoading(true);
    setGeneratedUrl(null);
    try {
      const fd = new FormData();
      fd.append('summary', summary);
      if (title) fd.append('title', title);
      if (referenceFile) fd.append('referenceImage', referenceFile);

      const res = await fetch(`/api/admin/news/${id}/featured-image/generate`, {
        method: 'POST',
        body: fd,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || 'La génération de l’image a échoué. Réessayez dans un instant.');
        return;
      }

      if (!json?.url) {
        setError('Réponse inattendue du service d’image.');
        return;
      }

      setGeneratedUrl(json.url as string);
    } catch {
      setError('Impossible de contacter le service d’image. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, [summary, title, referenceFile, id]);

  const handleUse = useCallback(async () => {
    if (!generatedUrl) return;
    onUse(generatedUrl);

    // For a new article (no real id) we only fill the form field; it is persisted
    // when the article itself is saved.
    if (!hasRealId) {
      toast.success('Image à la une appliquée. Enregistrez l’article pour la conserver.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/news/${id}/featured-image/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: generatedUrl }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.error || 'L’enregistrement de l’image a échoué.');
        toast.error('Impossible d’enregistrer l’image à la une.');
        return;
      }
      toast.success('Image définie comme image à la une');
    } catch {
      setError('Problème réseau lors de l’enregistrement de l’image.');
      toast.error('Impossible d’enregistrer l’image à la une.');
    } finally {
      setSaving(false);
    }
  }, [generatedUrl, onUse, hasRealId, id]);

  const canGenerate = !loading && summary.trim() !== '';

  return (
    <Card className={`border bg-card p-5 shadow-none gap-0 ${className ?? ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <label htmlFor="featured-image-summary" className="block text-sm font-semibold">
          Générer une image à la une
        </label>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Décrivez le sujet : l&apos;IA produit une bannière 16:9. Le titre est ajouté automatiquement.
      </p>

      {/* Résumé visuel */}
      <label
        htmlFor="featured-image-summary"
        className="text-xs font-medium text-muted-foreground mb-1 block"
      >
        Résumé visuel de l&apos;article
      </label>
      <Textarea
        id="featured-image-summary"
        value={summary}
        onChange={(e) => setSummary(e.target.value.slice(0, MAX_SUMMARY))}
        maxLength={MAX_SUMMARY}
        placeholder="Ex. : Nouvelle règle de cumul chômage et activité accessoire à partir de janvier."
        rows={3}
        className="resize-y"
        disabled={loading}
      />
      <div className="mt-1 flex justify-end text-xs text-muted-foreground">
        {summary.length}/{MAX_SUMMARY}
      </div>

      {/* Image de référence (optionnel) */}
      <div className="mt-3">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Image de référence (optionnel)
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        {referenceFile ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate flex-1" title={referenceFile.name}>
              {referenceFile.name}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={removeReference}
              disabled={loading}
              className="gap-1"
            >
              <X className="w-3 h-3" />
              Retirer
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Choisir une image
          </Button>
        )}
        <p className="mt-1 text-xs text-muted-foreground/70">
          PNG, JPEG ou WebP · max 8 Mo. Intégrée comme élément visuel (logo, vignette…).
        </p>
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
              Générer l&apos;image à la une
            </>
          )}
        </Button>
      </div>

      {/* Aperçu + actions */}
      {generatedUrl && (
        <div className="mt-4 space-y-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted/30">
            {/* This project deliberately renders generated/uploaded images with raw <img>, not next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={generatedUrl}
              alt="Aperçu de l'image à la une générée"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleUse}
              disabled={saving}
              className="gap-2 flex-1"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Utiliser cette image
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={runGeneration}
              disabled={loading || saving}
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
