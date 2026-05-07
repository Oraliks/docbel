'use client'

/**
 * Inspector forms for the second wave of blocks (text-extra, media-extra,
 * charts, marketing-extra, engagement, time/nav, editorial, docbel-extra,
 * utility, story).
 *
 * Many blocks share patterns; the more complex ones get bespoke forms,
 * the simpler ones use the generic <PropsForm> introspector at the bottom.
 */

import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import type {
  CodeBlockProps,
  PullQuoteProps,
  DropCapProps,
  DefinitionListProps,
  HighlightProps,
  ProsConsProps,
  ChecklistProps,
  AudioProps,
  CarouselProps,
  BeforeAfterProps,
  LogoWallProps,
  SvgIllustrationProps,
  BarChartProps,
  LineChartProps,
  PieChartProps,
  KpiCardProps,
  SparklineProps,
  ChronologyProps,
  PricingTableProps,
  CompareTableProps,
  CountdownProps,
  NotificationBarProps,
  NewsletterProps,
  TrustBadgesProps,
  PressMentionsProps,
  StarRatingProps,
  QuizProps,
  PollProps,
  CalculatorProps,
  ReactionsProps,
  ShareButtonsProps,
  OpeningHoursProps,
  LastUpdatedProps,
  TableOfContentsProps,
  AnchorMenuProps,
  ArticleHeaderProps,
  AuthorBioProps,
  SponsoredDisclosureProps,
  BelgianDateHelperProps,
  TarifsTableProps,
  EligibilityTestProps,
  LawCitationProps,
  CasePracticeProps,
  RequiredDocsProps,
  LegalDelayProps,
  HtmlRawProps,
  CustomCssProps,
  GdprNoticeProps,
  MapEmbedProps,
  MarqueeProps,
  TiltCardProps,
  ImageHotspotsProps,
  ChartDataPoint,
  ChronologyEvent,
  PricingPlan,
  CompareRow,
  TarifsRow,
  RequiredDoc,
  HotspotPoint,
} from '@/lib/page-builder/types'
import { Field, Group, Pills, ColorControl, SliderControl } from './controls'
import { ImageUpload } from './image-upload'
import { DocumentUpload } from './document-upload'
import { IconPicker } from './icon-picker'
import { RichTextInput } from './rich-text-input'

// ───────────────────────────── helpers ─────────────────────────────

interface RepeaterListProps<T> {
  items: T[]
  onChange: (items: T[]) => void
  render: (item: T, setItem: (patch: Partial<T>) => void) => React.ReactNode
  addItem: () => T
  addLabel?: string
}

function RepeaterList<T>({
  items,
  onChange,
  render,
  addItem,
  addLabel = 'Ajouter',
}: RepeaterListProps<T>) {
  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-md border p-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>#{idx + 1}</span>
            <Button
              size="icon-sm"
              variant="ghost"
              className="h-6 w-6 text-destructive"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
          {render(item, (patch) =>
            onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
          )}
        </div>
      ))}
      <Button variant="outline" className="w-full h-8" onClick={() => onChange([...items, addItem()])}>
        <Plus className="mr-1.5 size-3.5" />
        {addLabel}
      </Button>
    </div>
  )
}

// ───────────────────────────── Text-extra ─────────────────────────────

