'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LinkInput } from './link-input'
import type { PageActionConfig } from '@/lib/page-builder/action-schema'

/** Inspector control to configure a block action (au clic). */
export function ActionInput({
  value,
  onChange,
}: {
  value?: PageActionConfig
  onChange: (action: PageActionConfig | undefined) => void
}) {
  const type = value?.type ?? 'none'
  const set = (patch: Partial<PageActionConfig>) =>
    onChange({ ...value, type, ...patch })

  return (
    <div className="space-y-1.5">
      <Select
        value={type}
        onValueChange={(t) =>
          onChange(t === 'none' ? undefined : { ...value, type: t as PageActionConfig['type'] })
        }
      >
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Aucune action</SelectItem>
          <SelectItem value="url">Aller vers une URL</SelectItem>
          <SelectItem value="scroll">Défiler vers une section</SelectItem>
          <SelectItem value="copy">Copier un texte</SelectItem>
          <SelectItem value="download">Télécharger un fichier</SelectItem>
          <SelectItem value="analytics">Événement analytics</SelectItem>
          <SelectItem value="calendly">Ouvrir Calendly</SelectItem>
          <SelectItem value="checkout">Paiement Stripe</SelectItem>
          <SelectItem value="submit">Soumettre le formulaire</SelectItem>
          <SelectItem value="modal">Ouvrir une modale</SelectItem>
          <SelectItem value="toggle-visibility">Afficher / masquer un bloc</SelectItem>
          <SelectItem value="set-tab">Activer un onglet</SelectItem>
          <SelectItem value="play-video">Lire une vidéo (mp4)</SelectItem>
          <SelectItem value="pause-video">Mettre en pause une vidéo (mp4)</SelectItem>
          <SelectItem value="animate">Rejouer l&apos;animation d&apos;un bloc</SelectItem>
          <SelectItem value="share">Partager</SelectItem>
          <SelectItem value="iframe-modal">Ouvrir une URL en modale</SelectItem>
          <SelectItem value="print">Imprimer la page</SelectItem>
          <SelectItem value="scroll-top">Remonter en haut</SelectItem>
        </SelectContent>
      </Select>

      {(type === 'url' ||
        type === 'download' ||
        type === 'calendly' ||
        type === 'iframe-modal') && (
        <LinkInput
          value={value?.href ?? ''}
          onChange={(href) => set({ href })}
          placeholder={
            type === 'calendly'
              ? 'Lien Calendly'
              : type === 'iframe-modal'
                ? 'URL à afficher en modale'
                : 'URL / fichier'
          }
        />
      )}
      {type === 'url' && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={!!value?.newTab}
            onChange={(e) => set({ newTab: e.target.checked })}
          />
          Ouvrir dans un nouvel onglet
        </label>
      )}
      {type === 'scroll' && (
        <Input
          value={value?.target ?? ''}
          onChange={(e) => set({ target: e.target.value })}
          placeholder="id de la section (ancre)"
          className="h-8 text-xs"
        />
      )}
      {type === 'copy' && (
        <Input
          value={value?.text ?? ''}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="Texte à copier"
          className="h-8 text-xs"
        />
      )}
      {type === 'download' && (
        <Input
          value={value?.filename ?? ''}
          onChange={(e) => set({ filename: e.target.value })}
          placeholder="Nom du fichier (optionnel)"
          className="h-8 text-xs"
        />
      )}
      {type === 'analytics' && (
        <Input
          value={value?.event ?? ''}
          onChange={(e) => set({ event: e.target.value })}
          placeholder="nom_evenement"
          className="h-8 text-xs"
        />
      )}
      {type === 'checkout' && (
        <Input
          value={value?.priceId ?? ''}
          onChange={(e) => set({ priceId: e.target.value })}
          placeholder="Stripe price ID (price_…)"
          className="h-8 text-xs"
        />
      )}
      {type === 'modal' && (
        <Input
          value={value?.target ?? ''}
          onChange={(e) => set({ target: e.target.value })}
          placeholder="id de la modale"
          className="h-8 text-xs"
        />
      )}
      {type === 'toggle-visibility' && (
        <Input
          value={value?.target ?? ''}
          onChange={(e) => set({ target: e.target.value })}
          placeholder="ID HTML du bloc cible (onglet Avancé)"
          className="h-8 text-xs"
        />
      )}
      {type === 'set-tab' && (
        <>
          <Input
            value={value?.target ?? ''}
            onChange={(e) => set({ target: e.target.value })}
            placeholder="ID de contrôle du bloc Onglets"
            className="h-8 text-xs"
          />
          <Input
            value={value?.value ?? ''}
            onChange={(e) => set({ value: e.target.value })}
            placeholder="N° d'onglet (0 = premier)"
            className="h-8 text-xs"
          />
        </>
      )}
      {(type === 'play-video' || type === 'pause-video') && (
        <Input
          value={value?.target ?? ''}
          onChange={(e) => set({ target: e.target.value })}
          placeholder="ID de contrôle de la vidéo"
          className="h-8 text-xs"
        />
      )}
      {type === 'animate' && (
        <Input
          value={value?.target ?? ''}
          onChange={(e) => set({ target: e.target.value })}
          placeholder="ID de contrôle du bloc à animer"
          className="h-8 text-xs"
        />
      )}
      {type === 'share' && (
        <Input
          value={value?.text ?? ''}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="Titre à partager (optionnel)"
          className="h-8 text-xs"
        />
      )}
    </div>
  )
}
