// =====================================================================
//  eC3.2 — Export PDF de l'aperçu de simulation (client uniquement)
// ---------------------------------------------------------------------
//  Génère un PDF A4 récapitulant les jours encodés dans le simulateur.
//  100 % FICTIF : aucune donnée réelle, rien n'est transmis à l'ONEM.
//  `jspdf` est chargé dynamiquement (import()) pour rester hors du bundle
//  serveur ; la fonction est inerte côté serveur (garde `window`).
// =====================================================================

/** Une ligne (jour) du tableau récapitulatif du PDF. */
export interface Ec32PdfRow {
  /** Date lisible (déjà formatée, p. ex. « jeu. 1 mai 2025 »). */
  date: string
  /** Libellé de la situation encodée. */
  situationLabel: string
  /** Note optionnelle (correction, précision). */
  note?: string
}

/** Entrée de `exportEc32SimulationPdf`. */
export interface Ec32ExportPdfInput {
  docTitle: string
  fictionMention: string
  warning: string
  monthLabel: string
  employerName: string
  enterpriseNumber: string
  rows: Ec32PdfRow[]
  /** Horodatage lisible de génération (optionnel). */
  generatedAtLabel?: string
}

/** Type fort de l'instance jsPDF, dérivé du module sans `any`. */
type JsPdfModule = typeof import('jspdf')
type JsPdfInstance = InstanceType<JsPdfModule['jsPDF']>

// Dimensions A4 en millimètres + marges.
const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN_X = 16
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2
const FOOTER_Y = PAGE_HEIGHT - 14
const BOTTOM_LIMIT = PAGE_HEIGHT - 22

// Colonnes du tableau des jours.
const COL_DATE_X = MARGIN_X
const COL_SITUATION_X = MARGIN_X + 52
const COL_NOTE_X = MARGIN_X + 120

/**
 * Génère et télécharge un PDF récapitulant la simulation (fichier
 * `docbel-ec32-simulation.pdf`). Inerte côté serveur. Gère la pagination
 * automatique des lignes et répète l'avertissement « document fictif »
 * en pied de chaque page.
 */
export async function exportEc32SimulationPdf(
  input: Ec32ExportPdfInput,
): Promise<void> {
  if (typeof window === 'undefined') return

  const { jsPDF } = await import('jspdf')
  const doc: JsPdfInstance = new jsPDF({ unit: 'mm', format: 'a4' })

  const drawFooter = (): void => {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(input.warning, CONTENT_WIDTH)
    doc.text(lines, MARGIN_X, FOOTER_Y)
  }

  // ── En-tête (1re page) ───────────────────────────────────────────
  let y = 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(input.docTitle, MARGIN_X, y)
  y += 9

  // Bandeau « Document fictif ».
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const bannerLines = doc.splitTextToSize(input.fictionMention, CONTENT_WIDTH - 6)
  const bannerHeight = bannerLines.length * 5 + 4
  doc.setFillColor(243, 232, 255) // mauve très clair
  doc.setDrawColor(168, 132, 240)
  doc.rect(MARGIN_X, y, CONTENT_WIDTH, bannerHeight, 'FD')
  doc.setTextColor(76, 29, 149)
  doc.text(bannerLines, MARGIN_X + 3, y + 6)
  doc.setTextColor(0, 0, 0)
  y += bannerHeight + 8

  // Métadonnées.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`Mois : ${input.monthLabel}`, MARGIN_X, y)
  y += 6
  doc.text(`Employeur : ${input.employerName}`, MARGIN_X, y)
  y += 6
  doc.text(
    `Numéro d'entreprise : ${input.enterpriseNumber}`,
    MARGIN_X,
    y,
  )
  y += 6
  if (input.generatedAtLabel) {
    doc.setFontSize(9)
    doc.setTextColor(110, 110, 110)
    doc.text(`Aperçu généré le ${input.generatedAtLabel}`, MARGIN_X, y)
    doc.setTextColor(0, 0, 0)
    y += 6
  }
  y += 2

  // ── En-tête de tableau ───────────────────────────────────────────
  const drawTableHeader = (atY: number): number => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Date', COL_DATE_X, atY)
    doc.text('Situation', COL_SITUATION_X, atY)
    doc.text('Note', COL_NOTE_X, atY)
    const lineY = atY + 2
    doc.setDrawColor(180, 180, 180)
    doc.line(MARGIN_X, lineY, PAGE_WIDTH - MARGIN_X, lineY)
    return lineY + 5
  }

  y = drawTableHeader(y)

  // ── Lignes (avec pagination) ─────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  if (input.rows.length === 0) {
    doc.setTextColor(110, 110, 110)
    doc.text('Aucun jour à afficher pour ce mois.', MARGIN_X, y)
    doc.setTextColor(0, 0, 0)
  }

  for (const row of input.rows) {
    const situationLines = doc.splitTextToSize(
      row.situationLabel,
      COL_NOTE_X - COL_SITUATION_X - 4,
    )
    const noteLines = row.note
      ? doc.splitTextToSize(row.note, PAGE_WIDTH - MARGIN_X - COL_NOTE_X)
      : ['']
    const rowHeight = Math.max(situationLines.length, noteLines.length, 1) * 5 + 1

    // Saut de page si nécessaire.
    if (y + rowHeight > BOTTOM_LIMIT) {
      drawFooter()
      doc.addPage()
      y = 20
      y = drawTableHeader(y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
    }

    doc.text(row.date, COL_DATE_X, y)
    doc.text(situationLines, COL_SITUATION_X, y)
    if (row.note) doc.text(noteLines, COL_NOTE_X, y)
    y += rowHeight
  }

  // Pied de la dernière page.
  drawFooter()

  doc.save('docbel-ec32-simulation.pdf')
}
