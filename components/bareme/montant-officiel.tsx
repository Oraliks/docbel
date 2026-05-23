'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useBareme, type BaremeLookupParams } from '@/hooks/useBareme'
import { cn } from '@/lib/utils'
import { Info } from 'lucide-react'

interface MontantOfficielProps extends BaremeLookupParams {
  /** Forme compacte : juste le nombre + unité, sans tooltip. */
  compact?: boolean
  /** Affichage en gras / mise en évidence. */
  emphasis?: boolean
  /** Ajoute une icône Info à côté du montant qui ouvre le tooltip. */
  showSourceIcon?: boolean
  /** Classe CSS additionnelle. */
  className?: string
  /** Texte affiché si aucune version n'est publiée. Défaut: "—". */
  fallback?: string
  /** Override du formatage du montant (sinon: EUR + unité). */
  formatter?: (amount: number, unit: string | null) => string
}

const UNIT_LABEL_FR: Record<string, string> = {
  daily: '/ jour',
  monthly: '/ mois',
  yearly: '/ an',
  hourly: '/ heure',
  half_daily: '/ demi-journée',
  rate: '%',
}

function defaultFormatter(amount: number, unit: string | null): string {
  const formatted = new Intl.NumberFormat('fr-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount)
  const suffix = unit ? UNIT_LABEL_FR[unit] ?? `/ ${unit}` : ''
  return suffix ? `${formatted} ${suffix}` : formatted
}

/**
 * Affiche un montant officiel issu du dernier barème publié, avec tooltip
 * de source (fichier ONEM, article, date de validité).
 *
 * Exemples :
 *   <MontantOfficiel category="full_unemployment" allocationCode="AA1" salaryCode="MIN" />
 *   <MontantOfficiel key="basic_amount:D7" />
 *   <MontantOfficiel category="salary_bracket" salaryCode="29" compact />
 *
 * Comportements :
 *  - Skeleton (••• ) pendant le chargement
 *  - Fallback (par défaut "—") si aucune version publiée
 *  - Tooltip révélé au hover qui montre : libellé FR, article, validFrom, fileName
 *  - En mode `compact`, le tooltip est désactivé (juste le montant)
 */
export function MontantOfficiel(props: MontantOfficielProps) {
  const {
    compact = false,
    emphasis = false,
    showSourceIcon = false,
    className,
    fallback = '—',
    formatter = defaultFormatter,
    ...lookupParams
  } = props

  const { amount, isLoading, notPublished, error, fileName, validFrom } =
    useBareme(lookupParams)

  if (isLoading) {
    return (
      <span
        className={cn(
          'inline-block tabular-nums text-muted-foreground animate-pulse',
          className
        )}
        aria-busy="true"
      >
        •••
      </span>
    )
  }

  if (error) {
    return (
      <span
        className={cn('text-destructive', className)}
        title={error.message}
      >
        !
      </span>
    )
  }

  if (notPublished || !amount) {
    return (
      <span className={cn('text-muted-foreground', className)} title="Aucune version publiée">
        {fallback}
      </span>
    )
  }

  const formatted = formatter(amount.amount, amount.unit)
  const label = amount.labelFr ?? amount.labelNl ?? amount.comparisonKey

  const content = (
    <span
      className={cn(
        'inline-flex items-baseline gap-1 tabular-nums',
        emphasis && 'font-semibold',
        className
      )}
    >
      {formatted}
      {showSourceIcon && !compact && (
        <Info className="w-3 h-3 text-muted-foreground translate-y-0.5" aria-hidden />
      )}
    </span>
  )

  if (compact) return content

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2">
          {content}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1 text-xs">
          <div className="font-medium">{label}</div>
          <div className="space-y-0.5 text-muted-foreground">
            {amount.article && <div>Article : {amount.article}</div>}
            <div>Catégorie : {amount.category}</div>
            {amount.allocationCode && <div>Code allocation : {amount.allocationCode}</div>}
            {amount.salaryCode && <div>Code tranche : {amount.salaryCode}</div>}
            {validFrom && (
              <div>Valide depuis : {validFrom.toLocaleDateString('fr-BE')}</div>
            )}
            {fileName && <div className="font-mono truncate">Source : {fileName}</div>}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
