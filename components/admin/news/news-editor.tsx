'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import dynamic from 'next/dynamic';
import { Folder, CheckCircle2, ImagePlus, X, Loader2 } from 'lucide-react';

// Tiptap = client-only (DOM requis). dynamic ssr:false évite l'hydratation SSR
// et sort l'éditeur riche (~250 Ko) du bundle initial de /admin/news/[newsId].
// Même pattern que components/admin/changelog-manager.tsx.
const RichTextEditor = dynamic(
  () =>
    import('@/components/docbel/rich-text-editor').then((m) => ({
      default: m.RichTextEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-md border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
        <Loader2 className="inline size-4 animate-spin mr-2" />
        Chargement de l&apos;éditeur…
      </div>
    ),
  }
);

interface CategoryData {
  id: string;
  name: string;
  color: string;
}

const STATUS_DOTS: Record<string, string> = {
  draft: 'bg-muted-foreground',
  published: 'bg-green-500',
  scheduled: 'bg-blue-500',
  archived: 'bg-red-500'
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  published: 'Publié',
  scheduled: 'Planifié',
  archived: 'Archivé'
};

export interface NewsEditorForm {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  emoji: string;
  color: string;
  image: string;
  status: string;
  featured: boolean;
  readingTime: number;
}

interface NewsEditorProps {
  form: NewsEditorForm;
  onFieldChange: (field: string, value: unknown) => void;
  errors?: Record<string, string>;
}

export function NewsEditor({ form, onFieldChange, errors = {} }: NewsEditorProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'seo'>('content');
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageDragging, setImageDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      alert('Type non supporté. Utilisez JPG, PNG, WebP ou GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Fichier trop volumineux. Taille maximale : 5 Mo.');
      return;
    }
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/image', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur upload');
      }
      const { url } = await res.json();
      onFieldChange('image', url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur lors du téléchargement');
    } finally {
      setImageUploading(false);
    }
  }, [onFieldChange]);

  // Load categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Compute word/character counts
  const plainText = form.content.replace(/<[^>]+>/g, '').trim();
  const wordCount = plainText.length > 0 ? plainText.split(/\s+/).length : 0;
  const charCount = plainText.length;

  // Get selected category color
  const selectedCategoryColor = categories.find(c => c.name === form.category)?.color || '#7C3AED';

  const tabs = [
    { id: 'content', label: 'Contenu' },
    { id: 'seo', label: 'SEO' }
  ] as const;

  return (
    <div className="space-y-6">
      {/* Custom Tabs */}
      <div className="flex border-b border-border gap-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 pt-0 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'content' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MAIN COLUMN */}
          <div className="lg:col-span-2 space-y-5">
            {/* Title */}
            <Card className={`border bg-card p-5 shadow-none gap-0 ${errors.title ? 'border-red-500' : ''}`}>
              <label className="block text-sm font-semibold mb-3">
                Titre <span className="text-red-600">*</span>
              </label>
              <Input
                value={form.title}
                onChange={(e) => onFieldChange('title', e.target.value)}
                placeholder="Titre de l'article"
                className={`h-11 ${errors.title ? 'border-red-500 focus:border-red-500' : ''}`}
              />
              {errors.title && <p className="text-red-600 text-sm mt-2">⚠️ {errors.title}</p>}
            </Card>

            {/* Content */}
            <Card className={`border bg-card p-5 shadow-none gap-0 ${errors.content ? 'border-red-500' : ''}`}>
              <label className="block text-sm font-semibold mb-3">
                Contenu <span className="text-red-600">*</span>
              </label>
              <div className={`rounded-md overflow-hidden border ${errors.content ? 'border-red-500' : 'border-border'}`}>
                <RichTextEditor
                  value={form.content}
                  onChange={(html) => onFieldChange('content', html)}
                  placeholder="Commencez à taper ou tapez / pour les commandes..."
                  showVersionHistory={false}
                />
              </div>
              {errors.content && <p className="text-red-600 text-sm mt-2">⚠️ {errors.content}</p>}
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>Temps de lecture : ~ {form.readingTime} min</span>
                <div className="flex items-center gap-2">
                  <span>{wordCount.toLocaleString('fr-FR')} mots • {charCount.toLocaleString('fr-FR')} caractères</span>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
              </div>
            </Card>

            {/* Excerpt */}
            <Card className={`border bg-card p-5 shadow-none gap-0 ${errors.excerpt ? 'border-red-500' : ''}`}>
              <label className="block text-sm font-semibold mb-3">
                Description courte <span className="text-red-600">*</span>
              </label>
              <Textarea
                value={form.excerpt}
                onChange={(e) => onFieldChange('excerpt', e.target.value)}
                placeholder="Courte description pour le résumé"
                rows={3}
                maxLength={160}
                className={`resize-y ${errors.excerpt ? 'border-red-500 focus:border-red-500' : ''}`}
              />
              {errors.excerpt && <p className="text-red-600 text-sm mt-2">⚠️ {errors.excerpt}</p>}
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Courte description utilisée dans les listes et les aperçus (recommandé : 120-160 caractères).</span>
                <span className="ml-4 whitespace-nowrap">{form.excerpt.length} / 160</span>
              </div>
            </Card>
          </div>

          {/* SIDEBAR COLUMN */}
          <div className="space-y-5">
            {/* Status */}
            <Card className="border bg-card p-5 shadow-none gap-0">
              <label className="block text-sm font-semibold mb-3">Statut</label>
              <Select value={form.status} onValueChange={(v) => onFieldChange('status', v)}>
                <SelectTrigger className="h-10 w-full">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOTS[form.status]}`}></span>
                    <span>{STATUS_LABELS[form.status]}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOTS[value]}`}></span>
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>

            {/* Category */}
            <Card className={`border bg-card p-5 shadow-none gap-0 ${errors.category ? 'border-red-500' : ''}`}>
              <label className="block text-sm font-semibold mb-3">
                Catégorie <span className="text-red-600">*</span>
              </label>
              <Select value={form.category} onValueChange={(v) => {
                onFieldChange('category', v);
                // Auto-set color based on category
                const cat = categories.find(c => c.name === v);
                if (cat) {
                  onFieldChange('color', cat.color);
                }
              }}>
                <SelectTrigger className={`h-10 w-full ${errors.category ? 'border-red-500' : ''}`}>
                  <div className="flex items-center gap-2">
                    {form.category && (
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: selectedCategoryColor }}
                      />
                    )}
                    <Folder className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {categoriesLoading ? (
                    <div className="p-2 text-sm text-muted-foreground">Chargement...</div>
                  ) : (
                    categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-red-600 text-sm mt-2">⚠️ {errors.category}</p>}
            </Card>

            {/* Image de présentation */}
            <Card className="border bg-card p-5 shadow-none gap-0">
              <label className="block text-sm font-semibold mb-3">Image de présentation</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                  e.target.value = '';
                }}
              />
              {form.image ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  {/* The preview may point to any uploaded or external URL and is intentionally rendered without next/image. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.image}
                    alt="Image de présentation"
                    className="w-full h-36 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onFieldChange('image', '')}
                    className="absolute top-2 right-2 bg-card rounded-full p-1 shadow-md hover:bg-destructive/10 transition-colors"
                    title="Supprimer l'image"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={imageUploading}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setImageDragging(true); }}
                  onDragLeave={() => setImageDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setImageDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  className={`w-full border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 transition-colors cursor-pointer ${
                    imageDragging
                      ? 'border-primary/60 bg-primary/5'
                      : 'border-input hover:border-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {imageUploading ? (
                    <Loader2 className="w-7 h-7 text-muted-foreground animate-spin" />
                  ) : (
                    <ImagePlus className="w-7 h-7 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {imageUploading ? 'Téléchargement...' : 'Cliquer ou glisser une image'}
                  </span>
                  <span className="text-xs text-muted-foreground/70">JPG, PNG, WebP, GIF · max 5 Mo</span>
                </button>
              )}
            </Card>

            {/* Options */}
            <Card className="border bg-card p-5 shadow-none gap-0">
              <label className="block text-sm font-semibold mb-3">Options</label>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={form.featured}
                  onCheckedChange={(checked) => onFieldChange('featured', checked === true)}
                  className="mt-0.5"
                />
                <span className="text-sm">Mettre en avant</span>
              </label>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Les articles mis en avant seront affichés en priorité dans les listes.
              </p>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'seo' && (
        <Card className="border bg-card p-8 shadow-none">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">SEO</h2>
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-semibold mb-3">Slug</label>
              <Input
                value={form.slug}
                onChange={(e) => onFieldChange('slug', e.target.value)}
                placeholder="slug-article"
                className="h-10 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                URL conviviale de l&apos;article. Utilisée des liens minuscules, chiffres et tirets.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
