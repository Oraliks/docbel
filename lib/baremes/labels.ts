import labelsFr from '@/lib/data/baremes-labels-fr.json'

interface LabelsFile {
  byKey: Record<string, string>
  byArticle: Record<string, string>
  byCategory: Record<string, string>
}

const LABELS = labelsFr as unknown as LabelsFile

/**
 * Retourne le label FR pour un montant donné en cascadant :
 *  1. byKey[comparisonKey]  (le plus précis)
 *  2. byArticle[article]    (article de loi commun)
 *  3. byCategory[category]  (libellé générique)
 *  4. null
 *
 * Permet d'enrichir au moment de la lecture les amounts dont labelFr est null
 * (typique pour Basisbedragen où le fichier ONEM ne contient que du NL).
 */
export function resolveLabelFr(input: {
  comparisonKey: string
  article: string | null
  category: string
  existingLabelFr: string | null
}): string | null {
  if (input.existingLabelFr) return input.existingLabelFr

  const byKey = LABELS.byKey[input.comparisonKey]
  if (byKey) return byKey

  if (input.article && LABELS.byArticle[input.article]) {
    return LABELS.byArticle[input.article]
  }

  if (LABELS.byCategory[input.category]) {
    return LABELS.byCategory[input.category]
  }

  return null
}
