'use client'

import React from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  BlockProps,
  HeadingProps,
  TextProps,
  QuoteProps,
  DividerProps,
  SpacerProps,
  ImageProps,
  VideoProps,
  GalleryProps,
  EmbedProps,
  SectionProps,
  ContainerProps,
  ColumnsProps,
  HeroProps,
  FeaturesProps,
  CtaProps,
  FaqProps,
  TestimonialProps,
  StatsProps,
} from '@/lib/page-builder/types'
import { Field, Group, Pills, ColorControl, SliderControl } from './controls'
import { ImageUpload } from './image-upload'
import { DocumentUpload as VideoUpload } from './document-upload'
import { RichTextInput } from './rich-text-input'
import { IconPicker } from './icon-picker'
import { BLOCK_REGISTRY } from '@/lib/page-builder/block-registry'
import {
  CardFields,
  AccordionFields,
  TabsFields,
  AlertFields,
  BadgesFields,
  ProgressFields,
  ButtonGroupFields,
  DocumentFields,
  StepsFields,
  OrganismeFields,
  GlossaryFields,
  CounterFields,
  CollectionFields,
  FormFields,
} from './content-tab-extra'
import {
  CodeBlockFields,
  PullQuoteFields,
  DropCapFields,
  DefinitionListFields,
  HighlightFields,
  ProsConsFields,
  ChecklistFields,
  AudioFields,
  CarouselFields,
  BeforeAfterFields,
  LogoWallFields,
  SvgIllustrationFields,
  BarChartFields,
  LineChartFields,
  PieChartFields,
  KpiCardFields,
  SparklineFields,
  ChronologyFields,
  PricingTableFields,
  CompareTableFields,
  CountdownFields,
  NotificationBarFields,
  NewsletterFields,
  TrustBadgesFields,
  PressMentionsFields,
  StarRatingFields,
  QuizFields,
  PollFields,
  CalculatorFields,
  ReactionsFields,
  ShareButtonsFields,
  OpeningHoursFields,
  LastUpdatedFields,
  TableOfContentsFields,
  AnchorMenuFields,
  ArticleHeaderFields,
  AuthorBioFields,
  SponsoredDisclosureFields,
  BelgianDateHelperFields,
  TarifsTableFields,
  EligibilityTestFields,
  LawCitationFields,
  CasePracticeFields,
  RequiredDocsFields,
  LegalDelayFields,
  HtmlRawFields,
  CustomCssFields,
  GdprNoticeFields,
  MapEmbedFields,
  MarqueeFields,
  TiltCardFields,
  ImageHotspotsFields,
  GenericPropsFields,
} from './content-tab-extra2'

// ───────────────────────────── helpers ─────────────────────────────

function PropsHeader({ block }: { block: BlockProps }) {
  const meta = BLOCK_REGISTRY[block.type]
  return (
    <div className="px-4 py-3 border-b">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {meta.name}
      </div>
      <div className="text-[11px] text-muted-foreground/70">{meta.description}</div>
    </div>
  )
}

function VariantPicker({
  block,
  onPropChange,
}: {
  block: BlockProps
  onPropChange: (props: Record<string, unknown>) => void
}) {
  const meta = BLOCK_REGISTRY[block.type]
  if (!meta.variants || meta.variants.length === 0) return null
  const props = block.props as { variant?: string }
  return (
    <Group title="Style" defaultOpen>
      <Field label="Variante">
        <Pills
          value={props.variant ?? meta.variants[0].id}
          onChange={(v) => onPropChange({ variant: v })}
          options={meta.variants.map((v) => ({ value: v.id, label: v.name }))}
        />
      </Field>
    </Group>
  )
}

// ───────────────────────────── per-block forms ─────────────────────────────

