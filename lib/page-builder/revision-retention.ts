// =====================================================================
//  Politique de rétention des révisions de page (PageRevision).
//
//  Chaque changement de contenu d'une page crée un snapshot complet. Sans
//  purge, la table grossit indéfiniment. Cette fonction PURE décide, pour
//  une page donnée, quelles révisions garder :
//    • les N plus récentes (par défaut 30) — l'historique récent, intact ;
//    • au-delà, UNE révision par jour calendaire (la plus récente du jour) —
//      on garde une trace quotidienne à long terme sans tout conserver.
//
//  Aucune I/O ici : le script `scripts/prune-page-revisions.ts` fournit les
//  révisions et applique (ou non) les suppressions.
// =====================================================================

export interface RevisionRef {
  id: string
  createdAt: Date
}

export interface RetentionPlan {
  keep: string[]
  delete: string[]
}

export interface RetentionOptions {
  /** Nombre de révisions récentes conservées telles quelles. */
  keepRecent?: number
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
}

/**
 * Calcule le plan de rétention pour les révisions d'UNE page.
 * Déterministe et sans effet de bord. Les révisions peuvent arriver dans
 * n'importe quel ordre : elles sont triées par date décroissante en interne.
 */
export function planRetention(
  revisions: RevisionRef[],
  options: RetentionOptions = {}
): RetentionPlan {
  const keepRecent = Math.max(0, options.keepRecent ?? 30)
  const sorted = [...revisions].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )

  const keep = new Set<string>()
  const seenDays = new Set<string>()

  sorted.forEach((rev, index) => {
    if (index < keepRecent) {
      keep.add(rev.id)
      // Le jour de cette révision récente est « couvert » : au-delà de la
      // fenêtre récente, on n'en regardera pas un deuxième pour ce même jour.
      seenDays.add(dayKey(rev.createdAt))
      return
    }
    const day = dayKey(rev.createdAt)
    if (!seenDays.has(day)) {
      seenDays.add(day)
      keep.add(rev.id)
    }
  })

  const del = sorted.filter((r) => !keep.has(r.id)).map((r) => r.id)
  return { keep: [...keep], delete: del }
}
