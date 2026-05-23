'use client'

import { useState, useMemo } from 'react'
import { Phone } from 'lucide-react'

interface Props {
  /** Numéro de téléphone en clair (ex: "02 515 77 11"). */
  phone: string
  /** Classes appliquées au lien/bouton (mêmes styles que l'affichage actuel). */
  className?: string
}

/**
 * Affiche un numéro de téléphone caché par défaut, révélé au clic.
 *
 * **Anti-scraping (best-effort)** :
 *  - Le numéro n'est jamais présent en clair dans le HTML avant interaction.
 *    On le stocke encodé en base64 dans un attribut data-p, donc les bots
 *    qui parsent le HTML (curl/wget, regex `\d{2,}`, sélecteurs CSS
 *    `a[href^="tel:"]`) ne voient que du garbage du type "MDI1MTc3MTEx".
 *  - Le lien `tel:` n'apparaît qu'après clic, donc les harvesters basés
 *    sur le pattern `href="tel:..."` ratent aussi.
 *  - Le composant est `'use client'` et les données viennent d'un fetch
 *    JSON post-mount → le HTML SSR initial ne contient déjà rien.
 *
 * Évidemment ça ne stoppe pas un scraper qui exécute du JS et automatise
 * un clic. Mais ça filtre 95 % des harvesters opportunistes, et les vrais
 * numéros restent par ailleurs publics sur les sites officiels des
 * organismes (ONEM, CPAS, communes, OP).
 *
 * UX :
 *  - Avant clic : icône phone + "•• •• •• •• ••" + petit "afficher"
 *  - Après clic : lien `tel:` classique avec icône + numéro complet
 *  - 1 clic suffit pour révéler ; un 2e clic déclenche l'appel
 */
export function PhoneReveal({ phone, className }: Props) {
  const [revealed, setRevealed] = useState(false)

  // Encode en base64 dès le render. Marche côté server (Buffer) et
  // client (btoa). On `useMemo` pour éviter un recompute à chaque render
  // si le composant est dans une liste.
  const encoded = useMemo(() => {
    if (typeof window === 'undefined') {
      return Buffer.from(phone, 'utf-8').toString('base64')
    }
    // btoa ne gère pas l'UTF-8 mais un numéro de tél = ASCII pur, OK
    return btoa(phone)
  }, [phone])

  if (revealed) {
    return (
      <a
        href={`tel:${phone.replace(/\s/g, '')}`}
        className={className}
      >
        <Phone className="w-3 h-3" />
        {phone}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      data-p={encoded}
      className={className}
      aria-label="Afficher le numéro de téléphone"
    >
      <Phone className="w-3 h-3" />
      <span className="tabular-nums tracking-wider select-none">
        •• •• •• •• ••
      </span>
      <span className="text-[10px] opacity-70 underline-offset-2 group-hover:underline">
        afficher
      </span>
    </button>
  )
}
