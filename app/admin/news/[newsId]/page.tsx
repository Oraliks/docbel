'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, Save, Send, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { NewsEditor } from '@/components/admin/news/news-editor';
import { PublishDialog } from '@/components/admin/news/publish-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { slugify } from '@/lib/news/slug';

interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  category: string;
  emoji: string;
  color: string;
  image: string | null;
  status: string;
  featured: boolean;
  readingTime: number;
  views: number;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  keyTakeaway?: string;
  summary?: string[];
  linkedDocs?: { title: string; url: string }[];
  faqs?: { q: string; a: string }[];
}

const generateSlug = (title: string) => slugify(title);

const calculateReadingTime = (content: string) => {
  const text = content.replace(/<[^>]+>/g, '').trim();
  const words = text.length > 0 ? text.split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 200));
};

// Validation function that returns field-specific errors
const validateForm = (
  form: { title: string; excerpt: string; content: string; category: string },
  t: (key: string) => string
): Record<string, string> => {
  const newErrors: Record<string, string> = {};

  if (!form.title?.trim()) {
    newErrors.title = t('errTitleRequired');
  }
  if (!form.excerpt?.trim()) {
    newErrors.excerpt = t('errExcerptRequired');
  }
  if (!form.content?.trim()) {
    newErrors.content = t('errContentRequired');
  }
  if (!form.category?.trim()) {
    newErrors.category = t('errCategoryRequired');
  }

  return newErrors;
};