export function CodeBlockFields({ props, onChange }: { props: CodeBlockProps; onChange: (p: Partial<CodeBlockProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Code">
        <Textarea
          value={props.code}
          onChange={(e) => onChange({ code: e.target.value })}
          rows={10}
          className="font-mono text-xs resize-y"
        />
      </Field>
      <Field label="Langage">
        <Input value={props.language ?? ''} onChange={(e) => onChange({ language: e.target.value })} placeholder="javascript, python, typescript…" />
      </Field>
      <Field label="Nom de fichier (optionnel)">
        <Input value={props.filename ?? ''} onChange={(e) => onChange({ filename: e.target.value })} />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Numéros de ligne" className="flex-1"><span className="sr-only">Line numbers</span></Field>
        <Switch checked={props.showLineNumbers ?? true} onCheckedChange={(v) => onChange({ showLineNumbers: v })} />
      </div>
    </Group>
  )
}

export function PullQuoteFields({ props, onChange }: { props: PullQuoteProps; onChange: (p: Partial<PullQuoteProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Texte"><Textarea value={props.text} onChange={(e) => onChange({ text: e.target.value })} rows={3} /></Field>
      <Field label="Auteur"><Input value={props.author ?? ''} onChange={(e) => onChange({ author: e.target.value })} /></Field>
      <Field label="Alignement">
        <Pills
          value={props.align ?? 'center'}
          onChange={(v) => onChange({ align: v })}
          options={[
            { value: 'left', label: 'Gauche' },
            { value: 'center', label: 'Centre' },
            { value: 'right', label: 'Droite' },
          ]}
        />
      </Field>
    </Group>
  )
}

export function DropCapFields({ props, onChange }: { props: DropCapProps; onChange: (p: Partial<DropCapProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Texte (la première lettre sera stylée)"><Textarea value={props.html} onChange={(e) => onChange({ html: e.target.value })} rows={5} /></Field>
      <Field label="Couleur de la lettrine"><ColorControl value={props.capColor} onChange={(v) => onChange({ capColor: v })} /></Field>
    </Group>
  )
}

export function DefinitionListFields({ props, onChange }: { props: DefinitionListProps; onChange: (p: Partial<DefinitionListProps>) => void }) {
  return (
    <Group title={`Définitions (${props.items.length})`} defaultOpen>
      <RepeaterList
        items={props.items}
        onChange={(items) => onChange({ items })}
        render={(item, set) => (
          <>
            <Input value={item.term} onChange={(e) => set({ term: e.target.value })} placeholder="Terme" className="h-8 text-xs" />
            <Textarea value={item.definition} onChange={(e) => set({ definition: e.target.value })} placeholder="Définition" rows={2} className="text-xs resize-y" />
          </>
        )}
        addItem={() => ({ term: 'Nouveau terme', definition: '' })}
      />
    </Group>
  )
}

export function HighlightFields({ props, onChange }: { props: HighlightProps; onChange: (p: Partial<HighlightProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Texte"><Input value={props.text} onChange={(e) => onChange({ text: e.target.value })} /></Field>
      <Field label="Couleur">
        <Pills
          value={props.color ?? 'yellow'}
          onChange={(v) => onChange({ color: v })}
          options={[
            { value: 'yellow', label: 'Jaune' },
            { value: 'green', label: 'Vert' },
            { value: 'pink', label: 'Rose' },
            { value: 'blue', label: 'Bleu' },
            { value: 'orange', label: 'Orange' },
          ]}
        />
      </Field>
    </Group>
  )
}

export function ProsConsFields({ props, onChange }: { props: ProsConsProps; onChange: (p: Partial<ProsConsProps>) => void }) {
  return (
    <>
      <Group title="Avantages" defaultOpen>
        <Field label="Titre"><Input value={props.prosTitle ?? ''} onChange={(e) => onChange({ prosTitle: e.target.value })} /></Field>
        <Field label="Liste (un par ligne)">
          <Textarea
            value={props.pros.join('\n')}
            onChange={(e) => onChange({ pros: e.target.value.split('\n').filter(Boolean) })}
            rows={5}
            className="resize-y text-xs"
          />
        </Field>
      </Group>
      <Group title="Inconvénients" defaultOpen>
        <Field label="Titre"><Input value={props.consTitle ?? ''} onChange={(e) => onChange({ consTitle: e.target.value })} /></Field>
        <Field label="Liste (un par ligne)">
          <Textarea
            value={props.cons.join('\n')}
            onChange={(e) => onChange({ cons: e.target.value.split('\n').filter(Boolean) })}
            rows={5}
            className="resize-y text-xs"
          />
        </Field>
      </Group>
    </>
  )
}

export function ChecklistFields({ props, onChange }: { props: ChecklistProps; onChange: (p: Partial<ChecklistProps>) => void }) {
  return (
    <>
      <Group title="Contenu" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Interactif (cocher en lecture)" className="flex-1"><span className="sr-only">interactive</span></Field>
          <Switch checked={props.interactive ?? true} onCheckedChange={(v) => onChange({ interactive: v })} />
        </div>
      </Group>
      <Group title={`Items (${props.items.length})`} defaultOpen>
        <RepeaterList
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <Input value={item.text} onChange={(e) => set({ text: e.target.value })} placeholder="Élément" className="h-8 text-xs" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Coché par défaut</span>
                <Switch checked={item.checked ?? false} onCheckedChange={(v) => set({ checked: v })} />
              </div>
            </>
          )}
          addItem={() => ({ text: 'Nouvel élément', checked: false })}
        />
      </Group>
    </>
  )
}

// ───────────────────────────── Media-extra ─────────────────────────────

export function AudioFields({ props, onChange }: { props: AudioProps; onChange: (p: Partial<AudioProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Fichier audio"><DocumentUpload fileId={props.fileId} url={props.url} onChange={(next) => onChange(next)} /></Field>
      <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      <Field label="Artiste"><Input value={props.artist ?? ''} onChange={(e) => onChange({ artist: e.target.value })} /></Field>
      <Field label="Légende"><Input value={props.caption ?? ''} onChange={(e) => onChange({ caption: e.target.value })} /></Field>
    </Group>
  )
}

export function CarouselFields({ props, onChange }: { props: CarouselProps; onChange: (p: Partial<CarouselProps>) => void }) {
  return (
    <>
      <Group title="Comportement" defaultOpen>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Lecture auto" className="flex-1"><span className="sr-only">autoplay</span></Field>
          <Switch checked={props.autoplay ?? false} onCheckedChange={(v) => onChange({ autoplay: v })} />
        </div>
        {props.autoplay && (
          <Field label="Intervalle (ms)"><SliderControl value={props.interval ?? 5000} onChange={(v) => onChange({ interval: v })} min={2000} max={15000} step={500} suffix="ms" /></Field>
        )}
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Points de navigation" className="flex-1"><span className="sr-only">dots</span></Field>
          <Switch checked={props.showDots ?? true} onCheckedChange={(v) => onChange({ showDots: v })} />
        </div>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Flèches" className="flex-1"><span className="sr-only">arrows</span></Field>
          <Switch checked={props.showArrows ?? true} onCheckedChange={(v) => onChange({ showArrows: v })} />
        </div>
      </Group>
      <Group title={`Slides (${props.slides.length})`} defaultOpen>
        <RepeaterList
          items={props.slides}
          onChange={(slides) => onChange({ slides })}
          render={(item, set) => (
            <>
              <ImageUpload value={item.image} onChange={(url) => set({ image: url })} compact />
              <Input value={item.alt ?? ''} onChange={(e) => set({ alt: e.target.value })} placeholder="Alt" className="h-8 text-xs" />
              <Input value={item.caption ?? ''} onChange={(e) => set({ caption: e.target.value })} placeholder="Légende" className="h-8 text-xs" />
              <Input value={item.link ?? ''} onChange={(e) => set({ link: e.target.value })} placeholder="Lien (optionnel)" className="h-8 text-xs" />
            </>
          )}
          addItem={() => ({ image: '', alt: 'Nouvelle slide', caption: '' })}
        />
      </Group>
    </>
  )
}

export function BeforeAfterFields({ props, onChange }: { props: BeforeAfterProps; onChange: (p: Partial<BeforeAfterProps>) => void }) {
  return (
    <Group title="Images" defaultOpen>
      <Field label="Image avant"><ImageUpload value={props.beforeUrl} onChange={(url) => onChange({ beforeUrl: url })} /></Field>
      <Field label="Étiquette avant"><Input value={props.beforeLabel ?? ''} onChange={(e) => onChange({ beforeLabel: e.target.value })} /></Field>
      <Field label="Image après"><ImageUpload value={props.afterUrl} onChange={(url) => onChange({ afterUrl: url })} /></Field>
      <Field label="Étiquette après"><Input value={props.afterLabel ?? ''} onChange={(e) => onChange({ afterLabel: e.target.value })} /></Field>
    </Group>
  )
}

export function LogoWallFields({ props, onChange }: { props: LogoWallProps; onChange: (p: Partial<LogoWallProps>) => void }) {
  return (
    <>
      <Group title="Affichage" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
        <Field label="Disposition">
          <Pills
            value={props.variant ?? 'grid'}
            onChange={(v) => onChange({ variant: v })}
            options={[
              { value: 'grid', label: 'Grille' },
              { value: 'marquee', label: 'Défilant' },
            ]}
          />
        </Field>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Nuances de gris" className="flex-1"><span className="sr-only">grayscale</span></Field>
          <Switch checked={props.grayscale ?? true} onCheckedChange={(v) => onChange({ grayscale: v })} />
        </div>
      </Group>
      <Group title={`Logos (${props.logos.length})`} defaultOpen>
        <RepeaterList<LogoWallProps['logos'][number]>
          items={props.logos}
          onChange={(logos) => onChange({ logos })}
          render={(item, set) => (
            <>
              <ImageUpload value={item.url} onChange={(url) => set({ url })} compact />
              <Input value={item.alt} onChange={(e) => set({ alt: e.target.value })} placeholder="Nom" className="h-8 text-xs" />
              <Input value={item.href ?? ''} onChange={(e) => set({ href: e.target.value })} placeholder="Lien (optionnel)" className="h-8 text-xs" />
            </>
          )}
          addItem={() => ({ url: '', alt: 'Logo', href: '' })}
        />
      </Group>
    </>
  )
}

export function SvgIllustrationFields({ props, onChange }: { props: SvgIllustrationProps; onChange: (p: Partial<SvgIllustrationProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Code SVG" hint="⚠️ HTML brut · sources de confiance uniquement">
        <Textarea value={props.svg} onChange={(e) => onChange({ svg: e.target.value })} rows={6} className="font-mono text-xs resize-y" />
      </Field>
      <Field label="Largeur"><Input value={props.width ?? ''} onChange={(e) => onChange({ width: e.target.value })} placeholder="100px ou 100%" /></Field>
      <Field label="Hauteur"><Input value={props.height ?? ''} onChange={(e) => onChange({ height: e.target.value })} placeholder="100px ou auto" /></Field>
    </Group>
  )
}

// ───────────────────────────── Charts ─────────────────────────────

function ChartDataEditor({
  data,
  onChange,
}: {
  data: ChartDataPoint[]
  onChange: (data: ChartDataPoint[]) => void
}) {
  return (
    <RepeaterList<ChartDataPoint>
      items={data}
      onChange={onChange}
      render={(it, set) => (
        <div className="grid grid-cols-2 gap-1.5">
          <Input value={it.label} onChange={(e) => set({ label: e.target.value })} placeholder="Libellé" className="h-8 text-xs" />
          <Input type="number" value={it.value} onChange={(e) => set({ value: Number(e.target.value) })} placeholder="0" className="h-8 text-xs" />
        </div>
      )}
      addItem={() => ({ label: 'Nouveau', value: 0 })}
    />
  )
}

export function BarChartFields({ props, onChange }: { props: BarChartProps; onChange: (p: Partial<BarChartProps>) => void }) {
  return (
    <>
      <Group title="Apparence" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
        <Field label="Couleur"><ColorControl value={props.color} onChange={(v) => onChange({ color: v })} /></Field>
        <Field label="Hauteur"><SliderControl value={props.height ?? 300} onChange={(v) => onChange({ height: v })} min={150} max={600} suffix="px" /></Field>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Barres horizontales" className="flex-1"><span className="sr-only">horizontal</span></Field>
          <Switch checked={props.horizontal ?? false} onCheckedChange={(v) => onChange({ horizontal: v })} />
        </div>
      </Group>
      <Group title={`Données (${props.data.length})`} defaultOpen>
        <ChartDataEditor data={props.data} onChange={(data) => onChange({ data })} />
      </Group>
    </>
  )
}
export function LineChartFields({ props, onChange }: { props: LineChartProps; onChange: (p: Partial<LineChartProps>) => void }) {
  return (
    <>
      <Group title="Apparence" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
        <Field label="Couleur"><ColorControl value={props.color} onChange={(v) => onChange({ color: v })} /></Field>
        <Field label="Hauteur"><SliderControl value={props.height ?? 300} onChange={(v) => onChange({ height: v })} min={150} max={600} suffix="px" /></Field>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Courbe lissée" className="flex-1"><span className="sr-only">smooth</span></Field>
          <Switch checked={props.smooth ?? true} onCheckedChange={(v) => onChange({ smooth: v })} />
        </div>
      </Group>
      <Group title={`Données (${props.data.length})`} defaultOpen>
        <ChartDataEditor data={props.data} onChange={(data) => onChange({ data })} />
      </Group>
    </>
  )
}
export function PieChartFields({ props, onChange }: { props: PieChartProps; onChange: (p: Partial<PieChartProps>) => void }) {
  return (
    <>
      <Group title="Apparence" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
        <Field label="Hauteur"><SliderControl value={props.height ?? 300} onChange={(v) => onChange({ height: v })} min={150} max={600} suffix="px" /></Field>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Style donut (anneau)" className="flex-1"><span className="sr-only">donut</span></Field>
          <Switch checked={props.donut ?? false} onCheckedChange={(v) => onChange({ donut: v })} />
        </div>
      </Group>
      <Group title={`Segments (${props.data.length})`} defaultOpen>
        <ChartDataEditor data={props.data} onChange={(data) => onChange({ data })} />
      </Group>
    </>
  )
}

export function KpiCardFields({ props, onChange }: { props: KpiCardProps; onChange: (p: Partial<KpiCardProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Libellé"><Input value={props.label} onChange={(e) => onChange({ label: e.target.value })} /></Field>
      <Field label="Valeur"><Input value={props.value} onChange={(e) => onChange({ value: e.target.value })} placeholder="12 458 ou €1.2M" /></Field>
      <Field label="Variation (%)"><Input type="number" step={0.1} value={props.trendValue ?? 0} onChange={(e) => onChange({ trendValue: Number(e.target.value) })} /></Field>
      <Field label="Étiquette de variation"><Input value={props.trendLabel ?? ''} onChange={(e) => onChange({ trendLabel: e.target.value })} placeholder="vs mois dernier" /></Field>
      <Field label="Icône"><IconPicker value={props.icon ?? ''} onChange={(icon) => onChange({ icon })} /></Field>
      <Field label="Couleur"><ColorControl value={props.color} onChange={(v) => onChange({ color: v })} /></Field>
    </Group>
  )
}

export function SparklineFields({ props, onChange }: { props: SparklineProps; onChange: (p: Partial<SparklineProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Libellé"><Input value={props.label ?? ''} onChange={(e) => onChange({ label: e.target.value })} /></Field>
      <Field label="Valeur affichée"><Input value={props.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} placeholder="+23%" /></Field>
      <Field label="Couleur"><ColorControl value={props.color} onChange={(v) => onChange({ color: v })} /></Field>
      <Field label="Données (chiffres séparés par des virgules)">
        <Input
          value={props.data.join(', ')}
          onChange={(e) =>
            onChange({
              data: e.target.value.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n)),
            })
          }
          placeholder="10, 14, 12, 18"
          className="font-mono text-xs"
        />
      </Field>
    </Group>
  )
}

export function ChronologyFields({ props, onChange }: { props: ChronologyProps; onChange: (p: Partial<ChronologyProps>) => void }) {
  return (
    <>
      <Group title="Affichage" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
        <Field label="Orientation">
          <Pills value={props.variant ?? 'vertical'} onChange={(v) => onChange({ variant: v })}
            options={[{ value: 'vertical', label: 'Verticale' }, { value: 'horizontal', label: 'Horizontale' }]} />
        </Field>
      </Group>
      <Group title={`Événements (${props.events.length})`} defaultOpen>
        <RepeaterList<ChronologyEvent>
          items={props.events}
          onChange={(events) => onChange({ events })}
          render={(it, set) => (
            <>
              <Input value={it.date} onChange={(e) => set({ date: e.target.value })} placeholder="2024" className="h-8 text-xs" />
              <Input value={it.title} onChange={(e) => set({ title: e.target.value })} placeholder="Titre" className="h-8 text-xs" />
              <Textarea value={it.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="Description" rows={2} className="text-xs resize-y" />
              <IconPicker value={it.icon ?? ''} onChange={(icon) => set({ icon })} />
            </>
          )}
          addItem={() => ({ date: '2024', title: 'Nouvel événement' })}
        />
      </Group>
    </>
  )
}

// ───────────────────────────── Marketing-extra ─────────────────────────────

export function PricingTableFields({ props, onChange }: { props: PricingTableProps; onChange: (p: Partial<PricingTableProps>) => void }) {
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
        <Field label="Sous-titre"><Input value={props.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} /></Field>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Toggle mensuel/annuel" className="flex-1"><span className="sr-only">toggle</span></Field>
          <Switch checked={props.togglePeriod ?? false} onCheckedChange={(v) => onChange({ togglePeriod: v })} />
        </div>
      </Group>
      <Group title={`Plans (${props.plans.length})`} defaultOpen>
        <RepeaterList<PricingPlan>
          items={props.plans}
          onChange={(plans) => onChange({ plans })}
          render={(it, set) => (
            <>
              <Input value={it.name} onChange={(e) => set({ name: e.target.value })} placeholder="Nom" className="h-8 text-xs" />
              <div className="grid grid-cols-2 gap-1.5">
                <Input value={it.price} onChange={(e) => set({ price: e.target.value })} placeholder="19€" className="h-8 text-xs" />
                <Input value={it.period ?? ''} onChange={(e) => set({ period: e.target.value })} placeholder="/mois" className="h-8 text-xs" />
              </div>
              <Textarea value={it.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="Description courte" rows={2} className="text-xs resize-y" />
              <Textarea
                value={it.features.join('\n')}
                onChange={(e) => set({ features: e.target.value.split('\n').filter(Boolean) })}
                placeholder="Une feature par ligne"
                rows={4}
                className="text-xs resize-y"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <Input value={it.ctaText} onChange={(e) => set({ ctaText: e.target.value })} placeholder="Texte CTA" className="h-8 text-xs" />
                <Input value={it.ctaLink} onChange={(e) => set({ ctaLink: e.target.value })} placeholder="Lien" className="h-8 text-xs" />
              </div>
              <Input value={it.badge ?? ''} onChange={(e) => set({ badge: e.target.value })} placeholder="Badge (Populaire, etc.)" className="h-8 text-xs" />
              <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Mis en avant</span><Switch checked={it.highlighted ?? false} onCheckedChange={(v) => set({ highlighted: v })} /></div>
            </>
          )}
          addItem={() => ({ name: 'Nouveau plan', price: '0€', features: [], ctaText: 'Choisir', ctaLink: '#' })}
        />
      </Group>
    </>
  )
}

export function CompareTableFields({ props, onChange }: { props: CompareTableProps; onChange: (p: Partial<CompareTableProps>) => void }) {
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
        <Field label="Colonnes (une par ligne)">
          <Textarea
            value={props.columns.join('\n')}
            onChange={(e) => onChange({ columns: e.target.value.split('\n').filter(Boolean) })}
            rows={4}
            className="text-xs resize-y"
          />
        </Field>
        <Field label="Colonne mise en avant"><Input type="number" min={-1} value={props.highlightColumn ?? -1} onChange={(e) => onChange({ highlightColumn: Number(e.target.value) })} /></Field>
      </Group>
      <Group title={`Lignes (${props.rows.length})`} defaultOpen>
        <RepeaterList<CompareRow>
          items={props.rows}
          onChange={(rows) => onChange({ rows })}
          render={(it, set) => (
            <>
              <Input value={it.feature} onChange={(e) => set({ feature: e.target.value })} placeholder="Feature" className="h-8 text-xs" />
              <Field label="Valeurs (true/false ou texte, séparées par |)" className="!space-y-1">
                <Input
                  value={it.values.map((v) => (typeof v === 'boolean' ? (v ? 'true' : 'false') : v)).join(' | ')}
                  onChange={(e) =>
                    set({
                      values: e.target.value.split('|').map((v) => {
                        const t = v.trim()
                        if (t === 'true') return true
                        if (t === 'false') return false
                        return t
                      }),
                    })
                  }
                  className="h-8 text-xs font-mono"
                />
              </Field>
            </>
          )}
          addItem={() => ({ feature: 'Nouvelle ligne', values: [] })}
        />
      </Group>
    </>
  )
}

export function CountdownFields({ props, onChange }: { props: CountdownProps; onChange: (p: Partial<CountdownProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      <Field label="Date cible (ISO)">
        <Input
          type="datetime-local"
          value={props.targetDate ? new Date(props.targetDate).toISOString().slice(0, 16) : ''}
          onChange={(e) => onChange({ targetDate: new Date(e.target.value).toISOString() })}
          className="font-mono text-xs"
        />
      </Field>
      <Field label="Variant">
        <Pills value={props.variant ?? 'large'} onChange={(v) => onChange({ variant: v })}
          options={[{ value: 'large', label: 'Large' }, { value: 'compact', label: 'Compact' }]} />
      </Field>
      <Field label="Message à expiration"><Input value={props.expiredMessage ?? ''} onChange={(e) => onChange({ expiredMessage: e.target.value })} /></Field>
    </Group>
  )
}

export function NotificationBarFields({ props, onChange }: { props: NotificationBarProps; onChange: (p: Partial<NotificationBarProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Message"><Textarea value={props.message} onChange={(e) => onChange({ message: e.target.value })} rows={2} className="resize-y" /></Field>
      <Field label="Texte CTA"><Input value={props.ctaText ?? ''} onChange={(e) => onChange({ ctaText: e.target.value })} /></Field>
      <Field label="Lien CTA"><Input value={props.ctaLink ?? ''} onChange={(e) => onChange({ ctaLink: e.target.value })} /></Field>
      <Field label="Variante">
        <Pills value={props.variant ?? 'info'} onChange={(v) => onChange({ variant: v })}
          options={[{ value: 'info', label: 'Info' }, { value: 'success', label: 'Succès' }, { value: 'warning', label: 'Attention' }, { value: 'destructive', label: 'Erreur' }]} />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Fermable" className="flex-1"><span className="sr-only">dismissible</span></Field>
        <Switch checked={props.dismissible ?? true} onCheckedChange={(v) => onChange({ dismissible: v })} />
      </div>
    </Group>
  )
}

export function NewsletterFields({ props, onChange }: { props: NewsletterProps; onChange: (p: Partial<NewsletterProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      <Field label="Description"><Textarea value={props.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} rows={2} className="resize-y" /></Field>
      <Field label="Placeholder champ email"><Input value={props.placeholder ?? ''} onChange={(e) => onChange({ placeholder: e.target.value })} /></Field>
      <Field label="Texte du bouton"><Input value={props.buttonText} onChange={(e) => onChange({ buttonText: e.target.value })} /></Field>
      <Field label="Endpoint POST (optionnel)"><Input value={props.endpoint ?? ''} onChange={(e) => onChange({ endpoint: e.target.value })} placeholder="/api/newsletter/subscribe" className="font-mono text-xs" /></Field>
      <Field label="Message de succès"><Input value={props.successMessage ?? ''} onChange={(e) => onChange({ successMessage: e.target.value })} /></Field>
    </Group>
  )
}

export function TrustBadgesFields({ props, onChange }: { props: TrustBadgesProps; onChange: (p: Partial<TrustBadgesProps>) => void }) {
  return (
    <>
      <Group title="Affichage" defaultOpen>
        <Field label="Alignement">
          <Pills value={props.align ?? 'center'} onChange={(v) => onChange({ align: v })}
            options={[{ value: 'left', label: 'Gauche' }, { value: 'center', label: 'Centre' }]} />
        </Field>
      </Group>
      <Group title={`Badges (${props.badges.length})`} defaultOpen>
        <RepeaterList
          items={props.badges}
          onChange={(badges) => onChange({ badges })}
          render={(it, set) => (
            <>
              <Input value={it.label} onChange={(e) => set({ label: e.target.value })} placeholder="Texte" className="h-8 text-xs" />
              <IconPicker value={it.icon ?? ''} onChange={(icon) => set({ icon })} />
            </>
          )}
          addItem={() => ({ label: 'Nouveau badge', icon: 'shield' })}
        />
      </Group>
    </>
  )
}

export function PressMentionsFields({ props, onChange }: { props: PressMentionsProps; onChange: (p: Partial<PressMentionsProps>) => void }) {
  return (
    <>
      <Group title="Affichage" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      </Group>
      <Group title={`Logos (${props.logos.length})`} defaultOpen>
        <RepeaterList<PressMentionsProps['logos'][number]>
          items={props.logos}
          onChange={(logos) => onChange({ logos })}
          render={(it, set) => (
            <>
              <ImageUpload value={it.url} onChange={(url) => set({ url })} compact />
              <Input value={it.alt} onChange={(e) => set({ alt: e.target.value })} placeholder="Nom du média" className="h-8 text-xs" />
              <Input value={it.href ?? ''} onChange={(e) => set({ href: e.target.value })} placeholder="Lien (optionnel)" className="h-8 text-xs" />
            </>
          )}
          addItem={() => ({ url: '', alt: 'Média', href: '' })}
        />
      </Group>
    </>
  )
}

export function StarRatingFields({ props, onChange }: { props: StarRatingProps; onChange: (p: Partial<StarRatingProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Note"><SliderControl value={props.value} onChange={(v) => onChange({ value: v })} min={0} max={5} step={0.1} /></Field>
      <Field label="Nombre d'avis"><Input type="number" value={props.count ?? 0} onChange={(e) => onChange({ count: Number(e.target.value) })} /></Field>
      <Field label="Taille">
        <Pills value={props.size ?? 'md'} onChange={(v) => onChange({ size: v })}
          options={[{ value: 'sm', label: 'Sm' }, { value: 'md', label: 'Md' }, { value: 'lg', label: 'Lg' }]} />
      </Field>
    </Group>
  )
}

// ───────────────────────────── Engagement ─────────────────────────────

export function QuizFields({ props, onChange }: { props: QuizProps; onChange: (p: Partial<QuizProps>) => void }) {
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      </Group>
      <Group title={`Questions (${props.questions.length})`} defaultOpen>
        <RepeaterList<QuizProps['questions'][number]>
          items={props.questions}
          onChange={(questions) => onChange({ questions })}
          render={(it, set) => (
            <>
              <Textarea value={it.question} onChange={(e) => set({ question: e.target.value })} placeholder="Question" rows={2} className="text-xs resize-y" />
              <Textarea
                value={it.options.join('\n')}
                onChange={(e) => set({ options: e.target.value.split('\n').filter(Boolean) })}
                placeholder="Options (une par ligne)"
                rows={4}
                className="text-xs resize-y"
              />
              <Field label="Index de la bonne réponse (0-based)" className="!space-y-1"><Input type="number" min={0} value={it.correct} onChange={(e) => set({ correct: Number(e.target.value) })} /></Field>
              <Textarea value={it.explanation ?? ''} onChange={(e) => set({ explanation: e.target.value })} placeholder="Explication (optionnelle)" rows={2} className="text-xs resize-y" />
            </>
          )}
          addItem={() => ({ question: 'Nouvelle question ?', options: ['Option 1', 'Option 2'], correct: 0, explanation: '' })}
        />
      </Group>
    </>
  )
}

export function PollFields({ props, onChange }: { props: PollProps; onChange: (p: Partial<PollProps>) => void }) {
  return (
    <>
      <Group title="Contenu" defaultOpen>
        <Field label="Question"><Input value={props.question} onChange={(e) => onChange({ question: e.target.value })} /></Field>
      </Group>
      <Group title={`Options (${props.options.length})`} defaultOpen>
        <RepeaterList
          items={props.options}
          onChange={(options) => onChange({ options })}
          render={(it, set) => (
            <Input value={it.label} onChange={(e) => set({ label: e.target.value })} placeholder="Option" className="h-8 text-xs" />
          )}
          addItem={() => ({ label: 'Nouvelle option', votes: 0 })}
        />
      </Group>
    </>
  )
}

export function CalculatorFields({ props, onChange }: { props: CalculatorProps; onChange: (p: Partial<CalculatorProps>) => void }) {
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
        <Field label="Description"><Textarea value={props.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} rows={2} className="resize-y" /></Field>
      </Group>
      <Group title={`Champs (${props.fields.length})`} defaultOpen>
        <RepeaterList<CalculatorProps['fields'][number]>
          items={props.fields}
          onChange={(fields) => onChange({ fields })}
          render={(it, set) => (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <Input value={it.name} onChange={(e) => set({ name: e.target.value })} placeholder="nom" className="h-8 text-xs font-mono" />
                <Input value={it.label} onChange={(e) => set({ label: e.target.value })} placeholder="Libellé" className="h-8 text-xs" />
              </div>
              <Pills
                value={it.type}
                onChange={(v) => set({ type: v })}
                options={[{ value: 'number', label: 'Nombre' }, { value: 'select', label: 'Liste' }]}
              />
              <Input value={String(it.defaultValue ?? '')} onChange={(e) => set({ defaultValue: it.type === 'number' ? Number(e.target.value) : e.target.value })} placeholder="Valeur par défaut" className="h-8 text-xs" />
              <Input value={it.unit ?? ''} onChange={(e) => set({ unit: e.target.value })} placeholder="Unité (€, %, kg…)" className="h-8 text-xs" />
            </>
          )}
          addItem={() => ({ name: 'champ', label: 'Nouveau champ', type: 'number', defaultValue: 0, unit: '' })}
        />
      </Group>
      <Group title="Formule">
        <Field label="Expression JS" hint="Utilisez les noms des champs (ex: salary * 0.65)">
          <Textarea value={props.formula} onChange={(e) => onChange({ formula: e.target.value })} rows={3} className="font-mono text-xs resize-y" />
        </Field>
        <Field label="Libellé du résultat"><Input value={props.resultLabel} onChange={(e) => onChange({ resultLabel: e.target.value })} /></Field>
        <Field label="Unité"><Input value={props.resultUnit ?? ''} onChange={(e) => onChange({ resultUnit: e.target.value })} placeholder="€" /></Field>
        <Field label="Précision (décimales)"><Input type="number" min={0} max={6} value={props.resultPrecision ?? 2} onChange={(e) => onChange({ resultPrecision: Number(e.target.value) })} /></Field>
      </Group>
    </>
  )
}

export function ReactionsFields({ props, onChange }: { props: ReactionsProps; onChange: (p: Partial<ReactionsProps>) => void }) {
  return (
    <Group title={`Réactions (${props.reactions.length})`} defaultOpen>
      <RepeaterList
        items={props.reactions}
        onChange={(reactions) => onChange({ reactions })}
        render={(it, set) => (
          <div className="grid grid-cols-3 gap-1.5">
            <Input value={it.emoji} onChange={(e) => set({ emoji: e.target.value })} placeholder="👍" className="h-8 text-xs text-center" />
            <Input value={it.label} onChange={(e) => set({ label: e.target.value })} placeholder="Label" className="h-8 text-xs col-span-2" />
          </div>
        )}
        addItem={() => ({ emoji: '😀', label: 'Réaction', count: 0 })}
      />
    </Group>
  )
}

export function ShareButtonsFields({ props, onChange }: { props: ShareButtonsProps; onChange: (p: Partial<ShareButtonsProps>) => void }) {
  const all = ['twitter', 'linkedin', 'facebook', 'email', 'whatsapp', 'copy'] as const
  return (
    <Group title="Réglages" defaultOpen>
      <Field label="Plateformes">
        <div className="grid grid-cols-2 gap-1.5">
          {all.map((p) => {
            const active = props.platforms.includes(p)
            return (
              <button
                key={p}
                type="button"
                onClick={() =>
                  onChange({ platforms: active ? props.platforms.filter((x) => x !== p) : [...props.platforms, p] })
                }
                className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${active ? 'border-primary bg-primary/10 text-primary' : 'border-input'}`}
              >
                {p}
              </button>
            )
          })}
        </div>
      </Field>
      <Field label="Alignement"><Pills value={props.align ?? 'left'} onChange={(v) => onChange({ align: v })} options={[{ value: 'left', label: 'Gauche' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Droite' }]} /></Field>
      <Field label="Taille"><Pills value={props.size ?? 'md'} onChange={(v) => onChange({ size: v })} options={[{ value: 'sm', label: 'Sm' }, { value: 'md', label: 'Md' }, { value: 'lg', label: 'Lg' }]} /></Field>
      <Field label="UTM Campaign (optionnel)"><Input value={props.utmCampaign ?? ''} onChange={(e) => onChange({ utmCampaign: e.target.value })} /></Field>
    </Group>
  )
}

// ───────────────────────────── Time / Nav / Editorial ─────────────────────────────

export function OpeningHoursFields({ props, onChange }: { props: OpeningHoursProps; onChange: (p: Partial<OpeningHoursProps>) => void }) {
  const days: { key: OpeningHoursProps['schedule'][number]['day']; label: string }[] = [
    { key: 'mon', label: 'Lundi' },
    { key: 'tue', label: 'Mardi' },
    { key: 'wed', label: 'Mercredi' },
    { key: 'thu', label: 'Jeudi' },
    { key: 'fri', label: 'Vendredi' },
    { key: 'sat', label: 'Samedi' },
    { key: 'sun', label: 'Dimanche' },
  ]
  const updateDay = (key: OpeningHoursProps['schedule'][number]['day'], patch: Partial<OpeningHoursProps['schedule'][number]>) => {
    const existing = props.schedule.find((s) => s.day === key)
    if (existing) {
      onChange({ schedule: props.schedule.map((s) => (s.day === key ? { ...s, ...patch } : s)) })
    } else {
      onChange({ schedule: [...props.schedule, { day: key, ...patch }] })
    }
  }
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Afficher le statut" className="flex-1"><span className="sr-only">status</span></Field>
          <Switch checked={props.showCurrentStatus ?? true} onCheckedChange={(v) => onChange({ showCurrentStatus: v })} />
        </div>
      </Group>
      <Group title="Horaires" defaultOpen>
        {days.map(({ key, label }) => {
          const day = props.schedule.find((s) => s.day === key)
          return (
            <div key={key} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-xs">
              <span className="font-medium">{label}</span>
              <Input type="time" value={day?.open ?? ''} onChange={(e) => updateDay(key, { open: e.target.value, closed: false })} disabled={day?.closed} className="h-7 text-xs w-24" />
              <Input type="time" value={day?.close ?? ''} onChange={(e) => updateDay(key, { close: e.target.value, closed: false })} disabled={day?.closed} className="h-7 text-xs w-24" />
              <Switch checked={!day?.closed} onCheckedChange={(v) => updateDay(key, { closed: !v })} />
            </div>
          )
        })}
      </Group>
    </>
  )
}

export function LastUpdatedFields({ props, onChange }: { props: LastUpdatedProps; onChange: (p: Partial<LastUpdatedProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Date (laisser vide pour utiliser la page)"><Input type="date" value={props.date ? props.date.slice(0, 10) : ''} onChange={(e) => onChange({ date: e.target.value })} /></Field>
      <Field label="Format"><Pills value={props.format ?? 'long'} onChange={(v) => onChange({ format: v })} options={[{ value: 'long', label: 'Complet' }, { value: 'short', label: 'Court' }, { value: 'relative', label: 'Relatif' }]} /></Field>
      <Field label="Préfixe"><Input value={props.prefix ?? ''} onChange={(e) => onChange({ prefix: e.target.value })} /></Field>
    </Group>
  )
}

export function TableOfContentsFields({ props, onChange }: { props: TableOfContentsProps; onChange: (p: Partial<TableOfContentsProps>) => void }) {
  return (
    <Group title="Réglages" defaultOpen>
      <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      <Field label="Profondeur max"><Pills value={props.maxLevel ?? 3} onChange={(v) => onChange({ maxLevel: v as 2 | 3 | 4 })} options={[{ value: 2, label: 'H2' }, { value: 3, label: 'H3' }, { value: 4, label: 'H4' }]} /></Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Sticky" className="flex-1"><span className="sr-only">sticky</span></Field>
        <Switch checked={props.sticky ?? false} onCheckedChange={(v) => onChange({ sticky: v })} />
      </div>
    </Group>
  )
}

export function AnchorMenuFields({ props, onChange }: { props: AnchorMenuProps; onChange: (p: Partial<AnchorMenuProps>) => void }) {
  return (
    <>
      <Group title="Réglages" defaultOpen>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Sticky" className="flex-1"><span className="sr-only">sticky</span></Field>
          <Switch checked={props.sticky ?? true} onCheckedChange={(v) => onChange({ sticky: v })} />
        </div>
      </Group>
      <Group title={`Items (${props.items.length})`} defaultOpen>
        <RepeaterList
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(it, set) => (
            <div className="grid grid-cols-2 gap-1.5">
              <Input value={it.label} onChange={(e) => set({ label: e.target.value })} placeholder="Libellé" className="h-8 text-xs" />
              <Input value={it.anchor} onChange={(e) => set({ anchor: e.target.value })} placeholder="ancre" className="h-8 text-xs font-mono" />
            </div>
          )}
          addItem={() => ({ label: 'Nouvelle section', anchor: 'section' })}
        />
      </Group>
    </>
  )
}

export function ArticleHeaderFields({ props, onChange }: { props: ArticleHeaderProps; onChange: (p: Partial<ArticleHeaderProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Catégorie"><Input value={props.category ?? ''} onChange={(e) => onChange({ category: e.target.value })} /></Field>
      <Field label="Titre"><Textarea value={props.title} onChange={(e) => onChange({ title: e.target.value })} rows={2} className="resize-y" /></Field>
      <Field label="Résumé / Sous-titre"><Textarea value={props.excerpt ?? ''} onChange={(e) => onChange({ excerpt: e.target.value })} rows={2} className="resize-y" /></Field>
      <Field label="Auteur"><Input value={props.authorName ?? ''} onChange={(e) => onChange({ authorName: e.target.value })} /></Field>
      <Field label="Avatar auteur"><ImageUpload value={props.authorAvatar ?? ''} onChange={(url) => onChange({ authorAvatar: url })} compact /></Field>
      <Field label="Date"><Input type="date" value={props.date ? props.date.slice(0, 10) : ''} onChange={(e) => onChange({ date: e.target.value })} /></Field>
      <Field label="Temps de lecture (min)"><Input type="number" min={1} value={props.readingTime ?? 5} onChange={(e) => onChange({ readingTime: Number(e.target.value) })} /></Field>
      <Field label="Image en-tête"><ImageUpload value={props.image ?? ''} onChange={(url) => onChange({ image: url })} /></Field>
    </Group>
  )
}

export function AuthorBioFields({ props, onChange }: { props: AuthorBioProps; onChange: (p: Partial<AuthorBioProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Nom"><Input value={props.name} onChange={(e) => onChange({ name: e.target.value })} /></Field>
      <Field label="Bio"><Textarea value={props.bio ?? ''} onChange={(e) => onChange({ bio: e.target.value })} rows={3} className="resize-y" /></Field>
      <Field label="Avatar"><ImageUpload value={props.avatar ?? ''} onChange={(url) => onChange({ avatar: url })} compact /></Field>
      <Field label="Twitter"><Input value={props.twitter ?? ''} onChange={(e) => onChange({ twitter: e.target.value })} /></Field>
      <Field label="LinkedIn"><Input value={props.linkedin ?? ''} onChange={(e) => onChange({ linkedin: e.target.value })} /></Field>
      <Field label="Site web"><Input value={props.website ?? ''} onChange={(e) => onChange({ website: e.target.value })} /></Field>
      <Field label="Email"><Input value={props.email ?? ''} onChange={(e) => onChange({ email: e.target.value })} /></Field>
    </Group>
  )
}

export function SponsoredDisclosureFields({ props, onChange }: { props: SponsoredDisclosureProps; onChange: (p: Partial<SponsoredDisclosureProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Sponsor"><Input value={props.sponsor ?? ''} onChange={(e) => onChange({ sponsor: e.target.value })} /></Field>
    </Group>
  )
}

// ───────────────────────────── DocBel-extra ─────────────────────────────

export function BelgianDateHelperFields({ props, onChange }: { props: BelgianDateHelperProps; onChange: (p: Partial<BelgianDateHelperProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Étiquette"><Input value={props.label ?? ''} onChange={(e) => onChange({ label: e.target.value })} /></Field>
      <Field label="Date de départ"><Input type="date" value={props.startDate ? props.startDate.slice(0, 10) : ''} onChange={(e) => onChange({ startDate: e.target.value })} /></Field>
      <Field label="Nombre de jours"><Input type="number" min={1} value={props.daysToAdd} onChange={(e) => onChange({ daysToAdd: Number(e.target.value) })} /></Field>
      <Field label="Type de jours">
        <Pills value={props.countWeekendsAndHolidays} onChange={(v) => onChange({ countWeekendsAndHolidays: v })}
          options={[{ value: 'businessOnly', label: 'Ouvrables (BE)' }, { value: 'all', label: 'Calendrier' }]} />
      </Field>
    </Group>
  )
}

export function TarifsTableFields({ props, onChange }: { props: TarifsTableProps; onChange: (p: Partial<TarifsTableProps>) => void }) {
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
        <Field label="Sous-titre"><Input value={props.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} /></Field>
        <Field label="Source"><Input value={props.source ?? ''} onChange={(e) => onChange({ source: e.target.value })} placeholder="SPF Sécurité sociale" /></Field>
      </Group>
      <Group title={`Lignes (${props.rows.length})`} defaultOpen>
        <RepeaterList<TarifsRow>
          items={props.rows}
          onChange={(rows) => onChange({ rows })}
          render={(it, set) => (
            <>
              <Input value={it.situation} onChange={(e) => set({ situation: e.target.value })} placeholder="Situation" className="h-8 text-xs" />
              <div className="grid grid-cols-2 gap-1.5">
                <Input value={it.montant} onChange={(e) => set({ montant: e.target.value })} placeholder="Montant" className="h-8 text-xs" />
                <Input value={it.periode ?? ''} onChange={(e) => set({ periode: e.target.value })} placeholder="/mois" className="h-8 text-xs" />
              </div>
              <Input value={it.remarque ?? ''} onChange={(e) => set({ remarque: e.target.value })} placeholder="Remarque (optionnel)" className="h-8 text-xs" />
            </>
          )}
          addItem={() => ({ situation: 'Nouvelle situation', montant: '0,00 €' })}
        />
      </Group>
    </>
  )
}

export function EligibilityTestFields({ props, onChange }: { props: EligibilityTestProps; onChange: (p: Partial<EligibilityTestProps>) => void }) {
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
        <Field label="Texte d'intro"><Textarea value={props.introText ?? ''} onChange={(e) => onChange({ introText: e.target.value })} rows={2} className="resize-y" /></Field>
      </Group>
      <Group title={`Questions (${props.questions.length})`} defaultOpen>
        <RepeaterList<EligibilityTestProps['questions'][number]>
          items={props.questions}
          onChange={(questions) => onChange({ questions })}
          render={(it, set) => (
            <>
              <Textarea value={it.question} onChange={(e) => set({ question: e.target.value })} rows={2} placeholder="Question" className="text-xs resize-y" />
              <Pills value={it.type} onChange={(v) => set({ type: v })} options={[{ value: 'yesno', label: 'Oui/Non' }, { value: 'select', label: 'Liste' }]} />
            </>
          )}
          addItem={() => ({ question: 'Nouvelle question ?', type: 'yesno' })}
        />
      </Group>
      <Group title="Règles">
        <Field label="Résultat positif"><Textarea value={props.rules.resultIfPass} onChange={(e) => onChange({ rules: { ...props.rules, resultIfPass: e.target.value } })} rows={2} className="resize-y" /></Field>
        <Field label="Résultat négatif"><Textarea value={props.rules.resultIfFail} onChange={(e) => onChange({ rules: { ...props.rules, resultIfFail: e.target.value } })} rows={2} className="resize-y" /></Field>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Toutes les réponses doivent être Oui" className="flex-1"><span className="sr-only">allYes</span></Field>
          <Switch checked={props.rules.allYes ?? false} onCheckedChange={(v) => onChange({ rules: { ...props.rules, allYes: v } })} />
        </div>
      </Group>
    </>
  )
}

export function LawCitationFields({ props, onChange }: { props: LawCitationProps; onChange: (p: Partial<LawCitationProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Référence"><Input value={props.reference} onChange={(e) => onChange({ reference: e.target.value })} placeholder="Art. 23 — LOI du 26 mai 2002" /></Field>
      <Field label="Texte cité"><Textarea value={props.text} onChange={(e) => onChange({ text: e.target.value })} rows={4} className="resize-y" /></Field>
      <Field label="Source"><Input value={props.source ?? ''} onChange={(e) => onChange({ source: e.target.value })} placeholder="Moniteur belge" /></Field>
      <Field label="Lien"><Input value={props.link ?? ''} onChange={(e) => onChange({ link: e.target.value })} /></Field>
    </Group>
  )
}

export function CasePracticeFields({ props, onChange }: { props: CasePracticeProps; onChange: (p: Partial<CasePracticeProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre"><Input value={props.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      <Field label="Situation"><Textarea value={props.situation} onChange={(e) => onChange({ situation: e.target.value })} rows={3} className="resize-y" /></Field>
      <Field label="Étapes (une par ligne)">
        <Textarea
          value={props.steps.join('\n')}
          onChange={(e) => onChange({ steps: e.target.value.split('\n').filter(Boolean) })}
          rows={5}
          className="text-xs resize-y"
        />
      </Field>
      <Field label="Résultat"><Textarea value={props.outcome ?? ''} onChange={(e) => onChange({ outcome: e.target.value })} rows={2} className="resize-y" /></Field>
    </Group>
  )
}

export function RequiredDocsFields({ props, onChange }: { props: RequiredDocsProps; onChange: (p: Partial<RequiredDocsProps>) => void }) {
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre"><Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      </Group>
      <Group title={`Documents (${props.items.length})`} defaultOpen>
        <RepeaterList<RequiredDoc>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(it, set) => (
            <>
              <Input value={it.name} onChange={(e) => set({ name: e.target.value })} placeholder="Nom du document" className="h-8 text-xs" />
              <Input value={it.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="Description (optionnel)" className="h-8 text-xs" />
              <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Obligatoire</span><Switch checked={it.required ?? true} onCheckedChange={(v) => set({ required: v })} /></div>
            </>
          )}
          addItem={() => ({ name: 'Nouveau document', required: true })}
        />
      </Group>
    </>
  )
}

export function LegalDelayFields({ props, onChange }: { props: LegalDelayProps; onChange: (p: Partial<LegalDelayProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Délai"><Input value={props.delay} onChange={(e) => onChange({ delay: e.target.value })} placeholder="30 jours" /></Field>
      <Field label="Contexte"><Input value={props.context} onChange={(e) => onChange({ context: e.target.value })} placeholder="pour répondre à une décision" /></Field>
      <Field label="Variant"><Pills value={props.variant ?? 'large'} onChange={(v) => onChange({ variant: v })} options={[{ value: 'large', label: 'Large' }, { value: 'inline', label: 'Inline' }]} /></Field>
    </Group>
  )
}

// ───────────────────────────── Utility / Story ─────────────────────────────

export function HtmlRawFields({ props, onChange }: { props: HtmlRawProps; onChange: (p: Partial<HtmlRawProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="HTML brut" hint="⚠️ Code injecté tel quel · sources de confiance uniquement">
        <Textarea value={props.html} onChange={(e) => onChange({ html: e.target.value })} rows={8} className="font-mono text-xs resize-y" />
      </Field>
    </Group>
  )
}

export function CustomCssFields({ props, onChange }: { props: CustomCssProps; onChange: (p: Partial<CustomCssProps>) => void }) {
  return (
    <Group title="CSS" defaultOpen>
      <Field label="Code CSS" hint="Appliqué à toute la page">
        <Textarea value={props.css} onChange={(e) => onChange({ css: e.target.value })} rows={10} className="font-mono text-xs resize-y" />
      </Field>
    </Group>
  )
}

export function GdprNoticeFields({ props, onChange }: { props: GdprNoticeProps; onChange: (p: Partial<GdprNoticeProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Message"><Textarea value={props.message} onChange={(e) => onChange({ message: e.target.value })} rows={3} className="resize-y" /></Field>
      <Field label="Texte Accepter"><Input value={props.acceptText} onChange={(e) => onChange({ acceptText: e.target.value })} /></Field>
      <Field label="Texte Refuser"><Input value={props.declineText ?? ''} onChange={(e) => onChange({ declineText: e.target.value })} /></Field>
      <Field label="Lien (politique)"><Input value={props.link ?? ''} onChange={(e) => onChange({ link: e.target.value })} /></Field>
      <Field label="Texte du lien"><Input value={props.linkText ?? ''} onChange={(e) => onChange({ linkText: e.target.value })} /></Field>
    </Group>
  )
}

export function MapEmbedFields({ props, onChange }: { props: MapEmbedProps; onChange: (p: Partial<MapEmbedProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Adresse / Recherche"><Input value={props.query} onChange={(e) => onChange({ query: e.target.value })} placeholder="Rue de la Loi 16, Bruxelles" /></Field>
      <Field label="Zoom"><SliderControl value={props.zoom ?? 14} onChange={(v) => onChange({ zoom: v })} min={1} max={19} /></Field>
      <Field label="Hauteur"><SliderControl value={props.height ?? 400} onChange={(v) => onChange({ height: v })} min={150} max={800} suffix="px" /></Field>
      <Field label="Légende"><Input value={props.caption ?? ''} onChange={(e) => onChange({ caption: e.target.value })} /></Field>
    </Group>
  )
}

export function MarqueeFields({ props, onChange }: { props: MarqueeProps; onChange: (p: Partial<MarqueeProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Texte"><Input value={props.text} onChange={(e) => onChange({ text: e.target.value })} /></Field>
      <Field label="Vitesse"><Pills value={props.speed ?? 'normal'} onChange={(v) => onChange({ speed: v })} options={[{ value: 'slow', label: 'Lente' }, { value: 'normal', label: 'Normale' }, { value: 'fast', label: 'Rapide' }]} /></Field>
      <Field label="Couleur"><ColorControl value={props.color} onChange={(v) => onChange({ color: v })} /></Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Sens inversé" className="flex-1"><span className="sr-only">reverse</span></Field>
        <Switch checked={props.reverse ?? false} onCheckedChange={(v) => onChange({ reverse: v })} />
      </div>
    </Group>
  )
}

export function TiltCardFields({ props, onChange }: { props: TiltCardProps; onChange: (p: Partial<TiltCardProps>) => void }) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre"><Input value={props.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      <Field label="Description"><Textarea value={props.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} rows={2} className="resize-y" /></Field>
      <Field label="Image"><ImageUpload value={props.image ?? ''} onChange={(url) => onChange({ image: url })} /></Field>
      <Field label="Lien"><Input value={props.link ?? ''} onChange={(e) => onChange({ link: e.target.value })} /></Field>
    </Group>
  )
}

export function ImageHotspotsFields({ props, onChange }: { props: ImageHotspotsProps; onChange: (p: Partial<ImageHotspotsProps>) => void }) {
  return (
    <>
      <Group title="Image" defaultOpen>
        <Field label="Image"><ImageUpload value={props.image} onChange={(url) => onChange({ image: url })} /></Field>
        <Field label="Alt"><Input value={props.alt ?? ''} onChange={(e) => onChange({ alt: e.target.value })} /></Field>
      </Group>
      <Group title={`Points (${props.hotspots.length})`} defaultOpen>
        <RepeaterList<HotspotPoint>
          items={props.hotspots}
          onChange={(hotspots) => onChange({ hotspots })}
          render={(it, set) => (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <Field label="X (%)"><Input type="number" min={0} max={100} value={it.x} onChange={(e) => set({ x: Number(e.target.value) })} className="h-8 text-xs" /></Field>
                <Field label="Y (%)"><Input type="number" min={0} max={100} value={it.y} onChange={(e) => set({ y: Number(e.target.value) })} className="h-8 text-xs" /></Field>
              </div>
              <Input value={it.title} onChange={(e) => set({ title: e.target.value })} placeholder="Titre" className="h-8 text-xs" />
              <Textarea value={it.description} onChange={(e) => set({ description: e.target.value })} placeholder="Description" rows={2} className="text-xs resize-y" />
            </>
          )}
          addItem={() => ({ x: 50, y: 50, title: 'Nouveau point', description: '' })}
        />
      </Group>
    </>
  )
}

// Generic fallback for blocks where the schema is too custom — direct JSON editing.
export function GenericPropsFields<T extends object>({ props, onChange }: { props: T; onChange: (p: Partial<T>) => void }) {
  const [text, setText] = React.useState(() => JSON.stringify(props, null, 2))
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(JSON.stringify(props, null, 2))
  }, [props])
  return (
    <Group title="Propriétés (JSON)" defaultOpen>
      <Field label="JSON" hint="⚠️ Édition avancée — modifiez directement les propriétés">
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            try {
              const parsed = JSON.parse(e.target.value)
              setError(null)
              onChange(parsed)
            } catch (err) {
              setError(String(err))
            }
          }}
          rows={12}
          className="font-mono text-xs resize-y"
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </Field>
    </Group>
  )
}

// Used by RichTextInput/Quote/etc — re-export for completeness if needed
export { RichTextInput }
