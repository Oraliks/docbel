// =====================================================================
//  Page Health — détecteur de problèmes pour l'éditeur page-builder.
//
//  Analyse le tableau plat de blocs et remonte des problèmes utiles pour
//  un site d'info admin : hiérarchie des titres, liens vides, images sans
//  alt, contenu vide, signaux SEO. Chaque problème pointe (quand c'est
//  pertinent) vers le bloc concerné via `blockId`.
// =====================================================================

import type { BlockProps, BlockPropsMap } from './types'

export type IssueSeverity = 'error' | 'warning' | 'info'

export interface Issue {
  /** Bloc concerné — absent pour les problèmes au niveau de la page. */
  blockId?: string
  /** Libellé court du type de bloc (ou contexte) affiché sous le message. */
  blockType: string
  message: string
  severity: IssueSeverity
}

/** Un champ HTML riche est-il vide (texte une fois les balises retirées) ? */
function isHtmlEmpty(html: string | undefined): boolean {
  if (!html) return true
  // Retire les balises puis les entités d'espace insécable / blancs.
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()
  return text.length === 0
}

/** Un texte alternatif est-il manquant ou trop court pour être utile ? */
function isAltMissing(alt: string | undefined): boolean {
  return !alt || alt.trim().length < 3
}

/** Un lien est-il vide (espaces seulement) ? */
function isLinkEmpty(link: string | undefined): boolean {
  return !link || link.trim().length === 0
}

/** Un texte de bouton est-il défini ? */
function hasButtonText(text: string | undefined): boolean {
  return !!text && text.trim().length > 0
}

const HEADING_LABEL = 'Titre'

/**
 * Détecte les problèmes d'accessibilité, de structure et de SEO d'une page.
 * Ordre de sortie : errors d'abord, puis warnings, puis infos.
 */