export default function NewsEditorPage() {
  const t = useTranslations('admin.news');
  const params = useParams();
  const router = useRouter();
  const newsId = params.newsId as string;
  const isNew = newsId === 'new';

  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(isNew ? null : newsId);

  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    category: '',
    emoji: '📰',
    color: '#7C3AED',
    image: '',
    status: 'draft',
    featured: false,
    readingTime: 0,
    keyTakeaway: '',
    summary: [] as string[],
    linkedDocs: [] as { title: string; url: string }[],
    faqs: [] as { q: string; a: string }[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch existing article
  useEffect(() => {
    if (isNew) return;
    const fetchArticle = async () => {
      try {
        const res = await fetch(`/api/news/${newsId}`);
        if (!res.ok) throw new Error('Article not found');
        const data: NewsArticle = await res.json();
        setForm({
          title: data.title || '',
          slug: data.slug || '',
          excerpt: data.excerpt || '',
          content: data.content || '',
          category: data.category || '',
          emoji: data.emoji || '📰',
          color: data.color || '#7C3AED',
          image: data.image || '',
          status: data.status || 'draft',
          featured: data.featured || false,
          readingTime: data.readingTime || 0,
          keyTakeaway: data.keyTakeaway || '',
          summary: Array.isArray(data.summary) ? data.summary : [],
          linkedDocs: Array.isArray(data.linkedDocs) ? data.linkedDocs : [],
          faqs: Array.isArray(data.faqs) ? data.faqs : [],
        });
        setCurrentId(data.id);
      } catch (error) {
        console.error('Error fetching article:', error);
        toast.error(t('toastLoadError'));
        router.push('/admin/news');
      } finally {
        setIsLoading(false);
      }
    };
    fetchArticle();
  }, [newsId, isNew, router, t]);

  const handleFieldChange = useCallback((field: string, value: unknown) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'title' && !currentId) {
        updated.slug = generateSlug(typeof value === 'string' ? value : '');
      }
      if (field === 'content') {
        updated.readingTime = calculateReadingTime(typeof value === 'string' ? value : '');
      }
      return updated;
    });
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    setUnsavedChanges(true);
  }, [currentId, errors]);

  // Save (create or update)
  const handleSave = useCallback(async (): Promise<NewsArticle | null> => {
    const newErrors = validateForm(form, t);

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return null;
    }

    setErrors({});

    setIsSaving(true);
    const loadingToast = toast.loading(t('toastSaving'));
    try {
      const url = currentId ? `/api/news/${currentId}` : '/api/news';
      const method = currentId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const issueDetail = Array.isArray(errData.issues) && errData.issues.length > 0
          ? ` (${errData.issues.map((i: { path?: (string | number)[]; message?: string }) => `${i.path?.join('.') ?? ''}: ${i.message ?? ''}`).join('; ')})`
          : '';
        throw new Error(`${errData.error || t('toastSaveError')}${issueDetail}`);
      }

      const saved: NewsArticle = await res.json();
      setUnsavedChanges(false);
      setLastSavedAt(new Date());

      toast.dismiss(loadingToast);
      toast.success(currentId ? t('toastSaved') : t('toastCreated'));

      if (!currentId) {
        // First save: navigate to the new article URL
        setCurrentId(saved.id);
        window.history.replaceState({}, '', `/admin/news/${saved.id}`);
      }
      // Sync state with backend response
      setForm((prev) => ({
        ...prev,
        status: saved.status,
        slug: saved.slug,
        readingTime: saved.readingTime
      }));
      return saved;
    } catch (error) {
      console.error('Error saving article:', error);
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : t('toastSaveError'));
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [form, currentId, t]);

  // Actually publish (called from PublishDialog)
  const publishArticle = useCallback(async (idOverride?: string) => {
    const articleId = idOverride ?? currentId;
    if (!articleId) {
      toast.error(t('toastPublishNotSaved'));
      return;
    }
    const loadingToast = toast.loading(t('toastPublishing'));
    try {
      const res = await fetch(`/api/news/${articleId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(t('toastPublishFailed'));
      await res.json();
      setForm((prev) => ({ ...prev, status: 'published' }));
      setLastSavedAt(new Date());
      toast.dismiss(loadingToast);
      toast.success(t('toastPublished'));
      setShowPublishDialog(false);
    } catch (error) {
      console.error('Error publishing:', error);
      toast.dismiss(loadingToast);
      toast.error(t('toastPublishError'));
      throw error;
    }
  }, [currentId, t]);

  // Publish now (directly without dialog)
  const handlePublishNow = useCallback(async () => {
    const newErrors = validateForm(form, t);

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    // Always save before publishing to ensure latest content is used
    let articleId = currentId;
    if (unsavedChanges || !currentId) {
      const saved = await handleSave();
      if (!saved) return;
      articleId = saved.id;
    }
    await publishArticle(articleId ?? undefined);
  }, [form, unsavedChanges, currentId, handleSave, publishArticle]);

  // Open schedule dialog
  const handleOpenSchedule = useCallback(async () => {
    const newErrors = validateForm(form, t);

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    // Always save before scheduling to ensure latest content is used
    if (unsavedChanges || !currentId) {
      const saved = await handleSave();
      if (!saved) return;
    }
    setShowPublishDialog(true);
  }, [form, unsavedChanges, currentId, handleSave]);

  // Schedule (called from PublishDialog) — uses dedicated /schedule endpoint
  const scheduleArticle = useCallback(async (date: string, time: string) => {
    if (!currentId) {
      toast.error(t('toastScheduleNotSaved'));
      return;
    }
    const loadingToast = toast.loading(t('toastScheduling'));
    try {
      const scheduledAt = new Date(`${date}T${time}`).toISOString();
      const res = await fetch(`/api/news/${currentId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt }),
      });
      if (!res.ok) throw new Error(t('toastScheduleFailed'));
      const updated: NewsArticle = await res.json();
      setForm((prev) => ({ ...prev, status: updated.status }));
      setLastSavedAt(new Date());
      toast.dismiss(loadingToast);
      toast.success(t('toastScheduled', { date: new Date(scheduledAt).toLocaleString('fr-FR') }));
      setShowPublishDialog(false);
    } catch (error) {
      console.error('Error scheduling:', error);
      toast.dismiss(loadingToast);
      toast.error(t('toastScheduleError'));
      throw error;
    }
  }, [currentId, t]);

  // Unpublish (revert to draft) — uses dedicated /unpublish endpoint
  const handleUnpublish = useCallback(async () => {
    if (!currentId) return;
    const loadingToast = toast.loading(t('toastUnpublishing'));
    try {
      const res = await fetch(`/api/news/${currentId}/unpublish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(t('toastUnpublishFailed'));
      setForm((prev) => ({ ...prev, status: 'draft' }));
      toast.dismiss(loadingToast);
      toast.success(t('toastUnpublished'));
    } catch (error) {
      console.error('Error unpublishing:', error);
      toast.dismiss(loadingToast);
      toast.error(t('toastUnpublishError'));
    }
  }, [currentId, t]);

  const handlePreview = useCallback(() => {
    if (!currentId || !form.slug) {
      toast.error(t('toastPreviewNotSaved'));
      return;
    }
    try {
      window.open(`/actualites/${form.slug}`, '_blank');
      toast.success(t('toastPreviewOpening'));
    } catch {
      toast.error(t('toastPreviewError'));
    }
  }, [currentId, form.slug, t]);

  // Format last saved time
  const lastSavedLabel = lastSavedAt
    ? t('savedAt', { time: lastSavedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) })
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-card border-b">
        <div className="px-8 py-4 flex items-center justify-between">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (unsavedChanges && !confirm(t('leaveConfirm'))) {
                  return;
                }
                router.push('/admin/news');
              }}
              className="gap-2 h-9"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('back')}
            </Button>
            <div>
              <h1 className="text-2xl font-bold leading-tight">
                {isNew && !currentId ? t('newArticle') : t('editArticle')}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                {form.title || (isNew ? t('newArticleSubtitle') : t('articleSubtitle'))}
                {unsavedChanges && (
                  <span className="text-orange-600 font-medium">• {t('unsavedChanges')}</span>
                )}
                {!unsavedChanges && lastSavedLabel && (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {lastSavedLabel}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9"
              onClick={handlePreview}
            >
              <Eye className="w-4 h-4" />
              {t('preview')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="w-4 h-4" />
              {isSaving ? t('savingShort') : t('saveDraft')}
            </Button>
            <div className="flex">
              <Button
                size="sm"
                className="gap-2 h-9 bg-red-600 hover:bg-red-700 rounded-r-none border-r border-red-700"
                onClick={handlePublishNow}
                disabled={isSaving}
              >
                <Send className="w-4 h-4" />
                {t('publish')}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger className="h-9 px-2 bg-red-600 hover:bg-red-700 rounded-r-md inline-flex items-center justify-center text-white transition-colors">
                  <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleOpenSchedule}>
                    <Eye className="w-4 h-4 mr-2" />
                    {t('schedulePublication')}
                  </DropdownMenuItem>
                  {form.status === 'published' && (
                    <DropdownMenuItem onClick={handleUnpublish}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      {t('revertToDraft')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-6">
        <NewsEditor
          form={form}
          onFieldChange={handleFieldChange}
          errors={errors}
        />
      </div>

      {/* Schedule Dialog */}
      <PublishDialog
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        title={form.title}
        category={form.category}
        isPublished={form.status === 'published'}
        onPublish={publishArticle}
        onSchedule={scheduleArticle}
      />
    </div>
  );
}
