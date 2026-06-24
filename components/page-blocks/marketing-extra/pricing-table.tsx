'use client'

import { useState } from 'react'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { LinkInput } from '@/components/page-builder/inspector/link-input'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { safeHref } from '@/lib/page-builder/url-utils'
import { cn } from '@/lib/utils'
import { pricingTableSchema as schema, pricingPlanSchema } from './schemas'

type Plan = z.infer<typeof pricingPlanSchema>

export const pricingTable = defineBlock({
  type: 'pricingTable',
  schema,
  defaults: {
    title: 'Nos formules',
    subtitle: 'Choisissez ce qui vous correspond.',
    togglePeriod: false,
    plans: [
      {
        name: 'Gratuit',
        price: '0€',
        period: '/mois',
        description: 'Pour découvrir',
        features: ['Fonctionnalité 1', 'Fonctionnalité 2'],
        ctaText: 'Commencer',
        ctaLink: '#',
      },
      {
        name: 'Pro',
        price: '19€',
        period: '/mois',
        description: 'Pour les pros',
        features: ['Tout du Gratuit', 'Fonctionnalité 3', 'Fonctionnalité 4'],
        ctaText: 'Choisir Pro',
        ctaLink: '#',
        highlighted: true,
        badge: 'Populaire',
      },
      {
        name: 'Entreprise',
        price: 'Sur devis',
        features: ['Tout du Pro', 'Support dédié', 'SLA personnalisé'],
        ctaText: 'Nous contacter',
        ctaLink: '#',
      },
    ],
  },
  meta: {
    name: 'Tableau de tarifs',
    description: 'Plans et prix avec comparaison',
    category: 'marketing',
    icon: 'columns-3',
    shortcuts: ['pricing', 'tarifs', 'plans'],
  },
  Render: ({ props }) => {
    const t = useTranslations('public.blocks')
    const { title, subtitle, plans, togglePeriod } = props
    const [yearly, setYearly] = useState(false)
    return (
      <div className="w-full py-12">
        <div className="mx-auto max-w-7xl px-6">
          {(title || subtitle) && (
            <div className="text-center mb-10 max-w-2xl mx-auto">
              {title && <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>}
              {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
            </div>
          )}
          {togglePeriod && (
            <div className="flex justify-center mb-8">
              <div className="inline-flex rounded-full bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setYearly(false)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition',
                    !yearly ? 'bg-background shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  {t('pricingTable.monthly')}
                </button>
                <button
                  type="button"
                  onClick={() => setYearly(true)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition',
                    yearly ? 'bg-background shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  {t('pricingTable.yearly')} <span className="text-emerald-600">{t('pricingTable.yearlyDiscount')}</span>
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-2xl border bg-card p-6 flex flex-col relative',
                  plan.highlighted && 'border-primary border-2 shadow-lg md:scale-105'
                )}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs font-medium">
                    {plan.badge}
                  </div>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {plan.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                )}
                <div className="mt-4">
                  <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                  {plan.period && (
                    <span className="text-sm text-muted-foreground ml-1">{plan.period}</span>
                  )}
                </div>
                <ul className="mt-6 space-y-2 text-sm flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <Check className="size-4 mt-0.5 text-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={safeHref(plan.ctaLink)}
                  className={cn(
                    'mt-6 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition',
                    plan.highlighted
                      ? 'bg-primary text-primary-foreground hover:opacity-90'
                      : 'border border-current bg-transparent hover:bg-muted'
                  )}
                >
                  {plan.ctaText}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
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
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Toggle mensuel/annuel" className="flex-1">
            <span className="sr-only">toggle</span>
          </Field>
          <Switch
            checked={props.togglePeriod ?? false}
            onCheckedChange={(v) => onChange({ togglePeriod: v })}
          />
        </div>
      </Group>
      <Group title={`Plans (${props.plans.length})`} defaultOpen>
        <RepeaterList<Plan>
          items={props.plans}
          onChange={(plans) => onChange({ plans })}
          render={(it, set) => (
            <>
              <Input
                value={it.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Nom"
                className="h-8 text-xs"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  value={it.price}
                  onChange={(e) => set({ price: e.target.value })}
                  placeholder="19€"
                  className="h-8 text-xs"
                />
                <Input
                  value={it.period ?? ''}
                  onChange={(e) => set({ period: e.target.value })}
                  placeholder="/mois"
                  className="h-8 text-xs"
                />
              </div>
              <Textarea
                value={it.description ?? ''}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Description courte"
                rows={2}
                className="text-xs resize-y"
              />
              <Textarea
                value={it.features.join('\n')}
                onChange={(e) =>
                  set({ features: e.target.value.split('\n').filter(Boolean) })
                }
                placeholder="Une feature par ligne"
                rows={4}
                className="text-xs resize-y"
              />
              <Input
                value={it.ctaText}
                onChange={(e) => set({ ctaText: e.target.value })}
                placeholder="Texte CTA"
                className="h-8 text-xs"
              />
              <LinkInput
                value={it.ctaLink}
                onChange={(ctaLink) => set({ ctaLink })}
                placeholder="Lien CTA"
              />
              <Input
                value={it.badge ?? ''}
                onChange={(e) => set({ badge: e.target.value })}
                placeholder="Badge (Populaire, etc.)"
                className="h-8 text-xs"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Mis en avant</span>
                <Switch
                  checked={it.highlighted ?? false}
                  onCheckedChange={(v) => set({ highlighted: v })}
                />
              </div>
            </>
          )}
          addItem={() => ({
            name: 'Nouveau plan',
            price: '0€',
            features: [],
            ctaText: 'Choisir',
            ctaLink: '#',
          })}
        />
      </Group>
    </>
  ),
})
