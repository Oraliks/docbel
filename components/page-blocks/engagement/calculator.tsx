'use client'

import { useMemo, useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'

const optionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
})

const fieldSchema = z.object({
  name: z.string().max(60),
  label: z.string().max(200),
  type: z.enum(['number', 'select']),
  defaultValue: z.union([z.string(), z.number()]).optional(),
  unit: z.string().max(40).optional(),
  options: z.array(optionSchema).optional(),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  fields: z.array(fieldSchema).max(20),
  formula: z.string().max(2000).default(''),
  resultLabel: z.string().max(200).default(''),
  resultUnit: z.string().max(40).optional(),
  resultPrecision: z.number().min(0).max(8).optional(),
})

type FieldDef = z.infer<typeof fieldSchema>

// Caractères autorisés dans une expression arithmétique une fois les variables
// substituées : chiffres, opérateurs, parenthèses, espaces, séparateurs décimaux.
const ARITHMETIC_ONLY = /^[\d+\-*/%.,()\s]*$/
// Appels Math.<method>(…) autorisés (round, min, max, abs, ceil, floor, pow, sqrt…).
const MATH_CALL = /Math\.[a-zA-Z]+/g

function safeEval(expression: string, vars: Record<string, number | string>): number | null {
  try {
    let safe = expression
    for (const [k, v] of Object.entries(vars)) {
      // On n'injecte que des valeurs numériques : une valeur texte (option select)
      // pourrait sinon contenir du code arbitraire interpolé dans l'expression.
      const num = typeof v === 'number' ? v : Number(v)
      if (!Number.isFinite(num)) return null
      const regex = new RegExp(`\\b${k}\\b`, 'g')
      safe = safe.replace(regex, String(num))
    }
    // Après substitution, l'expression ne doit plus contenir que de l'arithmétique
    // (les Math.* sont tolérés). Tout identifiant résiduel (window, fetch, constructor…)
    // signale une formule non fiable → on refuse plutôt que d'exécuter du JS arbitraire.
    if (!ARITHMETIC_ONLY.test(safe.replace(MATH_CALL, ''))) return null
    const fn = new Function('Math', `"use strict"; return (${safe})`)
    const result = fn(Math)
    return typeof result === 'number' && !Number.isNaN(result) ? result : null
  } catch {
    return null
  }
}

export const calculator = defineBlock({
  type: 'calculator',
  schema,
  defaults: {
    title: 'Calculez votre montant',
    description: '',
    fields: [
      {
        name: 'salary',
        label: 'Salaire mensuel brut',
        type: 'number',
        defaultValue: 2500,
        unit: '€',
      },
    ],
    formula: 'salary * 0.65',
    resultLabel: 'Net estimé',
    resultUnit: '€',
    resultPrecision: 2,
  },
  meta: {
    name: 'Calculatrice',
    description: 'Calcul personnalisé',
    category: 'engagement',
    icon: 'bar-chart-3',
    shortcuts: ['calculator', 'calcul'],
  },
  Render: ({ props }) => {
    const {
      title,
      description,
      fields,
      formula,
      resultLabel,
      resultUnit,
      resultPrecision = 2,
    } = props
    const initial = useMemo(() => {
      const out: Record<string, number | string> = {}
      for (const f of fields) {
        out[f.name] = f.defaultValue ?? (f.type === 'number' ? 0 : '')
      }
      return out
    }, [fields])
    const [values, setValues] = useState(initial)
    const result = safeEval(formula, values)

    return (
      <div className="rounded-2xl border bg-card p-6 my-2">
        {title && <h3 className="text-lg font-semibold">{title}</h3>}
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-4 space-y-3">
          {fields.map((field) => (
            <div key={field.name} className="space-y-1">
              <label className="text-sm font-medium">{field.label}</label>
              <div className="relative">
                {field.type === 'number' ? (
                  <input
                    type="number"
                    value={values[field.name] as number}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.name]: Number(e.target.value) }))
                    }
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                ) : (
                  <select
                    value={values[field.name] as string}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.name]: e.target.value }))
                    }
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  >
                    {field.options?.map((opt) => (
                      <option key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
                {field.unit && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {field.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl bg-primary/10 p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {resultLabel}
          </div>
          <div className="mt-1 text-3xl font-bold text-primary tabular-nums">
            {result === null ? '—' : result.toFixed(resultPrecision)}
            {resultUnit && <span className="ml-1 text-base">{resultUnit}</span>}
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
        <Field label="Description">
          <Textarea
            value={props.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            className="resize-y"
          />
        </Field>
      </Group>
      <Group title={`Champs (${props.fields.length})`} defaultOpen>
        <RepeaterList<FieldDef>
          items={props.fields}
          onChange={(fields) => onChange({ fields })}
          render={(it, set) => (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  value={it.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="nom"
                  className="h-8 text-xs font-mono"
                />
                <Input
                  value={it.label}
                  onChange={(e) => set({ label: e.target.value })}
                  placeholder="Libellé"
                  className="h-8 text-xs"
                />
              </div>
              <Pills
                value={it.type}
                onChange={(v) => set({ type: v as FieldDef['type'] })}
                options={[
                  { value: 'number', label: 'Nombre' },
                  { value: 'select', label: 'Liste' },
                ]}
              />
              <Input
                value={String(it.defaultValue ?? '')}
                onChange={(e) =>
                  set({
                    defaultValue:
                      it.type === 'number' ? Number(e.target.value) : e.target.value,
                  })
                }
                placeholder="Valeur par défaut"
                className="h-8 text-xs"
              />
              <Input
                value={it.unit ?? ''}
                onChange={(e) => set({ unit: e.target.value })}
                placeholder="Unité (€, %, kg…)"
                className="h-8 text-xs"
              />
            </>
          )}
          addItem={() => ({
            name: 'champ',
            label: 'Nouveau champ',
            type: 'number',
            defaultValue: 0,
            unit: '',
          })}
        />
      </Group>
      <Group title="Formule">
        <Field label="Expression JS" hint="Utilisez les noms des champs (ex: salary * 0.65)">
          <Textarea
            value={props.formula}
            onChange={(e) => onChange({ formula: e.target.value })}
            rows={3}
            className="font-mono text-xs resize-y"
          />
        </Field>
        <Field label="Libellé du résultat">
          <Input
            value={props.resultLabel}
            onChange={(e) => onChange({ resultLabel: e.target.value })}
          />
        </Field>
        <Field label="Unité">
          <Input
            value={props.resultUnit ?? ''}
            onChange={(e) => onChange({ resultUnit: e.target.value })}
            placeholder="€"
          />
        </Field>
        <Field label="Précision (décimales)">
          <Input
            type="number"
            min={0}
            max={6}
            value={props.resultPrecision ?? 2}
            onChange={(e) => onChange({ resultPrecision: Number(e.target.value) })}
          />
        </Field>
      </Group>
    </>
  ),
})
