'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type AuditCategory = 'lisibilité' | 'accessibilité' | 'seo' | 'complétude'
export type AuditSeverity = 'info' | 'warning' | 'error'

export interface AuditIssue {
  category: AuditCategory
  severity: AuditSeverity
  message: string
}

export interface AuditResult {
  score: number
  issues: AuditIssue[]
}

interface AuditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading: boolean
  result: AuditResult | null
}

// Réutilise les variantes de Badge existantes (cf. components/ui/badge.tsx).
const SEVERITY_VARIANT: Record<
  AuditSeverity,
  'info' | 'warning' | 'destructive'
> = {
  info: 'info',
  warning: 'warning',
  error: 'destructive',
}

const SEVERITY_LABEL: Record<AuditSeverity, string> = {
  info: 'Info',
  warning: 'Attention',
  error: 'Erreur',
}

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  lisibilité: 'Lisibilité',
  accessibilité: 'Accessibilité',
  seo: 'SEO',
  complétude: 'Complétude',
}

// Ordre d'affichage : on remonte les problèmes les plus graves.
const SEVERITY_ORDER: AuditSeverity[] = ['error', 'warning', 'info']

function scoreTone(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-destructive'
}

export function AuditDialog({
  open,
  onOpenChange,
  loading,
  result,
}: AuditDialogProps) {
  const issues = React.useMemo(() => {
    if (!result) return []
    return [...result.issues].sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
    )
  }, [result])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Audit IA de la page</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !result ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucun résultat d&apos;audit.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Score global */}
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
              <div className={cn('text-3xl font-bold tabular-nums', scoreTone(result.score))}>
                {result.score}
                <span className="text-base font-medium text-muted-foreground">/100</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Score global de qualité (lisibilité, accessibilité, SEO,
                complétude).
              </p>
            </div>

            {/* Liste des issues */}
            {issues.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                Aucun point à améliorer détecté. Beau travail&nbsp;!
              </p>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {issues.map((iss, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 rounded-md border bg-card p-2.5 text-sm"
                  >
                    <Badge
                      variant={SEVERITY_VARIANT[iss.severity]}
                      className="mt-0.5 shrink-0"
                    >
                      {SEVERITY_LABEL[iss.severity]}
                    </Badge>
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {CATEGORY_LABEL[iss.category]}
                      </div>
                      <p className="leading-snug">{iss.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
