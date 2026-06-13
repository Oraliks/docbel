'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  Link2,
  Ruler,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Table2,
  XCircle,
} from 'lucide-react'
import type { BaremeAlert, BaremeDiagnostics } from '@/lib/baremes/types'
import { isBlockingIssue, issueSeverity } from '@/lib/baremes/types'

/**
 * Onglet "Conformité" : rend VISIBLE la couche de vérification (round-trip,
 * contrats de structure, couverture inverse, invariants sémantiques, variation
 * inter-versions) et force l'admin à recouper un échantillon de montants avec
 * leur cellule Excel avant publication.
 *
 * Lecture seule sur les données d'import (diagnostics + alerts produits par le
 * pipeline) ; le seul état local est la checklist de l'échantillon (non
 * persistée — purement une aide à la relecture humaine).
 */

export interface AmountSampleRow {
  comparisonKey: string
  allocationCode: string | null
  salaryCode: string | null
  amount: number
  sourceSheet: string
  sourceCell: string
  rawValue: string
}

export interface ConformiteTabProps {
  diagnostics: BaremeDiagnostics
  alerts: BaremeAlert[]
  /** Échantillon (~8-12 montants) fourni par la page pour relecture visuelle. */
  amountsSample: AmountSampleRow[]
}

type CheckTone = 'ok' | 'warn' | 'error'

/** Le titre (ou, à défaut, le message) d'une alerte contient l'un des motifs ? */
function alertMatches(alert: BaremeAlert, patterns: string[]): boolean {
  const haystack = `${alert.title ?? ''} ${alert.message ?? ''}`.toLowerCase()
  return patterns.some((p) => haystack.includes(p.toLowerCase()))
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ok: { label: 'OK', cls: 'bg-green-100 text-green-900 border-green-300' },
  deviation: { label: 'Écart de compte', cls: 'bg-yellow-100 text-yellow-900 border-yellow-300' },
  missing_codes: { label: 'Codes manquants', cls: 'bg-yellow-100 text-yellow-900 border-yellow-300' },
  collapse: { label: 'Perte massive', cls: 'bg-red-100 text-red-900 border-red-300' },
  absent: { label: 'Feuille absente', cls: 'bg-red-100 text-red-900 border-red-300' },
  category_mismatch: { label: 'Catégorie ré-routée', cls: 'bg-red-100 text-red-900 border-red-300' },
}

