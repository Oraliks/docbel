'use client'

import { useState } from 'react'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { eligibilityTestSchema as schema } from './schemas'

type Question = z.infer<typeof schema>['questions'][number]

export const eligibilityTest = defineBlock({
  type: 'eligibilityTest',
  schema,
  defaults: {
    title: 'Êtes-vous éligible ?',
    introText: 'Répondez à ces questions pour le savoir.',
    questions: [
      { question: 'Avez-vous plus de 18 ans ?', type: 'yesno' },
      { question: 'Résidez-vous en Belgique ?', type: 'yesno' },
      { question: 'Avez-vous travaillé au moins 312 jours ?', type: 'yesno' },
    ],
    rules: {
      allYes: true,
      resultIfPass:
        'Vous êtes potentiellement éligible. Contactez l\'organisme pour confirmer.',
      resultIfFail: 'Vous n\'êtes peut-être pas éligible — consultez un conseiller.',
    },
  },
  meta: {
    name: 'Test d\'éligibilité',
    description: 'Mini-quiz oui/non avec résultat',
    category: 'docbel',
    icon: 'check',
    shortcuts: ['eligibility', 'eligible'],
  },
  Render: ({ props }) => {
    const t = useTranslations('public.blocks')
    const { title, introText, questions, rules } = props
    const [answers, setAnswers] = useState<(string | null)[]>(() =>
      questions.map(() => null)
    )
    const [done, setDone] = useState(false)
    const allAnswered = answers.every((a) => a !== null)
    const yesCount = answers.filter((a) => a === 'yes' || a === 'oui').length
    const passes = (() => {
      if (rules.allYes) return yesCount === questions.length
      if (rules.minYes !== undefined) return yesCount >= rules.minYes
      return true
    })()

    if (done) {
      return (
        <div
          className={cn(
            'rounded-2xl border-2 p-6 my-2',
            passes ? 'border-emerald-500 bg-emerald-500/5' : 'border-amber-500 bg-amber-500/5'
          )}
        >
          <div className="flex items-start gap-3">
            {passes ? (
              <Check className="size-6 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <X className="size-6 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h3 className="font-bold text-lg">
                {passes ? t('eligibilityTest.eligible') : t('eligibilityTest.notEligible')}
              </h3>
              <p className="mt-1 text-sm">
                {passes ? rules.resultIfPass : rules.resultIfFail}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAnswers(questions.map(() => null))
              setDone(false)
            }}
            className="mt-4 text-sm font-medium underline-offset-2 hover:underline"
          >
            {t('eligibilityTest.retake')}
          </button>
        </div>
      )
    }

    return (
      <div className="rounded-2xl border bg-card p-6 my-2">
        {title && <h3 className="text-lg font-semibold">{title}</h3>}
        {introText && <p className="mt-1 text-sm text-muted-foreground">{introText}</p>}
        <div className="mt-5 space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm font-medium">
                <span className="text-primary mr-2">{i + 1}.</span>
                {q.question}
              </p>
              {q.type === 'yesno' ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: t('eligibilityTest.yes'), value: 'yes' },
                    { label: t('eligibilityTest.no'), value: 'no' },
                  ].map((opt) => {
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setAnswers((a) => a.map((v, idx) => (idx === i ? opt.value : v)))
                        }
                        className={cn(
                          'rounded-md border px-3 py-2 text-sm font-medium transition',
                          answers[i] === opt.value
                            ? opt.value === 'yes'
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300'
                            : 'border-input hover:border-muted-foreground'
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <select
                  value={answers[i] ?? ''}
                  onChange={(e) =>
                    setAnswers((a) => a.map((v, idx) => (idx === i ? e.target.value : v)))
                  }
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="">{t('eligibilityTest.selectPlaceholder')}</option>
                  {q.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={!allAnswered}
          onClick={() => setDone(true)}
          className="mt-5 w-full rounded-md bg-primary text-primary-foreground py-2.5 font-medium disabled:opacity-50"
        >
          {t('eligibilityTest.seeResult')}
        </button>
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
        <Field label="Texte d'intro">
          <Textarea
            value={props.introText ?? ''}
            onChange={(e) => onChange({ introText: e.target.value })}
            rows={2}
            className="resize-y"
          />
        </Field>
      </Group>
      <Group title={`Questions (${props.questions.length})`} defaultOpen>
        <RepeaterList<Question>
          items={props.questions}
          onChange={(questions) => onChange({ questions })}
          render={(it, set) => (
            <>
              <Textarea
                value={it.question}
                onChange={(e) => set({ question: e.target.value })}
                rows={2}
                placeholder="Question"
                className="text-xs resize-y"
              />
              <Pills
                value={it.type}
                onChange={(v) => set({ type: v as Question['type'] })}
                options={[
                  { value: 'yesno', label: 'Oui/Non' },
                  { value: 'select', label: 'Liste' },
                ]}
              />
            </>
          )}
          addItem={() => ({ question: 'Nouvelle question ?', type: 'yesno' })}
        />
      </Group>
      <Group title="Règles">
        <Field label="Résultat positif">
          <Textarea
            value={props.rules.resultIfPass}
            onChange={(e) =>
              onChange({ rules: { ...props.rules, resultIfPass: e.target.value } })
            }
            rows={2}
            className="resize-y"
          />
        </Field>
        <Field label="Résultat négatif">
          <Textarea
            value={props.rules.resultIfFail}
            onChange={(e) =>
              onChange({ rules: { ...props.rules, resultIfFail: e.target.value } })
            }
            rows={2}
            className="resize-y"
          />
        </Field>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Toutes les réponses doivent être Oui" className="flex-1">
            <span className="sr-only">allYes</span>
          </Field>
          <Switch
            checked={props.rules.allYes ?? false}
            onCheckedChange={(v) =>
              onChange({ rules: { ...props.rules, allYes: v } })
            }
          />
        </div>
      </Group>
    </>
  ),
})
