'use client'

import { ShieldCheck, Database, RefreshCw, Flag } from 'lucide-react'

/**
 * 4 bandes d'info pédagogiques en bas de page : transparence sur la
 * méthodologie + invitation au signalement. Volontairement discrètes
 * (text-xs, icônes muted) pour pas voler l'attention des résultats.
 */
export function InfoBands() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
      <InfoBand
        icon={<ShieldCheck className="w-4 h-4" />}
        title="Pourquoi ces résultats ?"
        body="On affiche les organismes compétents pour ton code postal, classés par proximité et pertinence métier."
      />
      <InfoBand
        icon={<Database className="w-4 h-4" />}
        title="Sources officielles"
        body="Données ONEM, CPAS, Communes, CAPAC et partenaires publics belges, agrégées et géocodées."
      />
      <InfoBand
        icon={<RefreshCw className="w-4 h-4" />}
        title="Mises à jour"
        body="Les informations (horaires, coordonnées, services) sont vérifiées et mises à jour régulièrement."
      />
      <InfoBand
        icon={<Flag className="w-3.5 h-3.5" />}
        title="Une info incorrecte ?"
        body="Utilise le bouton drapeau en haut à droite de la card concernée pour nous signaler une erreur précise."
      />
    </div>
  )
}

function InfoBand({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-xs font-semibold">{title}</h3>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{body}</p>
    </div>
  )
}
