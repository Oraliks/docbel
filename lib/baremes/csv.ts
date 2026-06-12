// Génération CSV sécurisée pour les exports barèmes.
//
// Protection contre la "CSV formula injection" : une cellule texte commençant
// par =, +, -, @ (ou tab/CR résiduels) serait interprétée comme formule par
// Excel à l'ouverture. On préfixe ces valeurs par une apostrophe, qu'Excel
// affiche comme du texte brut.

const DANGEROUS_PREFIX = /^[=+\-@\t\r]/

/**
 * Neutralise une valeur de cellule pour l'export CSV.
 * Les nombres purs (ex: "-12.5" issus d'un number) ne sont pas préfixés.
 */
export function csvSafeCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }
  const str = String(value)
  if (!str) return ''
  // Un nombre négatif légitime ("-12.5") n'est pas une injection
  if (DANGEROUS_PREFIX.test(str) && !/^-\d/.test(str)) {
    return `'${str}`
  }
  return str
}

/** Échappe une cellule (quotes CSV) après neutralisation injection. */
export function csvEscape(value: string | number | null | undefined): string {
  const safe = csvSafeCell(value)
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n') || safe.includes(';')) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

/** Construit un CSV complet (header + lignes), séparateur virgule, BOM à ajouter côté réponse. */
export function buildCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','))
  }
  return lines.join('\n')
}

/** BOM UTF-8 pour qu'Excel ouvre le CSV avec le bon encodage. */
export const UTF8_BOM = '﻿'
