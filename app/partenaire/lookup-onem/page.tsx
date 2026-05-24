import { redirect } from 'next/navigation'

/**
 * Ancienne URL `/partenaire/lookup-onem` — redirige vers la route neutre
 * `/outils/lookup-onem`.
 *
 * Pourquoi : les URLs ne doivent pas trahir le rôle requis (cf. principe
 * "URLs conditionnées par l'auth, pas par le path"). La page cible
 * vérifie elle-même l'auth partenaire/admin et affiche un message neutre
 * si non autorisé.
 *
 * Cette redirection préserve les bookmarks et liens externes pré-existants.
 */
export default async function PartnerLookupOnemRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : null
  const cat = typeof params.cat === 'string' ? params.cat : null
  const search = new URLSearchParams()
  if (q) search.set('q', q)
  if (cat) search.set('cat', cat)
  const qs = search.toString()
  redirect(`/outils/lookup-onem${qs ? `?${qs}` : ''}`)
}
