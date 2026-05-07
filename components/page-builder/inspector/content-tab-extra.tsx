'use client'

/**
 * Inspector Content tab forms for all the "new" block types
 * (UI shadcn-style + DocBel). Kept separate so content-tab.tsx stays readable.
 */

import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
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
  CardProps,
  AccordionProps,
  AccordionItemData,
  TabItem,
  TabsProps,
  AlertProps,
  BadgesProps,
  BadgeItem,
  ProgressProps,
  ButtonGroupProps,
  ButtonGroupItem,
  DocumentProps,
  StepsProps,
  StepItem,
  OrganismeProps,
  GlossaryProps,
  GlossaryTerm,
  CounterProps,
  CounterItem,
  CollectionProps,
  FormProps,
  FormFieldDef,
} from '@/lib/page-builder/types'
import { Field, Group, Pills, ColorControl, SliderControl } from './controls'
import { ImageUpload } from './image-upload'
import { DocumentUpload } from './document-upload'
import { RichTextInput } from './rich-text-input'

// ─────────────────────────── Card ───────────────────────────

export function CardFields({
  props,
  onChange,
}: {
  props: CardProps
  onChange: (p: Partial<CardProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre">
        <Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} />
      </Field>
      <Field label="Description">
        <Textarea
          value={props.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="resize-y"
        />
      </Field>
      <Field label="Image">
        <ImageUpload value={props.image ?? ''} onChange={(url) => onChange({ image: url })} />
      </Field>
      <Field label="Corps (rich-text)">
        <RichTextInput
          value={props.body ?? ''}
          onChange={(html) => onChange({ body: html })}
          placeholder="(optionnel)"
        />
      </Field>
      <Field label="Texte du bouton">
        <Input
          value={props.ctaText ?? ''}
          onChange={(e) => onChange({ ctaText: e.target.value })}
          placeholder="(optionnel)"
        />
      </Field>
      <Field label="Lien">
        <Input
          value={props.ctaLink ?? ''}
          onChange={(e) => onChange({ ctaLink: e.target.value })}
        />
      </Field>
    </Group>
  )
}

// ─────────────────────────── Accordion ───────────────────────────

export function AccordionFields({
  props,
  onChange,
}: {
  props: AccordionProps
  onChange: (p: Partial<AccordionProps>) => void
}) {
  return (
    <>
      <Group title="Comportement" defaultOpen>
        <Field label="Type">
          <Pills
            value={props.type ?? 'single'}
            onChange={(v) => onChange({ type: v })}
            options={[
              { value: 'single', label: 'Un à la fois' },
              { value: 'multiple', label: 'Multiple' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Sections (${props.items.length})`} defaultOpen>
        <RepeaterList<AccordionItemData>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <Input
                value={item.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Titre"
                className="h-8 text-xs"
              />
              <Textarea
                value={item.content}
                onChange={(e) => set({ content: e.target.value })}
                placeholder="Contenu"
                rows={3}
                className="resize-y text-xs"
              />
            </>
          )}
          addItem={() => ({ title: 'Nouvelle section', content: '' })}
        />
      </Group>
    </>
  )
}

// ─────────────────────────── Tabs ───────────────────────────

export function TabsFields({
  props,
  onChange,
}: {
  props: TabsProps
  onChange: (p: Partial<TabsProps>) => void
}) {
  return (
    <Group title={`Onglets (${props.items.length})`} defaultOpen>
      <RepeaterList<TabItem>
        items={props.items}
        onChange={(items) => onChange({ items })}
        render={(item, set) => (
          <>
            <Input
              value={item.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="Libellé de l’onglet"
              className="h-8 text-xs"
            />
            <Textarea
              value={item.content}
              onChange={(e) => set({ content: e.target.value })}
              placeholder="Contenu (HTML autorisé)"
              rows={3}
              className="resize-y text-xs"
            />
          </>
        )}
        addItem={() => ({ label: 'Nouvel onglet', content: '' })}
      />
    </Group>
  )
}

// ─────────────────────────── Alert ───────────────────────────

export function AlertFields({
  props,
  onChange,
}: {
  props: AlertProps
  onChange: (p: Partial<AlertProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre (optionnel)">
        <Input
          value={props.title ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Message">
        <Textarea
          value={props.message}
          onChange={(e) => onChange({ message: e.target.value })}
          rows={3}
          className="resize-y"
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Fermable" className="flex-1">
          <span className="sr-only">Dismissible</span>
        </Field>
        <Switch
          checked={props.dismissible ?? false}
          onCheckedChange={(v) => onChange({ dismissible: v })}
        />
      </div>
    </Group>
  )
}

// ─────────────────────────── Badges ───────────────────────────

export function BadgesFields({
  props,
  onChange,
}: {
  props: BadgesProps
  onChange: (p: Partial<BadgesProps>) => void
}) {
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre (optionnel)">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <Field label="Alignement">
          <Pills
            value={props.align ?? 'left'}
            onChange={(v) => onChange({ align: v })}
            options={[
              { value: 'left', label: 'Gauche' },
              { value: 'center', label: 'Centré' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Badges (${props.items.length})`} defaultOpen>
        <RepeaterList<BadgeItem>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <Input
                value={item.label}
                onChange={(e) => set({ label: e.target.value })}
                placeholder="Texte"
                className="h-8 text-xs"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <Pills
                  value={item.variant ?? 'default'}
                  onChange={(v) => set({ variant: v })}
                  options={[
                    { value: 'default', label: 'Plein' },
                    { value: 'secondary', label: 'Sec.' },
                    { value: 'outline', label: 'Outline' },
                    { value: 'destructive', label: 'Rouge' },
                  ]}
                />
                <ColorControl
                  value={item.color}
                  onChange={(v) => set({ color: v })}
                />
              </div>
            </>
          )}
          addItem={() => ({ label: 'Nouveau badge', variant: 'default' })}
        />
      </Group>
    </>
  )
}

// ─────────────────────────── Progress ───────────────────────────

export function ProgressFields({
  props,
  onChange,
}: {
  props: ProgressProps
  onChange: (p: Partial<ProgressProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Libellé">
        <Input
          value={props.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </Field>
      <Field label="Valeur">
        <SliderControl
          value={props.value}
          onChange={(v) => onChange({ value: v })}
          min={0}
          max={100}
          suffix="%"
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Afficher la valeur" className="flex-1">
          <span className="sr-only">Show value</span>
        </Field>
        <Switch
          checked={props.showValue ?? true}
          onCheckedChange={(v) => onChange({ showValue: v })}
        />
      </div>
      <Field label="Couleur">
        <ColorControl value={props.color} onChange={(v) => onChange({ color: v })} />
      </Field>
    </Group>
  )
}

// ─────────────────────────── Button Group ───────────────────────────

export function ButtonGroupFields({
  props,
  onChange,
}: {
  props: ButtonGroupProps
  onChange: (p: Partial<ButtonGroupProps>) => void
}) {
  return (
    <>
      <Group title="Disposition" defaultOpen>
        <Field label="Alignement">
          <Pills
            value={props.align ?? 'left'}
            onChange={(v) => onChange({ align: v })}
            options={[
              { value: 'left', label: 'Gauche' },
              { value: 'center', label: 'Centre' },
              { value: 'right', label: 'Droite' },
            ]}
          />
        </Field>
        <Field label="Taille">
          <Pills
            value={props.size ?? 'md'}
            onChange={(v) => onChange({ size: v })}
            options={[
              { value: 'sm', label: 'Sm' },
              { value: 'md', label: 'Md' },
              { value: 'lg', label: 'Lg' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Boutons (${props.items.length})`} defaultOpen>
        <RepeaterList<ButtonGroupItem>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <Input
                value={item.text}
                onChange={(e) => set({ text: e.target.value })}
                placeholder="Texte"
                className="h-8 text-xs"
              />
              <Input
                value={item.link}
                onChange={(e) => set({ link: e.target.value })}
                placeholder="Lien"
                className="h-8 text-xs"
              />
              <Pills
                value={item.variant ?? 'primary'}
                onChange={(v) => set({ variant: v })}
                options={[
                  { value: 'primary', label: 'Primary' },
                  { value: 'secondary', label: 'Sec.' },
                  { value: 'outline', label: 'Outline' },
                  { value: 'ghost', label: 'Ghost' },
                ]}
              />
            </>
          )}
          addItem={() => ({ text: 'Nouveau bouton', link: '#', variant: 'primary' })}
        />
      </Group>
    </>
  )
}

// ─────────────────────────── Document ───────────────────────────

export function DocumentFields({
  props,
  onChange,
}: {
  props: DocumentProps
  onChange: (p: Partial<DocumentProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Fichier">
        <DocumentUpload
          fileId={props.fileId}
          url={props.url}
          onChange={(next) => onChange(next)}
        />
      </Field>
      <Field label="Titre">
        <Input value={props.title} onChange={(e) => onChange({ title: e.target.value })} />
      </Field>
      <Field label="Description">
        <Textarea
          value={props.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="resize-y"
        />
      </Field>
      <Field label="Type" hint="Détermine l'icône">
        <Select
          value={props.fileType ?? 'pdf'}
          onValueChange={(v) => onChange({ fileType: v as DocumentProps['fileType'] })}
        >
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="docx">Word (DOCX)</SelectItem>
            <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="archive">Archive (ZIP, RAR)</SelectItem>
            <SelectItem value="other">Autre</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Taille (affichée)">
        <Input
          value={props.size ?? ''}
          onChange={(e) => onChange({ size: e.target.value })}
          placeholder="Ex: 1.2 MB"
        />
      </Field>
      <Field label="Date (affichée)">
        <Input
          value={props.date ?? ''}
          onChange={(e) => onChange({ date: e.target.value })}
          placeholder="Ex: Mis à jour le 15/03/2026"
        />
      </Field>
    </Group>
  )
}

// ─────────────────────────── Steps ───────────────────────────

export function StepsFields({
  props,
  onChange,
}: {
  props: StepsProps
  onChange: (p: Partial<StepsProps>) => void
}) {
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre">
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
        <Field label="Orientation">
          <Pills
            value={props.orientation ?? 'horizontal'}
            onChange={(v) => onChange({ orientation: v })}
            options={[
              { value: 'horizontal', label: 'Horizontale' },
              { value: 'vertical', label: 'Verticale' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Étapes (${props.items.length})`} defaultOpen>
        <RepeaterList<StepItem>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                <Input
                  value={item.icon ?? ''}
                  onChange={(e) => set({ icon: e.target.value })}
                  placeholder="Icône"
                  className="h-8 text-xs"
                />
                <div className="col-span-2">
                  <Input
                    value={item.title}
                    onChange={(e) => set({ title: e.target.value })}
                    placeholder="Titre"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <Textarea
                value={item.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Description"
                rows={2}
                className="resize-y text-xs"
              />
              <Pills
                value={item.status ?? 'todo'}
                onChange={(v) => set({ status: v })}
                options={[
                  { value: 'todo', label: 'À faire' },
                  { value: 'current', label: 'En cours' },
                  { value: 'done', label: 'Fait' },
                ]}
              />
            </>
          )}
          addItem={() => ({ title: 'Nouvelle étape', description: '' })}
        />
      </Group>
    </>
  )
}

// ─────────────────────────── Organisme ───────────────────────────

export function OrganismeFields({
  props,
  onChange,
}: {
  props: OrganismeProps
  onChange: (p: Partial<OrganismeProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Nom">
        <Input value={props.name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Description">
        <Textarea
          value={props.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="resize-y"
        />
      </Field>
      <Field label="Logo">
        <ImageUpload value={props.logo ?? ''} onChange={(url) => onChange({ logo: url })} compact />
      </Field>
      <Field label="Adresse">
        <Input
          value={props.address ?? ''}
          onChange={(e) => onChange({ address: e.target.value })}
        />
      </Field>
      <Field label="Téléphone">
        <Input
          value={props.phone ?? ''}
          onChange={(e) => onChange({ phone: e.target.value })}
        />
      </Field>
      <Field label="Email">
        <Input
          value={props.email ?? ''}
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </Field>
      <Field label="Site web">
        <Input
          value={props.website ?? ''}
          onChange={(e) => onChange({ website: e.target.value })}
        />
      </Field>
      <Field label="Horaires">
        <Input
          value={props.hours ?? ''}
          onChange={(e) => onChange({ hours: e.target.value })}
          placeholder="Lun-Ven 9h-17h"
        />
      </Field>
    </Group>
  )
}

// ─────────────────────────── Glossary ───────────────────────────

export function GlossaryFields({
  props,
  onChange,
}: {
  props: GlossaryProps
  onChange: (p: Partial<GlossaryProps>) => void
}) {
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
      </Group>
      <Group title={`Termes (${props.items.length})`} defaultOpen>
        <RepeaterList<GlossaryTerm>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <Input
                value={item.term}
                onChange={(e) => set({ term: e.target.value })}
                placeholder="Terme"
                className="h-8 text-xs"
              />
              <Textarea
                value={item.definition}
                onChange={(e) => set({ definition: e.target.value })}
                placeholder="Définition"
                rows={2}
                className="resize-y text-xs"
              />
            </>
          )}
          addItem={() => ({ term: 'Nouveau terme', definition: '' })}
        />
      </Group>
    </>
  )
}

// ─────────────────────────── Counter ───────────────────────────

export function CounterFields({
  props,
  onChange,
}: {
  props: CounterProps
  onChange: (p: Partial<CounterProps>) => void
}) {
  return (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre">
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
        <Field label="Durée d’animation (ms)">
          <SliderControl
            value={props.duration ?? 2000}
            onChange={(v) => onChange({ duration: v })}
            min={500}
            max={5000}
            step={100}
            suffix="ms"
          />
        </Field>
      </Group>
      <Group title={`Compteurs (${props.items.length})`} defaultOpen>
        <RepeaterList<CounterItem>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                <Input
                  value={item.prefix ?? ''}
                  onChange={(e) => set({ prefix: e.target.value })}
                  placeholder="Préf."
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
                  value={item.value}
                  onChange={(e) => set({ value: Number(e.target.value) })}
                  placeholder="100"
                  className="h-8 text-xs"
                />
                <Input
                  value={item.suffix ?? ''}
                  onChange={(e) => set({ suffix: e.target.value })}
                  placeholder="Suff."
                  className="h-8 text-xs"
                />
              </div>
              <Input
                value={item.label}
                onChange={(e) => set({ label: e.target.value })}
                placeholder="Libellé"
                className="h-8 text-xs"
              />
            </>
          )}
          addItem={() => ({ value: 0, label: 'Nouvelle métrique' })}
        />
      </Group>
    </>
  )
}

// ─────────────────────────── Collection ───────────────────────────

export function CollectionFields({
  props,
  onChange,
}: {
  props: CollectionProps
  onChange: (p: Partial<CollectionProps>) => void
}) {
  return (
    <Group title="Contenu" defaultOpen>
      <Field label="Source">
        <Pills
          value={props.source}
          onChange={(v) => onChange({ source: v })}
          options={[
            { value: 'news', label: 'Actualités' },
            { value: 'pages', label: 'Pages' },
          ]}
        />
      </Field>
      <Field label="Catégorie (optionnel)">
        <Input
          value={props.category ?? ''}
          onChange={(e) => onChange({ category: e.target.value })}
          placeholder="Toutes catégories"
        />
      </Field>
      <Field label="Limite">
        <SliderControl
          value={props.limit}
          onChange={(v) => onChange({ limit: v })}
          min={1}
          max={20}
        />
      </Field>
      <Field label="Disposition">
        <Pills
          value={props.layout}
          onChange={(v) => onChange({ layout: v })}
          options={[
            { value: 'grid', label: 'Grille' },
            { value: 'list', label: 'Liste' },
            { value: 'carousel', label: 'Carrousel' },
          ]}
        />
      </Field>
      {props.layout === 'grid' && (
        <Field label="Colonnes">
          <Pills
            value={props.columns ?? 3}
            onChange={(v) => onChange({ columns: v as 2 | 3 | 4 })}
            options={[
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]}
          />
        </Field>
      )}
    </Group>
  )
}

// ─────────────────────────── Form ───────────────────────────

const FIELD_TYPES: Array<{ value: FormFieldDef['type']; label: string }> = [
  { value: 'text', label: 'Texte' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Téléphone' },
  { value: 'textarea', label: 'Zone de texte' },
  { value: 'select', label: 'Liste' },
  { value: 'checkbox', label: 'Case à cocher' },
]

export function FormFields({
  props,
  onChange,
}: {
  props: FormProps
  onChange: (p: Partial<FormProps>) => void
}) {
  return (
    <>
      <Group title="Contenu" defaultOpen>
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
            className="resize-y"
          />
        </Field>
        <Field label="Texte du bouton">
          <Input
            value={props.submitText}
            onChange={(e) => onChange({ submitText: e.target.value })}
          />
        </Field>
        <Field label="Message de succès">
          <Input
            value={props.successMessage ?? ''}
            onChange={(e) => onChange({ successMessage: e.target.value })}
          />
        </Field>
      </Group>
      <Group title={`Champs (${props.fields.length})`} defaultOpen>
        <RepeaterList<FormFieldDef>
          items={props.fields}
          onChange={(fields) => onChange({ fields })}
          render={(field, set) => (
            <>
              <Pills
                value={field.type}
                onChange={(v) => set({ type: v })}
                options={FIELD_TYPES}
              />
              <Input
                value={field.label}
                onChange={(e) => set({ label: e.target.value })}
                placeholder="Libellé"
                className="h-8 text-xs"
              />
              <Input
                value={field.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="nom-technique"
                className="h-8 text-xs font-mono"
              />
              {(field.type === 'text' ||
                field.type === 'email' ||
                field.type === 'tel' ||
                field.type === 'textarea') && (
                <Input
                  value={field.placeholder ?? ''}
                  onChange={(e) => set({ placeholder: e.target.value })}
                  placeholder="Placeholder"
                  className="h-8 text-xs"
                />
              )}
              {field.type === 'select' && (
                <Textarea
                  value={(field.options ?? []).join('\n')}
                  onChange={(e) =>
                    set({
                      options: e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Une option par ligne"
                  rows={3}
                  className="resize-y text-xs"
                />
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Requis</span>
                <Switch
                  checked={field.required ?? false}
                  onCheckedChange={(v) => set({ required: v })}
                />
              </div>
            </>
          )}
          addItem={() => ({ type: 'text', name: 'champ', label: 'Nouveau champ' })}
        />
      </Group>
    </>
  )
}

// ─────────────────────────── Generic repeater list ───────────────────────────

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
