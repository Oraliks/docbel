// =====================================================================
//  eC3.2 — Export PDF « Ma carte de contrôle » (client uniquement)
// ---------------------------------------------------------------------
//  Reproduit la mise en page de l'aperçu officiel de la carte de
//  contrôle eC3.2 (titre + statut + données employeur/travailleur +
//  GRILLE CALENDRIER avec codes lettres T/V/M/A/NA + légende + note de
//  bas), SANS aucun logo (ONEM / organisme). 100 % FICTIF : aucune
//  donnée réelle, rien n'est transmis. `jspdf` chargé dynamiquement.
// =====================================================================

import type { Ec32DayCell, Ec32SituationType } from '@/lib/ec32/types'

/** Entrée de `exportEc32SimulationPdf`. */
export interface Ec32ExportPdfInput {
  /** Libellé du mois (ex. « Octobre 2024 »). */
  monthLabel: string
  employerName: string
  enterpriseNumber: string
  /** Période d'occupation (ex. « du 1 janvier 2019 au … »). Optionnel. */
  occupationPeriod?: string
  /** Nom du travailleur (fictif). */
  workerName?: string
  /** NISS (fictif / masqué). */
  workerNiss?: string
  /** Horodatage lisible de dernière mise à jour. */
  generatedAtLabel?: string
  /** La carte a-t-elle été « envoyée » dans la simulation ? */
  sent: boolean
  /** Grille calendrier (alignée lundi→dimanche, semaines de 7). */
  cells: Ec32DayCell[]
  /** Mention « document fictif » (rappel pédagogique). */
  fictionMention: string
}

/** Type fort de l'instance jsPDF, dérivé du module sans `any`. */
type JsPdfModule = typeof import('jspdf')
type JsPdfInstance = InstanceType<JsPdfModule['jsPDF']>

// Dimensions A4 (mm) + marges.
const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN_X = 14
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2

const WEEKDAYS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
] as const

/** Code lettre de la situation principale (codes du PDF officiel). */
const PRIMARY_CODE: Partial<Record<Ec32SituationType, string>> = {
  work_own_employer: 'T',
  vacation: 'V',
  incapacity: 'M',
  other: 'A',
}

type SecondaryShape = 'square' | 'triangle' | 'circle'

const SECONDARY_SHAPE: Partial<Record<Ec32SituationType, SecondaryShape>> = {
  work_elsewhere_usual_day: 'square', // travail compl. (jour d'activité)
  work_elsewhere_non_usual_day: 'triangle', // travail compl. (jour d'inactivité)
  work_other_regular_employer: 'circle', // occupation simultanée en continu
}

/**
 * Génère et télécharge un PDF reproduisant l'aperçu de la carte de contrôle
 * eC3.2 (`docbel-ec32-carte-controle.pdf`). Inerte côté serveur.
 */
