import type { BlockProps } from './types'

/**
 * Clés dont les valeurs string portent du texte lisible par un humain sur les
 * `props` d'un bloc. Utilisé pour produire un aperçu plat de la page destiné aux
 * fonctionnalités IA (génération de méta, audit, contexte du copilote). On ne
 * cible que les champs éditoriaux — jamais les strings structurelles (url, src,
 * icon, name…).
 */
const TEXT_KEYS = [
  'text',
  'html',
  'title',
  'subtitle',
  'description',
  'content',
  'quote',
  'caption',
  'answer',
  'question',
] as const

/**
 * Aplatit les blocs d'une page en texte brut pour les fonctionnalités IA.
 *
 * Collecte les valeurs string non vides des clés éditoriales ({@link TEXT_KEYS})
 * de chaque bloc, les joint par des retours à la ligne, retire les balises HTML,
 * réduit les espaces consécutifs, trim, puis tronque à `maxLen` caractères.
 *
 * @param blocks Les blocs de la page.
 * @param maxLen Longueur maximale du texte renvoyé (défaut : 8000).
 */
export function flattenBlocksText(blocks: BlockProps[], maxLen = 8000): string {
  const parts: string[] = []
  for (const b of blocks) {
    const p = b.props as Record<string, unknown>
    for (const k of TEXT_KEYS) {
      const v = p[k]
      if (typeof v === 'string' && v.trim()) parts.push(v)
    }
  }
  return parts
    .join('\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}
