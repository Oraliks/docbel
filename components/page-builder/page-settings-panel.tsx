'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PageSettingsPanelProps {
  title: string
  slug: string
  metaTitle: string | null
  metaDesc: string | null
  ogImage: string | null
  onTitleChange: (value: string) => void
  onSlugChange: (value: string) => void
  onMetaTitleChange: (value: string) => void
  onMetaDescChange: (value: string) => void
  onOgImageChange: (value: string) => void
}

export function PageSettingsPanel({
  title,
  slug,
  metaTitle,
  metaDesc,
  ogImage,
  onTitleChange,
  onSlugChange,
  onMetaTitleChange,
  onMetaDescChange,
  onOgImageChange,
}: PageSettingsPanelProps) {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="general">Général</TabsTrigger>
        <TabsTrigger value="seo">SEO</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-6 mt-0">
        <div className="space-y-2">
          <Label htmlFor="page-title" className="text-base font-medium">
            Titre de la page
          </Label>
          <Input
            id="page-title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Entrez le titre de la page"
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">
            Le titre apparaît dans le navigateur et les résultats de recherche
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="page-slug" className="text-base font-medium">
            URL de la page
          </Label>
          <div className="flex items-center">
            <span className="flex items-center justify-center h-10 px-3 bg-muted text-sm font-medium rounded-l border border-r-0 border-input">
              /
            </span>
            <Input
              id="page-slug"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              placeholder="mon-page"
              className="h-10 rounded-l-none"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Utilisez uniquement des lettres minuscules, chiffres et tirets
          </p>
        </div>
      </TabsContent>

      <TabsContent value="seo" className="space-y-6 mt-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="meta-title" className="text-base font-medium">
              Meta Title
            </Label>
            <span className="text-xs text-muted-foreground">
              {(metaTitle || '').length}/60
            </span>
          </div>
          <Input
            id="meta-title"
            value={metaTitle || ''}
            onChange={(e) => onMetaTitleChange(e.target.value)}
            placeholder={title || 'Titre pour les moteurs de recherche'}
            maxLength={60}
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">
            Affiché dans les résultats de recherche. Optimal: 50-60 caractères
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="meta-desc" className="text-base font-medium">
              Meta Description
            </Label>
            <span className="text-xs text-muted-foreground">
              {(metaDesc || '').length}/160
            </span>
          </div>
          <Textarea
            id="meta-desc"
            value={metaDesc || ''}
            onChange={(e) => onMetaDescChange(e.target.value)}
            placeholder="Description concise pour les moteurs de recherche"
            maxLength={160}
            rows={3}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Affiché sous le titre. Optimal: 150-160 caractères
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="og-image" className="text-base font-medium">
            Image de partage
          </Label>
          <Input
            id="og-image"
            value={ogImage || ''}
            onChange={(e) => onOgImageChange(e.target.value)}
            placeholder="https://exemple.com/image.jpg"
            type="url"
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">
            Affichée lors du partage sur les réseaux sociaux (1200×630px minimum)
          </p>
          {ogImage && (
            <div className="mt-4 rounded border bg-muted p-4 flex items-center justify-center">
              {/* OG previews accept arbitrary remote URLs from editors, so next/image remotePatterns are not appropriate here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ogImage}
                alt="Preview"
                className="max-w-sm max-h-64 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