export function detectIssues(blocks: BlockProps[]): Issue[] {
  const issues: Issue[] = []

  // ── Collecte des titres dans l'ordre du document ───────────────────
  const headings: Array<{ id: string; level: number }> = []
  let rawCount = 0 // htmlRaw + embed (signal SEO)
  let headingTotal = 0

  for (const b of blocks) {
    switch (b.type) {
      // ── Images ─────────────────────────────────────────────────────
      case 'image': {
        const p = b.props as BlockPropsMap['image']
        if (isAltMissing(p.alt)) {
          issues.push({
            blockId: b.id,
            blockType: 'Image',
            message: 'Image sans texte alternatif (alt)',
            severity: 'warning',
          })
        }
        break
      }
      case 'gallery': {
        const p = b.props as BlockPropsMap['gallery']
        const missing = p.items.filter((it) => isAltMissing(it.alt)).length
        if (missing > 0) {
          issues.push({
            blockId: b.id,
            blockType: 'Galerie',
            message: `Galerie : ${missing} image(s) sans alt`,
            severity: 'warning',
          })
        }
        break
      }

      // ── Titres : collecte pour analyse de hiérarchie ────────────────
      case 'heading': {
        const p = b.props as BlockPropsMap['heading']
        headingTotal++
        headings.push({ id: b.id, level: p.level })
        break
      }

      // ── Liens de boutons vides ──────────────────────────────────────
      case 'cta': {
        const p = b.props as BlockPropsMap['cta']
        if (hasButtonText(p.text) && isLinkEmpty(p.link)) {
          issues.push({
            blockId: b.id,
            blockType: 'Appel à action',
            message: `Bouton « ${p.text.trim()} » sans lien`,
            severity: 'warning',
          })
        }
        if (hasButtonText(p.secondaryText) && isLinkEmpty(p.secondaryLink)) {
          issues.push({
            blockId: b.id,
            blockType: 'Appel à action',
            message: `Bouton secondaire « ${p.secondaryText!.trim()} » sans lien`,
            severity: 'warning',
          })
        }
        break
      }
      case 'hero': {
        const p = b.props as BlockPropsMap['hero']
        if (hasButtonText(p.ctaText) && isLinkEmpty(p.ctaLink)) {
          issues.push({
            blockId: b.id,
            blockType: 'Hero',
            message: `Bouton « ${p.ctaText!.trim()} » sans lien`,
            severity: 'warning',
          })
        }
        if (hasButtonText(p.ctaSecondaryText) && isLinkEmpty(p.ctaSecondaryLink)) {
          issues.push({
            blockId: b.id,
            blockType: 'Hero',
            message: `Bouton secondaire « ${p.ctaSecondaryText!.trim()} » sans lien`,
            severity: 'warning',
          })
        }
        break
      }
      case 'buttonGroup': {
        const p = b.props as BlockPropsMap['buttonGroup']
        const empty = p.items.filter(
          (it) => hasButtonText(it.text) && isLinkEmpty(it.link)
        ).length
        if (empty > 0) {
          issues.push({
            blockId: b.id,
            blockType: 'Groupe de boutons',
            message: `${empty} bouton(s) sans lien`,
            severity: 'warning',
          })
        }
        break
      }
      case 'card': {
        const p = b.props as BlockPropsMap['card']
        if (hasButtonText(p.ctaText) && isLinkEmpty(p.ctaLink)) {
          issues.push({
            blockId: b.id,
            blockType: 'Carte',
            message: `Bouton « ${p.ctaText!.trim()} » sans lien`,
            severity: 'warning',
          })
        }
        break
      }

      // ── Contenu vide ────────────────────────────────────────────────
      case 'text': {
        const p = b.props as BlockPropsMap['text']
        if (isHtmlEmpty(p.html)) {
          issues.push({
            blockId: b.id,
            blockType: 'Texte',
            message: 'Bloc de texte vide',
            severity: 'warning',
          })
        }
        break
      }
      case 'faq': {
        const p = b.props as BlockPropsMap['faq']
        if (p.items.length === 0) {
          issues.push({
            blockId: b.id,
            blockType: 'FAQ',
            message: 'FAQ sans aucune question',
            severity: 'warning',
          })
        }
        break
      }
      case 'features': {
        const p = b.props as BlockPropsMap['features']
        if (p.items.length === 0) {
          issues.push({
            blockId: b.id,
            blockType: 'Caractéristiques',
            message: 'Bloc « caractéristiques » sans aucun élément',
            severity: 'warning',
          })
        }
        break
      }
      case 'steps': {
        const p = b.props as BlockPropsMap['steps']
        if (p.items.length === 0) {
          issues.push({
            blockId: b.id,
            blockType: 'Étapes',
            message: 'Bloc « étapes » sans aucune étape',
            severity: 'warning',
          })
        }
        break
      }

      // ── Signaux SEO ─────────────────────────────────────────────────
      case 'htmlRaw':
      case 'embed': {
        rawCount++
        break
      }
    }
  }

  // ── Hiérarchie des titres ──────────────────────────────────────────
  const h1s = headings.filter((h) => h.level === 1)
  if (h1s.length === 0) {
    issues.push({
      blockType: HEADING_LABEL,
      message: 'Aucun titre H1 — ajoutez un titre principal',
      severity: 'warning',
    })
  } else if (h1s.length > 1) {
    // Pointe vers le 2e H1 (le doublon) pour faciliter la correction.
    issues.push({
      blockId: h1s[1].id,
      blockType: HEADING_LABEL,
      message: `${h1s.length} titres H1 (un seul recommandé)`,
      severity: 'error',
    })
  }

  // Saut de niveau : un titre ne doit pas descendre de plus d'un cran
  // par rapport au précédent (ex. H2 → H4 saute le H3).
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level
    const cur = headings[i].level
    if (cur - prev > 1) {
      issues.push({
        blockId: headings[i].id,
        blockType: HEADING_LABEL,
        message: `Saut de niveau de titre (H${prev} → H${cur})`,
        severity: 'warning',
      })
    }
  }

  // ── SEO : titre visible / abus de contenu brut ─────────────────────
  if (headingTotal === 0 && blocks.length > 0) {
    issues.push({
      blockType: 'SEO',
      message: 'Pas de titre visible sur la page',
      severity: 'info',
    })
  }
  if (rawCount >= 3) {
    issues.push({
      blockType: 'SEO',
      message: `${rawCount} blocs HTML/embed — contenu peu indexable`,
      severity: 'info',
    })
  }

  // ── Tri : error → warning → info (stable pour le reste) ─────────────
  const rank: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 }
  return issues
    .map((iss, i) => ({ iss, i }))
    .sort((a, b) => rank[a.iss.severity] - rank[b.iss.severity] || a.i - b.i)
    .map(({ iss }) => iss)
}
