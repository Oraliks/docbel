'use client'

import { z } from 'zod'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { LinkInput } from '@/components/page-builder/inspector/link-input'
import { ActionInput } from '@/components/page-builder/inspector/action-input'
import { ActionButton } from '@/components/page-builder/action-button'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { ctaSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const BTN_SIZE: Record<NonNullable<Props['buttonSize']>, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

const BTN_STYLE: Record<NonNullable<Props['buttonStyle']>, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'bg-foreground text-background hover:opacity-90',
  outline: 'border border-current bg-transparent hover:bg-foreground/5',
  ghost: 'bg-transparent hover:bg-foreground/5',
}

export const cta = defineBlock({
  type: 'cta',
  schema,
  defaults: {
    title: 'Prêt à commencer ?',
    description: 'Rejoignez-nous dès aujourd’hui.',
    text: 'Commencer',
    link: '#',
    secondaryText: '',
    secondaryLink: '',
    variant: 'banner',
    buttonStyle: 'primary',
    buttonSize: 'md',
  },
  meta: {
    name: 'Appel à l’action',
    description: 'Bouton ou bannière CTA',
    category: 'marketing',
    icon: 'mouse-pointer-click',
    shortcuts: ['cta', 'bouton', 'button'],
    variants: [
      { id: 'inline', name: 'Bouton seul' },
      { id: 'banner', name: 'Bannière' },
      { id: 'card', name: 'Carte' },
    ],
  },
  Render: ({ props }) => {
    const t = useTranslations('public.blocks')
    const {
      title,
      description,
      text,
      link,
      secondaryText,
      secondaryLink,
      action,
      secondaryAction,
      variant = 'banner',
      buttonStyle = 'primary',
      buttonSize = 'md',
    } = props
    const buttonClass = cn(
      'inline-flex items-center gap-2 rounded-lg font-medium transition cursor-pointer',
      BTN_SIZE[buttonSize],
      BTN_STYLE[buttonStyle]
    )

    const primary = (
      <ActionButton
        action={action}
        href={link}
        className={buttonClass}
        aria-label={text || t('cta.primaryFallbackAria')}
      >
        {text} <ArrowRight className="size-4" aria-hidden="true" />
      </ActionButton>
    )
    const secondary = secondaryText ? (
      <ActionButton
        action={secondaryAction}
        href={secondaryLink}
        className="text-sm font-medium hover:underline cursor-pointer"
      >
        {secondaryText}
      </ActionButton>
    ) : null

    if (variant === 'inline') {
      return (
        <div className="flex flex-wrap items-center gap-3">
          {primary}
          {secondary}
        </div>
      )
    }

    if (variant === 'card') {
      return (
        <section
          className="rounded-2xl border bg-card p-8 text-center shadow-sm"
          aria-label={title || t('cta.regionAria')}
        >
          {title && <h3 className="text-2xl font-bold tracking-tight">{title}</h3>}
          {description && (
            <p className="mt-2 text-muted-foreground max-w-md mx-auto">{description}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {primary}
            {secondary}
          </div>
        </section>
      )
    }

    return (
      <section
        className="rounded-2xl bg-primary text-primary-foreground p-8 md:p-12"
        aria-label={title || t('cta.regionAria')}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-2xl">
            {title && <h3 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h3>}
            {description && <p className="mt-2 opacity-90">{description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <ActionButton
              action={action}
              href={link}
              aria-label={text || t('cta.primaryFallbackAria')}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg font-medium transition bg-primary-foreground text-primary hover:opacity-90 cursor-pointer',
                BTN_SIZE[buttonSize]
              )}
            >
              {text} <ArrowRight className="size-4" aria-hidden="true" />
            </ActionButton>
            {secondaryText && (
              <ActionButton
                action={secondaryAction}
                href={secondaryLink}
                className="text-sm font-medium underline-offset-4 hover:underline cursor-pointer"
              >
                {secondaryText}
              </ActionButton>
            )}
          </div>
        </div>
      </section>
    )
  },
  Fields: ({ props, onChange }) => (
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
          <LinkInput
            value={props.link}
            onChange={(link) => onChange({ link })}
            placeholder="/cible ou https://…"
          />
        </Field>
        <Field label="Bouton — action (avancé)">
          <ActionInput value={props.action} onChange={(action) => onChange({ action })} />
        </Field>
        <Field label="Lien secondaire — texte">
          <Input
            value={props.secondaryText ?? ''}
            onChange={(e) => onChange({ secondaryText: e.target.value })}
          />
        </Field>
        <Field label="Lien secondaire — URL">
          <LinkInput
            value={props.secondaryLink ?? ''}
            onChange={(secondaryLink) => onChange({ secondaryLink })}
          />
        </Field>
        <Field label="Lien secondaire — action (avancé)">
          <ActionInput
            value={props.secondaryAction}
            onChange={(secondaryAction) => onChange({ secondaryAction })}
          />
        </Field>
      </Group>
      <Group title="Apparence">
        <Field label="Style du bouton">
          <Pills
            value={props.buttonStyle ?? 'primary'}
            onChange={(v) => onChange({ buttonStyle: v as Props['buttonStyle'] })}
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
            onChange={(v) => onChange({ buttonSize: v as Props['buttonSize'] })}
            options={[
              { value: 'sm', label: 'Sm' },
              { value: 'md', label: 'Md' },
              { value: 'lg', label: 'Lg' },
            ]}
          />
        </Field>
      </Group>
    </>
  ),
})
