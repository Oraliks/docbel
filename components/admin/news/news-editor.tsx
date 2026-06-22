'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
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
import { Folder, CheckCircle2, X, Loader2 } from 'lucide-react';
import { HeroIllustrationGenerator } from '@/components/admin/hero-illustration-generator';

// Tiptap = client-only (DOM requis). dynamic ssr:false évite l'hydratation SSR
// et sort l'éditeur riche (~250 Ko) du bundle initial de /admin/news/[newsId].
// Même pattern que components/admin/changelog-manager.tsx.
function EditorLoading() {
  const t = useTranslations('admin.news');
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
      <Loader2 className="inline size-4 animate-spin mr-2" />
      {t('editorLoading')}
    </div>
  );
}

const RichTextEditor = dynamic(
  () =>
    import('@/components/docbel/rich-text-editor').then((m) => ({
      default: m.RichTextEditor,
    })),
  {
    ssr: false,
    loading: () => <EditorLoading />,
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

const STATUS_KEYS = ['draft', 'published', 'scheduled', 'archived'] as const;

export interface NewsEditorForm {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  emoji: string;
  color: string;
  image: string;
  heroIllustration: string;
  status: string;
  featured: boolean;
  readingTime: number;
  keyTakeaway: string;
  summary: string[];
  linkedDocs: { title: string; url: string }[];
  faqs: { q: string; a: string }[];
}

interface NewsEditorProps {
  form: NewsEditorForm;
  onFieldChange: (field: string, value: unknown) => void;
  errors?: Record<string, string>;
}

export function NewsEditor({ form, onFieldChange, errors = {} }: NewsEditorProps) {
  const t = useTranslations('admin.news');
  const [activeTab, setActiveTab] = useState<'content' | 'seo'>('content');
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
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
    { id: 'content', label: t('tabContent') },
    { id: 'seo', label: t('tabSeo') }
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
                {t('fieldTitle')} <span className="text-red-600">*</span>
              </label>
              <Input
                value={form.title}
                onChange={(e) => onFieldChange('title', e.target.value)}
                placeholder={t('fieldTitlePlaceholder')}
                className={`h-11 ${errors.title ? 'border-red-500 focus:border-red-500' : ''}`}
              />
              {errors.title && <p className="text-red-600 text-sm mt-2">⚠️ {errors.title}</p>}
            </Card>

            {/* Content */}
            <Card className={`border bg-card p-5 shadow-none gap-0 ${errors.content ? 'border-red-500' : ''}`}>
              <label className="block text-sm font-semibold mb-3">
                {t('fieldContent')} <span className="text-red-600">*</span>
              </label>
              <div className={`rounded-md overflow-hidden border ${errors.content ? 'border-red-500' : 'border-border'}`}>
                <RichTextEditor
                  value={form.content}
                  onChange={(html) => onFieldChange('content', html)}
                  placeholder={t('contentPlaceholder')}
                  showVersionHistory={false}
                />
              </div>
              {errors.content && <p className="text-red-600 text-sm mt-2">⚠️ {errors.content}</p>}
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('readingTime', { minutes: form.readingTime })}</span>
                <div className="flex items-center gap-2">
                  <span>{t('wordCharCount', { words: wordCount, chars: charCount })}</span>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
              </div>
            </Card>

            {/* Excerpt */}
            <Card className={`border bg-card p-5 shadow-none gap-0 ${errors.excerpt ? 'border-red-500' : ''}`}>
              <label className="block text-sm font-semibold mb-3">
                {t('fieldExcerpt')} <span className="text-red-600">*</span>
              </label>
              <Textarea
                value={form.excerpt}
                onChange={(e) => onFieldChange('excerpt', e.target.value)}
                placeholder={t('excerptPlaceholder')}
                rows={3}
                maxLength={160}
                className={`resize-y ${errors.excerpt ? 'border-red-500 focus:border-red-500' : ''}`}
              />
              {errors.excerpt && <p className="text-red-600 text-sm mt-2">⚠️ {errors.excerpt}</p>}
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('excerptHelp')}</span>
                <span className="ml-4 whitespace-nowrap">{t('excerptCounter', { count: form.excerpt.length })}</span>
              </div>
            </Card>

            {/* ── Compléments ── */}

            {/* À retenir */}
            <Card className="border bg-card p-5 shadow-none gap-0">
              <label className="block text-sm font-semibold mb-1">{t('fieldKeyTakeaway')}</label>
              <p className="text-xs text-muted-foreground mb-3">
                {t('keyTakeawayHelp')}
              </p>
              <Textarea
                value={form.keyTakeaway}
                onChange={(e) => onFieldChange('keyTakeaway', e.target.value)}
                placeholder={t('keyTakeawayPlaceholder')}
                rows={3}
                className="resize-y"
              />
            </Card>

            {/* Résumé en 30 sec */}
            <Card className="border bg-card p-5 shadow-none gap-0">
              <label className="block text-sm font-semibold mb-1">{t('fieldSummary')}</label>
              <p className="text-xs text-muted-foreground mb-3">
                {t('summaryHelp')}
              </p>
              <div className="space-y-2">
                {form.summary.map((bullet, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs select-none">•</span>
                    <Input
                      value={bullet}
                      onChange={(e) => {
                        const next = [...form.summary];
                        next[idx] = e.target.value;
                        onFieldChange('summary', next);
                      }}
                      placeholder={t('summaryBulletPlaceholder', { index: idx + 1 })}
                      className="h-9 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = form.summary.filter((_, i) => i !== idx);
                        onFieldChange('summary', next);
                      }}
                      className="shrink-0 p-1 rounded hover:bg-destructive/10 transition-colors"
                      title={t('summaryRemoveBullet')}
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onFieldChange('summary', [...form.summary, ''])}
                className="mt-3 text-sm text-primary hover:underline flex items-center gap-1"
              >
                {t('summaryAddBullet')}
              </button>
            </Card>

            {/* Documents liés */}
            <Card className="border bg-card p-5 shadow-none gap-0">
              <label className="block text-sm font-semibold mb-1">{t('fieldLinkedDocs')}</label>
              <p className="text-xs text-muted-foreground mb-3">
                {t('linkedDocsHelp')}
              </p>
              <div className="space-y-3">
                {form.linkedDocs.map((doc, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        value={doc.title}
                        onChange={(e) => {
                          const next = form.linkedDocs.map((d, i) =>
                            i === idx ? { ...d, title: e.target.value } : d
                          );
                          onFieldChange('linkedDocs', next);
                        }}
                        placeholder={t('linkedDocTitlePlaceholder')}
                        className="h-9"
                      />
                      <Input
                        value={doc.url}
                        onChange={(e) => {
                          const next = form.linkedDocs.map((d, i) =>
                            i === idx ? { ...d, url: e.target.value } : d
                          );
                          onFieldChange('linkedDocs', next);
                        }}
                        placeholder="https://…"
                        className="h-9"
                        type="url"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = form.linkedDocs.filter((_, i) => i !== idx);
                        onFieldChange('linkedDocs', next);
                      }}
                      className="shrink-0 p-1 mt-0.5 rounded hover:bg-destructive/10 transition-colors"
                      title={t('linkedDocRemove')}
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onFieldChange('linkedDocs', [...form.linkedDocs, { title: '', url: '' }])}
                className="mt-3 text-sm text-primary hover:underline flex items-center gap-1"
              >
                {t('linkedDocAdd')}
              </button>
            </Card>

            {/* Questions fréquentes */}
            <Card className="border bg-card p-5 shadow-none gap-0">
              <label className="block text-sm font-semibold mb-1">{t('fieldFaqs')}</label>
              <p className="text-xs text-muted-foreground mb-3">
                {t('faqsHelp')}
              </p>
              <div className="space-y-4">
                {form.faqs.map((faq, idx) => (
                  <div key={idx} className="border border-border rounded-md p-3 space-y-2 relative">
                    <button
                      type="button"
                      onClick={() => {
                        const next = form.faqs.filter((_, i) => i !== idx);
                        onFieldChange('faqs', next);
                      }}
                      className="absolute top-2 right-2 p-1 rounded hover:bg-destructive/10 transition-colors"
                      title={t('faqRemove')}
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        {t('faqQuestion')}
                      </label>
                      <Input
                        value={faq.q}
                        onChange={(e) => {
                          const next = form.faqs.map((f, i) =>
                            i === idx ? { ...f, q: e.target.value } : f
                          );
                          onFieldChange('faqs', next);
                        }}
                        placeholder={t('faqQuestionPlaceholder')}
                        className="h-9 pr-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        {t('faqAnswer')}
                      </label>
                      <Textarea
                        value={faq.a}
                        onChange={(e) => {
                          const next = form.faqs.map((f, i) =>
                            i === idx ? { ...f, a: e.target.value } : f
                          );
                          onFieldChange('faqs', next);
                        }}
                        placeholder={t('faqAnswerPlaceholder')}
                        rows={3}
                        className="resize-y"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onFieldChange('faqs', [...form.faqs, { q: '', a: '' }])}
                className="mt-3 text-sm text-primary hover:underline flex items-center gap-1"
              >
                {t('faqAdd')}
              </button>
            </Card>
          </div>

          {/* SIDEBAR COLUMN */}
          <div className="space-y-5">
            {/* Status */}
            <Card className="border bg-card p-5 shadow-none gap-0">
              <label className="block text-sm font-semibold mb-3">{t('fieldStatus')}</label>
              <Select value={form.status} onValueChange={(v) => onFieldChange('status', v)}>
                <SelectTrigger className="h-10 w-full">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOTS[form.status]}`}></span>
                    <span>{t('status', { status: form.status })}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_KEYS.map((value) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOTS[value]}`}></span>
                        {t('status', { status: value })}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>

            {/* Category */}
            <Card className={`border bg-card p-5 shadow-none gap-0 ${errors.category ? 'border-red-500' : ''}`}>
              <label className="block text-sm font-semibold mb-3">
                {t('fieldCategory')} <span className="text-red-600">*</span>
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
                    <SelectValue placeholder={t('categorySelectPlaceholder')} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {categoriesLoading ? (
                    <div className="p-2 text-sm text-muted-foreground">{t('loading')}</div>
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

            {/* Illustration de l'article — image unique (hero + listes + partage) */}
            <Card className={`border bg-card p-5 shadow-none gap-0 ${errors.heroIllustration ? 'border-red-500' : ''}`}>
              <label className="block text-sm font-semibold mb-3">
                {t('fieldHeroIllustration')} <span className="text-red-600">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                {t.rich('heroIllustrationHelp', {
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
              <label
                htmlFor="hero-illustration-url"
                className="text-xs font-medium text-muted-foreground mb-1 block"
              >
                {t('heroIllustrationUrlLabel')}
              </label>
              <Input
                id="hero-illustration-url"
                value={form.heroIllustration}
                onChange={(e) => onFieldChange('heroIllustration', e.target.value)}
                placeholder="https://…/hero.png"
                type="url"
                className={`h-10 ${errors.heroIllustration ? 'border-red-500 focus:border-red-500' : ''}`}
              />
              {errors.heroIllustration && (
                <p className="text-red-600 text-sm mt-2">⚠️ {errors.heroIllustration}</p>
              )}
              {form.heroIllustration && (
                <div className="mt-3 aspect-square w-32 overflow-hidden rounded-lg border border-border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.heroIllustration}
                    alt={t('heroIllustrationPreviewAlt')}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <HeroIllustrationGenerator
                defaultSubject={form.excerpt || form.title}
                onUse={(url) => onFieldChange('heroIllustration', url)}
                className="mt-4"
              />
            </Card>

            {/* Options */}
            <Card className="border bg-card p-5 shadow-none gap-0">
              <label className="block text-sm font-semibold mb-3">{t('fieldOptions')}</label>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={form.featured}
                  onCheckedChange={(checked) => onFieldChange('featured', checked === true)}
                  className="mt-0.5"
                />
                <span className="text-sm">{t('featuredOption')}</span>
              </label>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                {t('featuredHelp')}
              </p>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'seo' && (
        <Card className="border bg-card p-8 shadow-none">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">{t('tabSeo')}</h2>
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-semibold mb-3">{t('fieldSlug')}</label>
              <Input
                value={form.slug}
                onChange={(e) => onFieldChange('slug', e.target.value)}
                placeholder={t('slugPlaceholder')}
                className="h-10 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                {t('slugHelp')}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