export function ConformiteTab({ diagnostics, alerts, amountsSample }: ConformiteTabProps) {
  // ── Verdict global ────────────────────────────────────────────────────────
  const errorCount = useMemo(() => alerts.filter(isBlockingIssue).length, [alerts])
  const warnCount = useMemo(
    () => alerts.filter((a) => issueSeverity(a) === 'warning').length,
    [alerts]
  )
  const verdict: CheckTone = errorCount > 0 ? 'error' : warnCount > 0 ? 'warn' : 'ok'

  // ── Round-trip ────────────────────────────────────────────────────────────
  const rt = diagnostics.roundTrip
  const rtAttached = rt ? rt.direct + rt.derived : 0
  const rtTone: CheckTone = !rt
    ? 'warn'
    : rt.mismatches > 0
      ? 'error'
      : rt.noTrace > 0
        ? 'warn'
        : 'ok'

  // ── Contrats de structure ─────────────────────────────────────────────────
  const contracts = diagnostics.contracts ?? []
  const contractsTone: CheckTone = useMemo(() => {
    if (contracts.length === 0) return 'warn'
    if (contracts.some((c) => ['absent', 'collapse', 'category_mismatch'].includes(c.status)))
      return 'error'
    if (contracts.some((c) => c.status !== 'ok')) return 'warn'
    return 'ok'
  }, [contracts])

  // ── Couverture inverse (cellules montant non extraites) ───────────────────
  const coverageAlerts = useMemo(
    () => alerts.filter((a) => alertMatches(a, ['Cellules montant non extraites'])),
    [alerts]
  )
  const coverageSheets = useMemo(
    () => [...new Set(coverageAlerts.map((a) => a.sheet).filter(Boolean))] as string[],
    [coverageAlerts]
  )
  const coverageTone: CheckTone = coverageAlerts.length > 0 ? 'warn' : 'ok'

  // ── Invariants sémantiques ────────────────────────────────────────────────
  const invariantGroups = useMemo(
    () =>
      [
        { label: 'Valeurs-sentinelles hors fourchette', patterns: ['sentinelle'] },
        { label: 'Ordres de montants violés', patterns: ['Ordre de montants'] },
        { label: 'Demi-allocation ≠ plein / 2', patterns: ['Demi-allocation'] },
        { label: 'Montants décroissants entre tranches', patterns: ['décroissant'] },
        { label: 'Montants hors bornes de plausibilité', patterns: ['plausibilité'] },
      ].map((g) => ({
        ...g,
        count: alerts.filter((a) => alertMatches(a, g.patterns)).length,
      })),
    [alerts]
  )
  const invariantTotal = invariantGroups.reduce((s, g) => s + g.count, 0)
  const invariantTone: CheckTone = useMemo(() => {
    const matching = alerts.filter((a) =>
      invariantGroups.some((g) => alertMatches(a, g.patterns))
    )
    if (matching.length === 0) return 'ok'
    return matching.some(isBlockingIssue) ? 'error' : 'warn'
  }, [alerts, invariantGroups])

  // ── Variation vs version précédente ───────────────────────────────────────
  const variationAlerts = useMemo(
    () => alerts.filter((a) => alertMatches(a, ['variation', 'Compte de montants modifié'])),
    [alerts]
  )
  const variationTone: CheckTone =
    variationAlerts.length === 0
      ? 'ok'
      : variationAlerts.some(isBlockingIssue)
        ? 'error'
        : 'warn'

  // ── Checklist échantillon (état local, non persisté) ──────────────────────
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const checkedCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="space-y-4">
      {/* Verdict global */}
      <VerdictBanner verdict={verdict} errorCount={errorCount} warnCount={warnCount} />

      {/* 5 cartes de vérification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Round-trip */}
        <CheckCard
          tone={rtTone}
          icon={<Link2 className="w-4 h-4" />}
          title="Round-trip cellule"
          help="Chaque montant extrait doit être rattaché à une cellule source réelle dont la valeur correspond (directement ou par dérivation). Preuve formelle qu'aucun montant n'est copié, décalé ou inventé."
        >
          {!rt ? (
            <p className="text-xs text-muted-foreground">
              Vérification non disponible pour cet import.
            </p>
          ) : (
            <div className="space-y-1.5 text-sm">
              <p>
                <span className="font-semibold">{rtAttached}</span>
                <span className="text-muted-foreground"> / {rt.checked}</span> montants rattachés à
                leur cellule
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <span>direct : {rt.direct}</span>
                <span>dérivé : {rt.derived}</span>
                {rt.noTrace > 0 && (
                  <span className="text-yellow-700">sans trace : {rt.noTrace}</span>
                )}
                <span className={rt.mismatches > 0 ? 'text-red-700 font-semibold' : ''}>
                  mismatches : {rt.mismatches}
                </span>
              </div>
              {rt.mismatches > 0 && (
                <p className="text-xs text-red-700">
                  {rt.mismatches} montant(s) non rattaché(s) — voir l’onglet Erreurs &amp;
                  warnings.
                </p>
              )}
            </div>
          )}
        </CheckCard>

        {/* Contrats de structure */}
        <CheckCard
          tone={contractsTone}
          icon={<Table2 className="w-4 h-4" />}
          title="Contrats de structure"
          help="Pour chaque feuille attendue : présence, compte de montants vs attendu, et codes-clés requis. Détecte feuille renommée/absente, perte massive, ou dérive de structure."
        >
          {contracts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun contrat évalué pour cet import.</p>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-2.5 py-1.5">Feuille</th>
                    <th className="text-right px-2.5 py-1.5">Actuel</th>
                    <th className="text-right px-2.5 py-1.5">Attendu</th>
                    <th className="text-left px-2.5 py-1.5">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => {
                    const badge = STATUS_BADGE[c.status] ?? {
                      label: c.status,
                      cls: 'bg-muted text-muted-foreground border-border',
                    }
                    return (
                      <tr key={c.sheet} className="border-t">
                        <td className="px-2.5 py-1.5 font-mono">{c.sheet}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono">
                          {c.present ? c.actualCount : '—'}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono text-muted-foreground">
                          {c.expectedCount}
                        </td>
                        <td className="px-2.5 py-1.5">
                          <span
                            className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CheckCard>

        {/* Couverture inverse */}
        <CheckCard
          tone={coverageTone}
          icon={<ScanSearch className="w-4 h-4" />}
          title="Couverture inverse"
          help="Sur les feuilles denses (1 cellule = 1 montant), vérifie qu'aucune cellule ressemblant à un montant n'a été oubliée par le parser (ni extraite, ni explicitement ignorée)."
        >
          {coverageAlerts.length === 0 ? (
            <p className="text-sm text-green-700">Aucune cellule oubliée.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-yellow-800">
                {coverageAlerts.length} feuille(s) avec des cellules montant non extraites :
              </p>
              <ul className="space-y-1">
                {coverageSheets.map((s) => (
                  <li key={s} className="font-mono text-xs">
                    {s}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Détail des cellules concernées dans l’onglet Erreurs &amp; warnings.
              </p>
            </div>
          )}
        </CheckCard>

        {/* Invariants sémantiques */}
        <CheckCard
          tone={invariantTone}
          icon={<Ruler className="w-4 h-4" />}
          title="Invariants sémantiques"
          help="Vérifie la JUSTESSE valeur↔code↔échelle, indépendamment de toute version précédente : valeurs-ancres (sentinelles), ordre réglementaire par tranche, half = full/2, monotonie, bornes de plausibilité."
        >
          {invariantTotal === 0 ? (
            <p className="text-sm text-green-700">Tous les invariants respectés.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {invariantGroups
                .filter((g) => g.count > 0)
                .map((g) => (
                  <li key={g.label} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{g.label}</span>
                    <span className="font-mono font-semibold text-yellow-800">{g.count}</span>
                  </li>
                ))}
            </ul>
          )}
        </CheckCard>
      </div>

      {/* Variation vs version précédente — pleine largeur */}
      <CheckCard
        tone={variationTone}
        icon={<AlertTriangle className="w-4 h-4" />}
        title="Variation vs version précédente"
        help="Compare montant par montant à la dernière version publiée. Toute variation au-delà du seuil (l'indexation ONEM est ~2 %/an) signale un swap de colonnes, une valeur fausse ou une mauvaise échelle. Inclut les écarts de compte par feuille."
      >
        {variationAlerts.length === 0 ? (
          <p className="text-sm text-green-700">
            Aucune variation anormale (ou premier import sans version de référence).
          </p>
        ) : (
          <ul className="space-y-2">
            {variationAlerts.map((a, i) => {
              const sev = issueSeverity(a)
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {sev === 'error' || sev === 'critical' ? (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <span className="font-medium">{a.title ?? a.message}</span>
                    {a.title && a.reason && (
                      <p className="text-xs text-muted-foreground">{a.reason}</p>
                    )}
                    {!a.title && a.message && (
                      <p className="text-xs text-muted-foreground">{a.message}</p>
                    )}
                    {a.sheet && (
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        feuille : {a.sheet}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CheckCard>

      {/* Échantillon à valider */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
            Échantillon à valider
            <Badge variant="secondary" className="ml-1">
              {checkedCount} / {amountsSample.length}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cochez après vérification visuelle de chaque cellule avant publication. Ouvrez la
            source XLSX et recoupez le montant avec sa cellule.
          </p>
        </CardHeader>
        <CardContent>
          {amountsSample.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun échantillon fourni.
            </p>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 w-10" aria-label="Vérifié" />
                    <th className="text-left px-3 py-2">Code</th>
                    <th className="text-left px-3 py-2">Tranche</th>
                    <th className="text-right px-3 py-2">Montant</th>
                    <th className="text-left px-3 py-2">Feuille</th>
                    <th className="text-left px-3 py-2">Cellule</th>
                    <th className="text-left px-3 py-2">Valeur brute</th>
                  </tr>
                </thead>
                <tbody>
                  {amountsSample.map((row, i) => {
                    const isChecked = checked[i] ?? false
                    return (
                      <tr
                        key={`${row.comparisonKey}-${i}`}
                        className={`border-t ${isChecked ? 'bg-green-50/60 dark:bg-green-950/20' : ''}`}
                      >
                        <td className="px-3 py-1.5 align-middle">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(c) =>
                              setChecked((prev) => ({ ...prev, [i]: c === true }))
                            }
                            aria-label={`Vérifié : ${row.comparisonKey}`}
                          />
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {row.allocationCode ?? '—'}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs">{row.salaryCode ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {row.amount.toLocaleString('fr-BE', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs">{row.sourceSheet}</td>
                        <td className="px-3 py-1.5 font-mono text-xs font-semibold">
                          {row.sourceCell}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                          {row.rawValue || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {amountsSample.length > 0 && checkedCount === amountsSample.length && (
            <p className="mt-3 text-sm text-green-700 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Échantillon entièrement recoupé.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Sous-composants ─────────────────────────────────────────────────────────

function VerdictBanner({
  verdict,
  errorCount,
  warnCount,
}: {
  verdict: CheckTone
  errorCount: number
  warnCount: number
}) {
  const config = {
    ok: {
      border: 'border-green-300',
      icon: <ShieldCheck className="w-6 h-6 text-green-600 shrink-0" />,
      badge: 'bg-green-100 text-green-900 border-green-300',
      label: 'Conforme',
      detail: 'Aucune alerte bloquante. Toutes les vérifications passent.',
    },
    warn: {
      border: 'border-yellow-300',
      icon: <ShieldAlert className="w-6 h-6 text-yellow-600 shrink-0" />,
      badge: 'bg-yellow-100 text-yellow-900 border-yellow-300',
      label: 'À revoir',
      detail: 'Des avertissements à examiner avant publication, mais rien de bloquant.',
    },
    error: {
      border: 'border-red-300',
      icon: <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />,
      badge: 'bg-red-100 text-red-900 border-red-300',
      label: 'Bloqué',
      detail: 'Des erreurs bloquantes empêchent une publication sereine.',
    },
  }[verdict]

  return (
    <Card className={config.border}>
      <CardContent className="py-4 flex items-start gap-3">
        {config.icon}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${config.badge}`}
            >
              {config.label}
            </span>
            <span className="text-sm font-medium">{config.detail}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1.5">
            <span className={errorCount > 0 ? 'text-red-700 font-medium' : ''}>
              {errorCount} erreur(s) bloquante(s)
            </span>
            <span className={warnCount > 0 ? 'text-yellow-700 font-medium' : ''}>
              {warnCount} avertissement(s)
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ToneDot({ tone }: { tone: CheckTone }) {
  if (tone === 'ok')
    return <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" aria-label="OK" />
  if (tone === 'warn')
    return (
      <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" aria-label="Avertissement" />
    )
  return <XCircle className="w-4 h-4 text-red-600 shrink-0" aria-label="Erreur" />
}

function CheckCard({
  tone,
  icon,
  title,
  help,
  children,
}: {
  tone: CheckTone
  icon: React.ReactNode
  title: string
  help: string
  children: React.ReactNode
}) {
  const borderTone =
    tone === 'error' ? 'border-red-300' : tone === 'warn' ? 'border-yellow-300' : 'border-green-300'
  return (
    <Card className={borderTone}>
      <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
        <ToneDot tone={tone} />
        <span className="text-muted-foreground">{icon}</span>
        <CardTitle className="text-sm flex-1">{title}</CardTitle>
        <Popover>
          <PopoverTrigger
            className="text-muted-foreground hover:text-foreground outline-none"
            aria-label={`Aide : ${title}`}
          >
            <HelpCircle className="w-4 h-4" />
          </PopoverTrigger>
          <PopoverContent align="end" className="max-w-xs">
            <div className="flex items-start gap-2 text-xs leading-relaxed">
              <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span>{help}</span>
            </div>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
