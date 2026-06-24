'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { salaireNetBESchema as schema } from './schemas'

type Status = 'isolé' | 'cohabitant' | 'famille'

export const salaireNetBE = defineBlock({
  type: 'salaireNetBE',
  schema,
  defaults: { title: 'Salaire net estimé', defaultBrut: 3000, status: 'isolé' },
  meta: {
    name: 'Salaire brut → net BE',
    description: 'Estime le salaire net belge',
    category: 'docbel',
    icon: 'bar-chart-3',
    shortcuts: ['salaire', 'net'],
  },
  Render: ({ props }) => {
    const t = useTranslations('public.blocks')
    const { title = 'Salaire net estimé', defaultBrut = 3000, status = 'isolé' } = props
    const [brut, setBrut] = useState(defaultBrut)
    const [stat, setStat] = useState<Status>(status)
    const onss = brut * 0.1307
    const imposable = brut - onss
    let baseTax = 0
    const annualImposable = imposable * 12
    if (annualImposable <= 15820) baseTax = annualImposable * 0.25
    else if (annualImposable <= 27920)
      baseTax = 15820 * 0.25 + (annualImposable - 15820) * 0.4
    else if (annualImposable <= 48320)
      baseTax = 15820 * 0.25 + (27920 - 15820) * 0.4 + (annualImposable - 27920) * 0.45
    else
      baseTax =
        15820 * 0.25 +
        (27920 - 15820) * 0.4 +
        (48320 - 27920) * 0.45 +
        (annualImposable - 48320) * 0.5
    const monthlyTax = baseTax / 12
    const exonerationStat = stat === 'famille' ? 9700 : 9270
    const reduction = (exonerationStat / 12) * 0.25
    const netImposable = imposable - Math.max(0, monthlyTax - reduction)
    const net = Math.round(netImposable)

    return (
      <div className="rounded-2xl border bg-card p-6 my-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {t('salaireNetBE.disclaimer')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">{t('salaireNetBE.monthlyBrutLabel')}</label>
            <div className="relative mt-1">
              <input
                type="number"
                value={brut}
                onChange={(e) => setBrut(Number(e.target.value))}
                className="w-full rounded-md border bg-background pl-3 pr-10 py-2 text-sm"
                aria-label={t('salaireNetBE.monthlyBrutLabel')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                €
              </span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{t('salaireNetBE.situationLabel')}</label>
            <select
              value={stat}
              onChange={(e) => setStat(e.target.value as Status)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              aria-label={t('salaireNetBE.situationLabel')}
            >
              <option value="isolé">{t('salaireNetBE.statusIsolated')}</option>
              <option value="cohabitant">{t('salaireNetBE.statusCohabitant')}</option>
              <option value="famille">{t('salaireNetBE.statusFamily')}</option>
            </select>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground uppercase">{t('salaireNetBE.onss')}</div>
            <div className="mt-1 font-semibold tabular-nums">-{Math.round(onss)} €</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground uppercase">{t('salaireNetBE.tax')}</div>
            <div className="mt-1 font-semibold tabular-nums">
              -{Math.round(monthlyTax - reduction)} €
            </div>
          </div>
          <div className="rounded-lg bg-primary/10 p-3 border-2 border-primary">
            <div className="text-xs text-primary uppercase font-semibold">{t('salaireNetBE.net')}</div>
            <div className="mt-1 text-xl font-bold text-primary tabular-nums">{net} €</div>
          </div>
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre">
        <Input
          value={props.title ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Salaire brut par défaut">
        <Input
          type="number"
          value={props.defaultBrut}
          onChange={(e) => onChange({ defaultBrut: Number(e.target.value) })}
        />
      </Field>
      <Field label="Situation par défaut">
        <Pills
          value={props.status ?? 'isolé'}
          onChange={(v) => onChange({ status: v as Status })}
          options={[
            { value: 'isolé', label: 'Isolé' },
            { value: 'cohabitant', label: 'Cohabitant' },
            { value: 'famille', label: 'Famille' },
          ]}
        />
      </Field>
    </Group>
  ),
})
