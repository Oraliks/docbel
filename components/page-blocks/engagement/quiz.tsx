'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'

const questionSchema = z.object({
  question: z.string().max(2000),
  options: z.array(z.string().max(500)),
  correct: z.number(),
  explanation: z.string().max(2000).optional(),
})

const resultSchema = z.object({
  min: z.number(),
  message: z.string().max(2000),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  questions: z.array(questionSchema).max(50),
  resultMessages: z.array(resultSchema).optional(),
})

type Question = z.infer<typeof questionSchema>

export const quiz = defineBlock({
  type: 'quiz',
  schema,
  defaults: {
    title: 'Testez vos connaissances',
    questions: [
      {
        question: 'Quelle est la capitale de la Belgique ?',
        options: ['Anvers', 'Bruxelles', 'Liège', 'Gand'],
        correct: 1,
        explanation: 'Bruxelles est la capitale et siège des institutions européennes.',
      },
    ],
  },
  meta: {
    name: 'Quiz',
    description: 'Quiz interactif avec résultats',
    category: 'engagement',
    icon: 'help-circle',
    shortcuts: ['quiz'],
  },
  Render: ({ props }) => {
    const { title, questions, resultMessages } = props
    const [step, setStep] = useState(0)
    const [answers, setAnswers] = useState<number[]>([])
    const [done, setDone] = useState(false)

    if (questions.length === 0) {
      return (
        <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
          Aucune question
        </div>
      )
    }

    if (done) {
      const score = answers.filter((a, i) => a === questions[i].correct).length
      const result = resultMessages?.find((r) => score >= r.min) || {
        message: `Vous avez obtenu ${score} / ${questions.length}.`,
      }
      return (
        <div className="rounded-2xl border bg-card p-6 my-2 text-center">
          <h3 className="text-2xl font-bold">Résultat</h3>
          <p className="mt-2 text-3xl font-bold text-primary">
            {score} / {questions.length}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">{result.message}</p>
          <button
            type="button"
            onClick={() => {
              setStep(0)
              setAnswers([])
              setDone(false)
            }}
            className="mt-5 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Recommencer
          </button>
        </div>
      )
    }

    const q = questions[step]
    return (
      <div className="rounded-2xl border bg-card p-6 my-2">
        {title && (
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-2">
            {title}
          </h3>
        )}
        <div className="text-xs text-muted-foreground mb-3">
          Question {step + 1} / {questions.length}
        </div>
        <p className="text-lg font-semibold mb-4">{q.question}</p>
        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                const next = [...answers, i]
                setAnswers(next)
                if (step + 1 < questions.length) setStep(step + 1)
                else setDone(true)
              }}
              className="w-full rounded-md border bg-card px-4 py-3 text-left text-sm font-medium hover:border-primary hover:bg-primary/5 transition"
            >
              {opt}
            </button>
          ))}
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
                placeholder="Question"
                rows={2}
                className="text-xs resize-y"
              />
              <Textarea
                value={it.options.join('\n')}
                onChange={(e) =>
                  set({ options: e.target.value.split('\n').filter(Boolean) })
                }
                placeholder="Options (une par ligne)"
                rows={4}
                className="text-xs resize-y"
              />
              <Field label="Index de la bonne réponse (0-based)" className="!space-y-1">
                <Input
                  type="number"
                  min={0}
                  value={it.correct}
                  onChange={(e) => set({ correct: Number(e.target.value) })}
                />
              </Field>
              <Textarea
                value={it.explanation ?? ''}
                onChange={(e) => set({ explanation: e.target.value })}
                placeholder="Explication (optionnelle)"
                rows={2}
                className="text-xs resize-y"
              />
            </>
          )}
          addItem={() => ({
            question: 'Nouvelle question ?',
            options: ['Option 1', 'Option 2'],
            correct: 0,
            explanation: '',
          })}
        />
      </Group>
    </>
  ),
})