export async function exportEc32SimulationPdf(
  input: Ec32ExportPdfInput,
): Promise<void> {
  if (typeof window === 'undefined') return

  const { jsPDF } = await import('jspdf')
  const doc: JsPdfInstance = new jsPDF({ unit: 'mm', format: 'a4' })

  const INK: [number, number, number] = [28, 28, 36]
  const MUTED: [number, number, number] = [110, 110, 120]
  const LINE: [number, number, number] = [205, 205, 212]
  const GREY_FILL: [number, number, number] = [232, 232, 236]

  const setInk = () => doc.setTextColor(...INK)
  const setMuted = () => doc.setTextColor(...MUTED)

  // ── Titre + statut ───────────────────────────────────────────────
  let y = 18
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  setInk()
  doc.text('Ma carte de contrôle — Chômage temporaire', PAGE_WIDTH / 2, y, {
    align: 'center',
  })
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  setMuted()
  doc.text(
    input.sent
      ? 'Cette carte a été envoyée à votre organisme de paiement'
      : "Cette carte n'a pas encore été envoyée à votre organisme de paiement",
    PAGE_WIDTH / 2,
    y,
    { align: 'center' },
  )
  y += 4
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.text(input.fictionMention, PAGE_WIDTH / 2, y, { align: 'center' })
  y += 7

  // ── Données employeur / travailleur (2 colonnes) ─────────────────
  const colLeftX = MARGIN_X
  const colRightX = MARGIN_X + CONTENT_WIDTH / 2 + 4
  const blockTop = y
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.2)
  doc.line(MARGIN_X, blockTop - 2, PAGE_WIDTH - MARGIN_X, blockTop - 2)

  const labelValue = (x: number, atY: number, label: string, value: string): number => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    setMuted()
    doc.text(label, x, atY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setInk()
    const lines = doc.splitTextToSize(value, CONTENT_WIDTH / 2 - 6)
    doc.text(lines, x, atY + 4)
    return atY + 4 + lines.length * 4 + 2
  }

  // Colonne gauche : employeur
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setInk()
  doc.text('Données employeur', colLeftX, blockTop + 3)
  let ly = blockTop + 8
  ly = labelValue(colLeftX, ly, 'Nom', input.employerName || '—')
  ly = labelValue(colLeftX, ly, "Numéro d'entreprise (BCE)", input.enterpriseNumber || '—')
  if (input.occupationPeriod) {
    ly = labelValue(colLeftX, ly, 'Occupation', input.occupationPeriod)
  }

  // Colonne droite : travailleur
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setInk()
  doc.text('Données travailleur', colRightX, blockTop + 3)
  let ry = blockTop + 8
  ry = labelValue(colRightX, ry, 'Nom', input.workerName || 'Citoyen·ne (simulation)')
  ry = labelValue(colRightX, ry, 'NISS', input.workerNiss || 'non communiqué (simulation)')
  if (input.generatedAtLabel) {
    ry = labelValue(colRightX, ry, 'Dernière mise à jour', input.generatedAtLabel)
  }

  y = Math.max(ly, ry) + 2
  doc.setDrawColor(...LINE)
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y)
  y += 6

  // ── Grille calendrier ────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setInk()
  doc.text(input.monthLabel, MARGIN_X, y)
  y += 4

  const cellW = CONTENT_WIDTH / 7
  const cellH = 13

  // En-têtes jours de semaine.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  setMuted()
  WEEKDAYS.forEach((wd, i) => {
    doc.text(wd, MARGIN_X + i * cellW + cellW / 2, y, { align: 'center' })
  })
  y += 2

  // Découpe en semaines de 7.
  const weeks: Ec32DayCell[][] = []
  for (let i = 0; i < input.cells.length; i += 7) {
    weeks.push(input.cells.slice(i, i + 7))
  }

  doc.setLineWidth(0.2)
  for (const week of weeks) {
    for (let i = 0; i < 7; i++) {
      const cell = week[i]
      const x = MARGIN_X + i * cellW
      if (!cell) continue

      const naCell = !cell.selectable
      // Fond + bordure.
      if (naCell) doc.setFillColor(...GREY_FILL)
      else doc.setFillColor(255, 255, 255)
      doc.setDrawColor(...LINE)
      doc.rect(x, y, cellW, cellH, naCell ? 'FD' : 'D')

      // Numéro du jour (coin haut-gauche).
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      if (naCell) setMuted()
      else setInk()
      doc.text(String(cell.day), x + 2, y + 4.5)

      if (naCell) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        setMuted()
        doc.text('NA', x + cellW / 2, y + cellH / 2 + 2, { align: 'center' })
        continue
      }

      // Marqueurs : code lettre + formes secondaires, centrés en bas.
      const code = PRIMARY_CODE[cell.situation]
      const shapes = (cell.secondaryWork ?? [])
        .map((s) => SECONDARY_SHAPE[s])
        .filter((s): s is SecondaryShape => Boolean(s))

      const markerY = y + cellH - 3.5
      const parts = (code ? 1 : 0) + shapes.length
      let cursorX = x + cellW / 2 - (parts - 1) * 2.6
      if (parts === 0) {
        // Chômage pur : rien.
      } else {
        if (code) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          setInk()
          doc.text(code, cursorX, markerY + 1, { align: 'center' })
          cursorX += 5.2
        }
        doc.setFillColor(...INK)
        doc.setDrawColor(...INK)
        for (const shape of shapes) {
          drawShape(doc, shape, cursorX, markerY)
          cursorX += 5.2
        }
      }
    }
    y += cellH
  }

  y += 6

  // ── Légende ──────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setInk()
  doc.text('Légende', MARGIN_X, y)
  y += 5

  const legendLeft: Array<{ code?: string; shape?: SecondaryShape; label: string }> = [
    { label: 'Chômage' },
    { code: 'T', label: 'Travail' },
    { code: 'V', label: 'Vacances' },
    { code: 'M', label: 'Inaptitude au travail' },
    { code: 'A', label: 'Autre situation' },
    { code: 'NA', label: "Pas d'application" },
  ]
  const legendRight: Array<{ shape: SecondaryShape; label: string }> = [
    { shape: 'circle', label: 'Occupation simultanée en continu' },
    { shape: 'square', label: "Travail complémentaire (jour d'activité)" },
    { shape: 'triangle', label: "Travail complémentaire (jour d'inactivité)" },
  ]

  const legendStartY = y
  const rowH = 5.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  legendLeft.forEach((item, idx) => {
    const ry2 = legendStartY + idx * rowH
    if (item.code) {
      doc.setFont('helvetica', 'bold')
      setInk()
      doc.text(item.code, MARGIN_X + 2, ry2)
    } else if (item.shape) {
      doc.setFillColor(...INK)
      doc.setDrawColor(...INK)
      drawShape(doc, item.shape, MARGIN_X + 3, ry2 - 1)
    }
    doc.setFont('helvetica', 'normal')
    setInk()
    doc.text(item.label, MARGIN_X + 12, ry2)
  })
  legendRight.forEach((item, idx) => {
    const ry2 = legendStartY + idx * rowH
    doc.setFillColor(...INK)
    doc.setDrawColor(...INK)
    drawShape(doc, item.shape, colRightX + 1, ry2 - 1)
    doc.setFont('helvetica', 'normal')
    setInk()
    doc.text(item.label, colRightX + 10, ry2)
  })

  y = legendStartY + legendLeft.length * rowH + 6

  // ── Note de bas (verbatim ONEM) ──────────────────────────────────
  doc.setDrawColor(...LINE)
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted()
  const footerText = doc.splitTextToSize(
    "Ce document est un aperçu de la déclaration que vous avez introduite de manière électronique. Vous ne devez pas le remettre à votre organisme de paiement ni à l'ONEM. Il vous permet de vérifier les données que vous avez envoyées. — Simulation pédagogique : aucune donnée réelle, aucun envoi.",
    CONTENT_WIDTH,
  )
  doc.text(footerText, MARGIN_X, y)

  doc.save('docbel-ec32-carte-controle.pdf')
}

/** Dessine une petite forme secondaire (≈3.4 mm) centrée sur (cx, cy). */
function drawShape(
  doc: JsPdfInstance,
  shape: SecondaryShape,
  cx: number,
  cy: number,
): void {
  const s = 1.7
  if (shape === 'square') {
    doc.rect(cx - s, cy - s, s * 2, s * 2, 'F')
  } else if (shape === 'triangle') {
    doc.triangle(cx, cy - s, cx - s, cy + s, cx + s, cy + s, 'F')
  } else {
    doc.circle(cx, cy, s, 'F')
  }
}