function HeadingFields({
  props,
  onChange,
}: {
  props: HeadingProps
  onChange: (props: Partial<HeadingProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Texte">
        <Input value={props.text} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Niveau">
        <Pills
          value={props.level}
          onChange={(v) => onChange({ level: v as HeadingProps['level'] })}
          options={([1, 2, 3, 4, 5, 6] as const).map((n) => ({
            value: n,
            label: `H${n}`,
          }))}
        />
      </Field>
    </Group>
  )
}

function TextFields({
  props,
  onChange,
}: {
  props: TextProps
  onChange: (props: Partial<TextProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Texte">
        <RichTextInput
          value={props.html}
          onChange={(html) => onChange({ html })}
          placeholder="Commencez à écrire…"
        />
      </Field>
    </Group>
  )
}

function QuoteFields({
  props,
  onChange,
}: {
  props: QuoteProps
  onChange: (props: Partial<QuoteProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Citation">
        <Textarea
          value={props.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={3}
          className="resize-y"
        />
      </Field>
      <Field label="Auteur">
        <Input
          value={props.author ?? ''}
          onChange={(e) => onChange({ author: e.target.value })}
        />
      </Field>
      <Field label="Fonction">
        <Input
          value={props.role ?? ''}
          onChange={(e) => onChange({ role: e.target.value })}
        />
      </Field>
    </Group>
  )
}

function DividerFields({
  props,
  onChange,
}: {
  props: DividerProps
  onChange: (props: Partial<DividerProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Épaisseur">
        <SliderControl
          value={props.thickness ?? 1}
          onChange={(v) => onChange({ thickness: v })}
          min={1}
          max={10}
          suffix="px"
        />
      </Field>
    </Group>
  )
}

function SpacerFields({
  props,
  onChange,
}: {
  props: SpacerProps
  onChange: (props: Partial<SpacerProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Hauteur">
        <SliderControl
          value={props.height}
          onChange={(v) => onChange({ height: v })}
          min={0}
          max={400}
          suffix="px"
        />
      </Field>
    </Group>
  )
}

function ImageFields({
  props,
  onChange,
}: {
  props: ImageProps
  onChange: (props: Partial<ImageProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Image">
        <ImageUpload value={props.url} onChange={(url) => onChange({ url })} />
      </Field>
      <Field label="Texte alternatif">
        <Input
          value={props.alt}
          onChange={(e) => onChange({ alt: e.target.value })}
          placeholder="Description de l'image"
        />
      </Field>
      <Field label="Légende">
        <Input
          value={props.caption ?? ''}
          onChange={(e) => onChange({ caption: e.target.value })}
        />
      </Field>
      <Field label="Ratio">
        <Select
          value={props.ratio ?? 'auto'}
          onValueChange={(v) => onChange({ ratio: v as ImageProps['ratio'] })}
        >
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="1:1">Carré (1:1)</SelectItem>
            <SelectItem value="4:3">Standard (4:3)</SelectItem>
            <SelectItem value="16:9">Cinéma (16:9)</SelectItem>
            <SelectItem value="21:9">Ultra-wide (21:9)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Ajustement">
        <Pills
          value={props.fit ?? 'cover'}
          onChange={(v) => onChange({ fit: v })}
          options={[
            { value: 'cover', label: 'Cover' },
            { value: 'contain', label: 'Contain' },
          ]}
        />
      </Field>
      <Field label="Coins arrondis">
        <Pills
          value={props.rounded ?? 'md'}
          onChange={(v) => onChange({ rounded: v })}
          options={[
            { value: 'none', label: 'Aucun' },
            { value: 'sm', label: 'Sm' },
            { value: 'md', label: 'Md' },
            { value: 'lg', label: 'Lg' },
            { value: 'full', label: 'Full' },
          ]}
        />
      </Field>
    </Group>
  )
}

function VideoFields({
  props,
  onChange,
}: {
  props: VideoProps
  onChange: (props: Partial<VideoProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Source">
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { value: 'youtube', label: 'YouTube', emoji: '▶️' },
              { value: 'vimeo', label: 'Vimeo', emoji: '🎬' },
              { value: 'tiktok', label: 'TikTok', emoji: '🎵' },
              { value: 'dailymotion', label: 'Dailymotion', emoji: '📺' },
              { value: 'loom', label: 'Loom', emoji: '🔴' },
              { value: 'mp4', label: 'Upload', emoji: '⬆️' },
            ] as const
          ).map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange({ provider: p.value, fileId: undefined, url: '' })}
              className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 text-[10px] font-medium transition ${
                props.provider === p.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input hover:border-muted-foreground'
              }`}
            >
              <span className="text-base leading-none">{p.emoji}</span>
              {p.label}
            </button>
          ))}
        </div>
      </Field>

      {props.provider === 'mp4' ? (
        <Field label="Fichier vidéo">
          <VideoUpload
            fileId={props.fileId}
            url={props.url}
            onChange={(next) => onChange(next)}
          />
        </Field>
      ) : (
        <Field
          label="URL"
          hint={
            props.provider === 'youtube'
              ? 'Lien complet de la vidéo (watch, embed ou shorts)'
              : props.provider === 'tiktok'
                ? 'Format : https://tiktok.com/@user/video/...'
                : ''
          }
        >
          <Input
            value={props.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder={
              props.provider === 'youtube'
                ? 'https://youtube.com/watch?v=…'
                : props.provider === 'vimeo'
                  ? 'https://vimeo.com/…'
                  : props.provider === 'tiktok'
                    ? 'https://tiktok.com/@…/video/…'
                    : props.provider === 'dailymotion'
                      ? 'https://dailymotion.com/video/…'
                      : 'https://loom.com/share/…'
            }
          />
        </Field>
      )}

      <Field label="Légende">
        <Input
          value={props.caption ?? ''}
          onChange={(e) => onChange({ caption: e.target.value })}
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Lecture auto" className="flex-1">
          <span className="sr-only">Autoplay</span>
        </Field>
        <Switch
          checked={props.autoplay ?? false}
          onCheckedChange={(v) => onChange({ autoplay: v })}
        />
      </div>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Contrôles" className="flex-1">
          <span className="sr-only">Controls</span>
        </Field>
        <Switch
          checked={props.controls ?? true}
          onCheckedChange={(v) => onChange({ controls: v })}
        />
      </div>
    </Group>
  )
}

function GalleryFields({
  props,
  onChange,
}: {
  props: GalleryProps
  onChange: (props: Partial<GalleryProps>) => void
}) {
  const updateItem = (idx: number, patch: Partial<GalleryProps['items'][number]>) => {
    onChange({
      items: props.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    })
  }
  const addItem = () =>
    onChange({ items: [...props.items, { url: '', alt: `Image ${props.items.length + 1}` }] })
  const removeItem = (idx: number) =>
    onChange({ items: props.items.filter((_, i) => i !== idx) })

  return (
    <>
      <Group title="Mise en page" defaultOpen>
        <Field label="Colonnes">
          <Pills
            value={props.columns}
            onChange={(v) => onChange({ columns: v as 2 | 3 | 4 })}
            options={[
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]}
          />
        </Field>
        <Field label="Espacement">
          <Pills
            value={props.gap ?? 'md'}
            onChange={(v) => onChange({ gap: v })}
            options={[
              { value: 'sm', label: 'Sm' },
              { value: 'md', label: 'Md' },
              { value: 'lg', label: 'Lg' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Images (${props.items.length})`} defaultOpen>
        <div className="space-y-2">
          {props.items.map((item, idx) => (
            <div key={idx} className="rounded-md border p-2 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <GripVertical className="size-3" />
                Image {idx + 1}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="ml-auto h-6 w-6 text-destructive"
                  onClick={() => removeItem(idx)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
              <ImageUpload
                value={item.url}
                onChange={(url) => updateItem(idx, { url })}
                compact
              />
              <Input
                value={item.alt}
                onChange={(e) => updateItem(idx, { alt: e.target.value })}
                placeholder="Texte alternatif"
                className="h-8 text-xs"
              />
            </div>
          ))}
          <Button variant="outline" className="w-full h-8" onClick={addItem}>
            <Plus className="mr-1.5 size-3.5" />
            Ajouter une image
          </Button>
        </div>
      </Group>
    </>
  )
}

function EmbedFields({
  props,
  onChange,
}: {
  props: EmbedProps
  onChange: (props: Partial<EmbedProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field
        label="HTML / iframe"
        hint="⚠️ Code injecté tel quel — utilisez uniquement des sources de confiance."
      >
        <Textarea
          value={props.html}
          onChange={(e) => onChange({ html: e.target.value })}
          rows={8}
          className="resize-y font-mono text-[11px]"
          placeholder='<iframe src="…"></iframe>'
        />
      </Field>
      <Field label="Hauteur minimum">
        <SliderControl
          value={props.height ?? 400}
          onChange={(v) => onChange({ height: v })}
          min={100}
          max={1200}
          suffix="px"
        />
      </Field>
    </Group>
  )
}

function SectionFields({
  props,
  onChange,
}: {
  props: SectionProps
  onChange: (props: Partial<SectionProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Type de fond">
        <Pills
          value={props.bgType ?? 'color'}
          onChange={(v) => onChange({ bgType: v })}
          options={[
            { value: 'none', label: 'Aucun' },
            { value: 'color', label: 'Couleur' },
            { value: 'gradient', label: 'Dégradé' },
            { value: 'image', label: 'Image' },
          ]}
        />
      </Field>
      {props.bgType === 'color' && (
        <Field label="Couleur de fond">
          <ColorControl value={props.bgColor} onChange={(v) => onChange({ bgColor: v })} />
        </Field>
      )}
      {props.bgType === 'gradient' && (
        <Field label="Dégradé CSS" hint="Ex: linear-gradient(135deg, #C8102E, #1A1A24)">
          <Input
            value={props.bgGradient ?? ''}
            onChange={(e) => onChange({ bgGradient: e.target.value })}
            placeholder="linear-gradient(…)"
            className="font-mono text-xs"
          />
        </Field>
      )}
      {props.bgType === 'image' && (
        <>
          <Field label="Image de fond">
            <ImageUpload
              value={props.bgImage ?? ''}
              onChange={(url) => onChange({ bgImage: url })}
            />
          </Field>
          <Field label="Overlay (assombrir)">
            <ColorControl value={props.bgOverlay} onChange={(v) => onChange({ bgOverlay: v })} />
          </Field>
        </>
      )}
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Pleine largeur" className="flex-1">
          <span className="sr-only">Full width</span>
        </Field>
        <Switch
          checked={props.fullWidth ?? true}
          onCheckedChange={(v) => onChange({ fullWidth: v })}
        />
      </div>
    </Group>
  )
}

function ContainerFields({
  props,
  onChange,
}: {
  props: ContainerProps
  onChange: (props: Partial<ContainerProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Largeur max">
        <Pills
          value={props.width ?? 'lg'}
          onChange={(v) => onChange({ width: v })}
          options={[
            { value: 'sm', label: 'Sm' },
            { value: 'md', label: 'Md' },
            { value: 'lg', label: 'Lg' },
            { value: 'xl', label: 'XL' },
            { value: 'full', label: '100%' },
          ]}
        />
      </Field>
    </Group>
  )
}

function ColumnsFields({
  props,
  onChange,
}: {
  props: ColumnsProps
  onChange: (props: Partial<ColumnsProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Nombre de colonnes">
        <Pills
          value={props.count}
          onChange={(v) => onChange({ count: v as 2 | 3 | 4 })}
          options={[
            { value: 2, label: '2' },
            { value: 3, label: '3' },
            { value: 4, label: '4' },
          ]}
        />
      </Field>
      <Field label="Espacement">
        <Pills
          value={props.gap ?? 'md'}
          onChange={(v) => onChange({ gap: v })}
          options={[
            { value: 'sm', label: 'Sm' },
            { value: 'md', label: 'Md' },
            { value: 'lg', label: 'Lg' },
          ]}
        />
      </Field>
    </Group>
  )
}

function HeroFields({
  props,
  onChange,
}: {
  props: HeroProps
  onChange: (props: Partial<HeroProps>) => void
}) {
  return (
    <>
      <Group title="Contenu" defaultOpen>
        <Field label="Sur-titre">
          <Input
            value={props.subtitle ?? ''}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            placeholder="Ex: NOUVEAU"
          />
        </Field>
        <Field label="Titre principal">
          <Textarea
            value={props.title}
            onChange={(e) => onChange({ title: e.target.value })}
            rows={2}
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={props.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={3}
          />
        </Field>
      </Group>
      <Group title="Boutons">
        <Field label="Bouton principal — texte">
          <Input
            value={props.ctaText ?? ''}
            onChange={(e) => onChange({ ctaText: e.target.value })}
          />
        </Field>
        <Field label="Bouton principal — lien">
          <Input
            value={props.ctaLink ?? ''}
            onChange={(e) => onChange({ ctaLink: e.target.value })}
            placeholder="/page-cible ou https://…"
          />
        </Field>
        <Field label="Bouton secondaire — texte">
          <Input
            value={props.ctaSecondaryText ?? ''}
            onChange={(e) => onChange({ ctaSecondaryText: e.target.value })}
          />
        </Field>
        <Field label="Bouton secondaire — lien">
          <Input
            value={props.ctaSecondaryLink ?? ''}
            onChange={(e) => onChange({ ctaSecondaryLink: e.target.value })}
          />
        </Field>
      </Group>
      <Group title="Apparence">
        <Field label="Couleur de fond">
          <ColorControl value={props.bgColor} onChange={(v) => onChange({ bgColor: v })} />
        </Field>
        <Field label="Image de fond / illustration">
          <ImageUpload
            value={props.image ?? ''}
            onChange={(url) => onChange({ image: url })}
          />
        </Field>
      </Group>
    </>
  )
}

function FeaturesFields({
  props,
  onChange,
}: {
  props: FeaturesProps
  onChange: (props: Partial<FeaturesProps>) => void
}) {
  const updateItem = (idx: number, patch: Partial<FeaturesProps['items'][number]>) => {
    onChange({
      items: props.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    })
  }
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre de section">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <Field label="Sous-titre">
          <Input
            value={props.subtitle ?? ''}
            onChange={(e) => onChange({ subtitle: e.target.value })}
          />
        </Field>
        <Field label="Colonnes">
          <Pills
            value={props.columns}
            onChange={(v) => onChange({ columns: v as 2 | 3 | 4 })}
            options={[
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Items (${props.items.length})`} defaultOpen>
        <div className="space-y-2">
          {props.items.map((item, idx) => (
            <div key={idx} className="rounded-md border p-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>#{idx + 1}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-6 w-6 text-destructive"
                  onClick={() => onChange({ items: props.items.filter((_, i) => i !== idx) })}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
              <IconPicker
                value={item.icon ?? ''}
                onChange={(icon) => updateItem(idx, { icon })}
              />
              <Input
                value={item.title}
                onChange={(e) => updateItem(idx, { title: e.target.value })}
                placeholder="Titre"
                className="h-8 text-xs"
              />
              <Textarea
                value={item.description}
                onChange={(e) => updateItem(idx, { description: e.target.value })}
                placeholder="Description"
                rows={2}
                className="resize-y text-xs"
              />
            </div>
          ))}
          <Button
            variant="outline"
            className="w-full h-8"
            onClick={() =>
              onChange({
                items: [
                  ...props.items,
                  { icon: 'sparkles', title: 'Nouvelle fonctionnalité', description: 'Description.' },
                ],
              })
            }
          >
            <Plus className="mr-1.5 size-3.5" />
            Ajouter
          </Button>
        </div>
      </Group>
    </>
  )
}

function CtaFields({
  props,
  onChange,
}: {
  props: CtaProps
  onChange: (props: Partial<CtaProps>) => void
}) {
  return (
    <>
      <Group title="Contenu" defaultOpen>
        {(props.variant === 'banner' || props.variant === 'card') && (
          <>
            <Field label="Titre">
              <Input
                value={props.title ?? ''}
                onChange={(e) => onChange({ title: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={props.description ?? ''}
                onChange={(e) => onChange({ description: e.target.value })}
                rows={2}
              />
            </Field>
          </>
        )}
        <Field label="Bouton — texte">
          <Input value={props.text} onChange={(e) => onChange({ text: e.target.value })} />
        </Field>
        <Field label="Bouton — lien">
          <Input
            value={props.link}
            onChange={(e) => onChange({ link: e.target.value })}
            placeholder="/cible ou https://…"
          />
        </Field>
        <Field label="Lien secondaire — texte">
          <Input
            value={props.secondaryText ?? ''}
            onChange={(e) => onChange({ secondaryText: e.target.value })}
          />
        </Field>
        <Field label="Lien secondaire — URL">
          <Input
            value={props.secondaryLink ?? ''}
            onChange={(e) => onChange({ secondaryLink: e.target.value })}
          />
        </Field>
      </Group>
      <Group title="Apparence">
        <Field label="Style du bouton">
          <Pills
            value={props.buttonStyle ?? 'primary'}
            onChange={(v) => onChange({ buttonStyle: v })}
            options={[
              { value: 'primary', label: 'Primary' },
              { value: 'secondary', label: 'Sec.' },
              { value: 'outline', label: 'Outline' },
              { value: 'ghost', label: 'Ghost' },
            ]}
          />
        </Field>
        <Field label="Taille">
          <Pills
            value={props.buttonSize ?? 'md'}
            onChange={(v) => onChange({ buttonSize: v })}
            options={[
              { value: 'sm', label: 'Sm' },
              { value: 'md', label: 'Md' },
              { value: 'lg', label: 'Lg' },
            ]}
          />
        </Field>
      </Group>
    </>
  )
}

function FaqFields({
  props,
  onChange,
}: {
  props: FaqProps
  onChange: (props: Partial<FaqProps>) => void
}) {
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre de section">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
      </Group>
      <Group title={`Questions (${props.items.length})`} defaultOpen>
        <div className="space-y-2">
          {props.items.map((item, idx) => (
            <div key={idx} className="rounded-md border p-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Question #{idx + 1}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-6 w-6 text-destructive"
                  onClick={() => onChange({ items: props.items.filter((_, i) => i !== idx) })}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
              <Input
                value={item.question}
                onChange={(e) =>
                  onChange({
                    items: props.items.map((it, i) =>
                      i === idx ? { ...it, question: e.target.value } : it
                    ),
                  })
                }
                placeholder="Question"
                className="h-8 text-xs"
              />
              <Textarea
                value={item.answer}
                onChange={(e) =>
                  onChange({
                    items: props.items.map((it, i) =>
                      i === idx ? { ...it, answer: e.target.value } : it
                    ),
                  })
                }
                placeholder="Réponse"
                rows={2}
                className="resize-y text-xs"
              />
            </div>
          ))}
          <Button
            variant="outline"
            className="w-full h-8"
            onClick={() =>
              onChange({
                items: [
                  ...props.items,
                  { question: 'Nouvelle question ?', answer: 'Réponse…' },
                ],
              })
            }
          >
            <Plus className="mr-1.5 size-3.5" />
            Ajouter
          </Button>
        </div>
      </Group>
    </>
  )
}

function TestimonialFields({
  props,
  onChange,
}: {
  props: TestimonialProps
  onChange: (props: Partial<TestimonialProps>) => void
}) {
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre de section">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
      </Group>
      <Group title={`Témoignages (${props.items.length})`} defaultOpen>
        <div className="space-y-2">
          {props.items.map((item, idx) => (
            <div key={idx} className="rounded-md border p-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>#{idx + 1}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-6 w-6 text-destructive"
                  onClick={() => onChange({ items: props.items.filter((_, i) => i !== idx) })}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
              <Textarea
                value={item.quote}
                onChange={(e) =>
                  onChange({
                    items: props.items.map((it, i) =>
                      i === idx ? { ...it, quote: e.target.value } : it
                    ),
                  })
                }
                placeholder="Citation"
                rows={2}
                className="resize-y text-xs"
              />
              <Input
                value={item.author}
                onChange={(e) =>
                  onChange({
                    items: props.items.map((it, i) =>
                      i === idx ? { ...it, author: e.target.value } : it
                    ),
                  })
                }
                placeholder="Auteur"
                className="h-8 text-xs"
              />
              <Input
                value={item.role ?? ''}
                onChange={(e) =>
                  onChange({
                    items: props.items.map((it, i) =>
                      i === idx ? { ...it, role: e.target.value } : it
                    ),
                  })
                }
                placeholder="Rôle"
                className="h-8 text-xs"
              />
              <ImageUpload
                value={item.avatar ?? ''}
                onChange={(url) =>
                  onChange({
                    items: props.items.map((it, i) =>
                      i === idx ? { ...it, avatar: url } : it
                    ),
                  })
                }
                compact
              />
            </div>
          ))}
          <Button
            variant="outline"
            className="w-full h-8"
            onClick={() =>
              onChange({
                items: [
                  ...props.items,
                  { quote: 'Nouveau témoignage', author: 'Auteur', role: '' },
                ],
              })
            }
          >
            <Plus className="mr-1.5 size-3.5" />
            Ajouter
          </Button>
        </div>
      </Group>
    </>
  )
}

function StatsFields({
  props,
  onChange,
}: {
  props: StatsProps
  onChange: (props: Partial<StatsProps>) => void
}) {
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre de section">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <Field label="Colonnes">
          <Pills
            value={props.columns}
            onChange={(v) => onChange({ columns: v as 2 | 3 | 4 })}
            options={[
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Statistiques (${props.items.length})`} defaultOpen>
        <div className="space-y-2">
          {props.items.map((item, idx) => (
            <div key={idx} className="rounded-md border p-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>#{idx + 1}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-6 w-6 text-destructive"
                  onClick={() => onChange({ items: props.items.filter((_, i) => i !== idx) })}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Input
                  value={item.prefix ?? ''}
                  onChange={(e) =>
                    onChange({
                      items: props.items.map((it, i) =>
                        i === idx ? { ...it, prefix: e.target.value } : it
                      ),
                    })
                  }
                  placeholder="$"
                  className="h-8 text-xs"
                />
                <Input
                  value={item.value}
                  onChange={(e) =>
                    onChange({
                      items: props.items.map((it, i) =>
                        i === idx ? { ...it, value: e.target.value } : it
                      ),
                    })
                  }
                  placeholder="100"
                  className="h-8 text-xs"
                />
                <Input
                  value={item.suffix ?? ''}
                  onChange={(e) =>
                    onChange({
                      items: props.items.map((it, i) =>
                        i === idx ? { ...it, suffix: e.target.value } : it
                      ),
                    })
                  }
                  placeholder="%"
                  className="h-8 text-xs"
                />
              </div>
              <Input
                value={item.label}
                onChange={(e) =>
                  onChange({
                    items: props.items.map((it, i) =>
                      i === idx ? { ...it, label: e.target.value } : it
                    ),
                  })
                }
                placeholder="Libellé"
                className="h-8 text-xs"
              />
            </div>
          ))}
          <Button
            variant="outline"
            className="w-full h-8"
            onClick={() =>
              onChange({
                items: [...props.items, { value: '0', label: 'Métrique' }],
              })
            }
          >
            <Plus className="mr-1.5 size-3.5" />
            Ajouter
          </Button>
        </div>
      </Group>
    </>
  )
}

// ───────────────────────────── Switcher ─────────────────────────────

interface ContentTabProps {
  block: BlockProps
  onPropChange: (props: Record<string, unknown>) => void
}

export function ContentTab({ block, onPropChange }: ContentTabProps) {
  return (
    <div>
      <PropsHeader block={block} />
      {(() => {
        switch (block.type) {
          case 'heading':
            return <HeadingFields props={block.props} onChange={onPropChange} />
          case 'text':
            return <TextFields props={block.props} onChange={onPropChange} />
          case 'quote':
            return <QuoteFields props={block.props} onChange={onPropChange} />
          case 'divider':
            return <DividerFields props={block.props} onChange={onPropChange} />
          case 'spacer':
            return <SpacerFields props={block.props} onChange={onPropChange} />
          case 'image':
            return <ImageFields props={block.props} onChange={onPropChange} />
          case 'video':
            return <VideoFields props={block.props} onChange={onPropChange} />
          case 'gallery':
            return <GalleryFields props={block.props} onChange={onPropChange} />
          case 'embed':
            return <EmbedFields props={block.props} onChange={onPropChange} />
          case 'section':
            return <SectionFields props={block.props} onChange={onPropChange} />
          case 'container':
            return <ContainerFields props={block.props} onChange={onPropChange} />
          case 'columns':
            return <ColumnsFields props={block.props} onChange={onPropChange} />
          case 'hero':
            return <HeroFields props={block.props} onChange={onPropChange} />
          case 'features':
            return <FeaturesFields props={block.props} onChange={onPropChange} />
          case 'cta':
            return <CtaFields props={block.props} onChange={onPropChange} />
          case 'faq':
            return <FaqFields props={block.props} onChange={onPropChange} />
          case 'testimonial':
            return <TestimonialFields props={block.props} onChange={onPropChange} />
          case 'stats':
            return <StatsFields props={block.props} onChange={onPropChange} />
          case 'card':
            return <CardFields props={block.props} onChange={onPropChange} />
          case 'accordion':
            return <AccordionFields props={block.props} onChange={onPropChange} />
          case 'tabs':
            return <TabsFields props={block.props} onChange={onPropChange} />
          case 'alert':
            return <AlertFields props={block.props} onChange={onPropChange} />
          case 'badges':
            return <BadgesFields props={block.props} onChange={onPropChange} />
          case 'progress':
            return <ProgressFields props={block.props} onChange={onPropChange} />
          case 'buttonGroup':
            return <ButtonGroupFields props={block.props} onChange={onPropChange} />
          case 'document':
            return <DocumentFields props={block.props} onChange={onPropChange} />
          case 'steps':
            return <StepsFields props={block.props} onChange={onPropChange} />
          case 'organisme':
            return <OrganismeFields props={block.props} onChange={onPropChange} />
          case 'glossary':
            return <GlossaryFields props={block.props} onChange={onPropChange} />
          case 'counter':
            return <CounterFields props={block.props} onChange={onPropChange} />
          case 'collection':
            return <CollectionFields props={block.props} onChange={onPropChange} />
          case 'form':
            return <FormFields props={block.props} onChange={onPropChange} />
          // text-extra
          case 'codeBlock': return <CodeBlockFields props={block.props} onChange={onPropChange} />
          case 'pullQuote': return <PullQuoteFields props={block.props} onChange={onPropChange} />
          case 'dropCap': return <DropCapFields props={block.props} onChange={onPropChange} />
          case 'definitionList': return <DefinitionListFields props={block.props} onChange={onPropChange} />
          case 'highlight': return <HighlightFields props={block.props} onChange={onPropChange} />
          case 'prosCons': return <ProsConsFields props={block.props} onChange={onPropChange} />
          case 'checklist': return <ChecklistFields props={block.props} onChange={onPropChange} />
          // media-extra
          case 'audio': return <AudioFields props={block.props} onChange={onPropChange} />
          case 'carousel': return <CarouselFields props={block.props} onChange={onPropChange} />
          case 'beforeAfter': return <BeforeAfterFields props={block.props} onChange={onPropChange} />
          case 'logoWall': return <LogoWallFields props={block.props} onChange={onPropChange} />
          case 'svgIllustration': return <SvgIllustrationFields props={block.props} onChange={onPropChange} />
          // charts
          case 'barChart': return <BarChartFields props={block.props} onChange={onPropChange} />
          case 'lineChart': return <LineChartFields props={block.props} onChange={onPropChange} />
          case 'pieChart': return <PieChartFields props={block.props} onChange={onPropChange} />
          case 'kpiCard': return <KpiCardFields props={block.props} onChange={onPropChange} />
          case 'sparkline': return <SparklineFields props={block.props} onChange={onPropChange} />
          case 'heatmap': return <GenericPropsFields props={block.props} onChange={onPropChange} />
          case 'chronology': return <ChronologyFields props={block.props} onChange={onPropChange} />
          // marketing-extra
          case 'pricingTable': return <PricingTableFields props={block.props} onChange={onPropChange} />
          case 'compareTable': return <CompareTableFields props={block.props} onChange={onPropChange} />
          case 'countdown': return <CountdownFields props={block.props} onChange={onPropChange} />
          case 'notificationBar': return <NotificationBarFields props={block.props} onChange={onPropChange} />
          case 'newsletter': return <NewsletterFields props={block.props} onChange={onPropChange} />
          case 'trustBadges': return <TrustBadgesFields props={block.props} onChange={onPropChange} />
          case 'pressMentions': return <PressMentionsFields props={block.props} onChange={onPropChange} />
          case 'starRating': return <StarRatingFields props={block.props} onChange={onPropChange} />
          // engagement
          case 'quiz': return <QuizFields props={block.props} onChange={onPropChange} />
          case 'poll': return <PollFields props={block.props} onChange={onPropChange} />
          case 'calculator': return <CalculatorFields props={block.props} onChange={onPropChange} />
          case 'reactions': return <ReactionsFields props={block.props} onChange={onPropChange} />
          case 'shareButtons': return <ShareButtonsFields props={block.props} onChange={onPropChange} />
          // nav/time/editorial
          case 'openingHours': return <OpeningHoursFields props={block.props} onChange={onPropChange} />
          case 'lastUpdated': return <LastUpdatedFields props={block.props} onChange={onPropChange} />
          case 'tableOfContents': return <TableOfContentsFields props={block.props} onChange={onPropChange} />
          case 'anchorMenu': return <AnchorMenuFields props={block.props} onChange={onPropChange} />
          case 'backToTop': return <GenericPropsFields props={block.props} onChange={onPropChange} />
          case 'readingProgress': return <GenericPropsFields props={block.props} onChange={onPropChange} />
          case 'articleHeader': return <ArticleHeaderFields props={block.props} onChange={onPropChange} />
          case 'authorBio': return <AuthorBioFields props={block.props} onChange={onPropChange} />
          case 'sponsoredDisclosure': return <SponsoredDisclosureFields props={block.props} onChange={onPropChange} />
          // docbel-extra
          case 'belgianDateHelper': return <BelgianDateHelperFields props={block.props} onChange={onPropChange} />
          case 'tarifsTable': return <TarifsTableFields props={block.props} onChange={onPropChange} />
          case 'eligibilityTest': return <EligibilityTestFields props={block.props} onChange={onPropChange} />
          case 'lawCitation': return <LawCitationFields props={block.props} onChange={onPropChange} />
          case 'casePractice': return <CasePracticeFields props={block.props} onChange={onPropChange} />
          case 'requiredDocs': return <RequiredDocsFields props={block.props} onChange={onPropChange} />
          case 'legalDelay': return <LegalDelayFields props={block.props} onChange={onPropChange} />
          // utility
          case 'htmlRaw': return <HtmlRawFields props={block.props} onChange={onPropChange} />
          case 'customCss': return <CustomCssFields props={block.props} onChange={onPropChange} />
          case 'gdprNotice': return <GdprNoticeFields props={block.props} onChange={onPropChange} />
          case 'mapEmbed': return <MapEmbedFields props={block.props} onChange={onPropChange} />
          case 'marquee': return <MarqueeFields props={block.props} onChange={onPropChange} />
          case 'tiltCard': return <TiltCardFields props={block.props} onChange={onPropChange} />
          case 'imageHotspots': return <ImageHotspotsFields props={block.props} onChange={onPropChange} />
          // New flexible blocks — all use GenericPropsFields for now (JSON edit + variant selector)
          case 'bentoGrid':
          case 'splitSection':
          case 'stickyDuo':
          case 'flexContainer':
          case 'magazineColumns':
          case 'radarChart':
          case 'funnelChart':
          case 'gauge':
          case 'stackedBar':
          case 'multiLine':
          case 'spoiler':
          case 'aside':
          case 'editorNote':
          case 'dialogBlock':
          case 'diffViewer':
          case 'mathLatex':
          case 'feedbackBar':
          case 'suggestionBox':
          case 'multiStepForm':
          case 'donation':
          case 'salaireNetBE':
          case 'preavisCCT109':
          case 'allocationsFamiliales':
          case 'postalToCommune':
          case 'bceValidator':
          case 'gradientMesh':
          case 'sectionDivider':
          case 'glassCard':
          case 'typewriter':
          case 'kenBurns':
          case 'particles':
          case 'newsTicker':
          case 'flashcards':
          case 'ttsButton':
          case 'a11yToolbar':
            return <GenericPropsFields props={block.props} onChange={onPropChange} />
          default:
            return null
        }
      })()}
      <VariantPicker block={block} onPropChange={onPropChange} />
    </div>
  )
}
