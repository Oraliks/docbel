// Pure Zod schema for a block "action" (server-safe — imported by block schemas).
// An action is what happens when an interactive element is clicked. Kept additive
// and optional so existing blocks (plain href links) keep working unchanged.
import { z } from 'zod'

export const ACTION_TYPES = [
  'none',
  'url', // aller vers une URL
  'scroll', // défiler vers une section (ancre)
  'copy', // copier un texte
  'download', // télécharger un fichier
  'analytics', // envoyer un événement analytics
  'calendly', // ouvrir Calendly
  'checkout', // lancer un checkout Stripe
  'submit', // soumettre le formulaire parent
  'modal', // ouvrir une modale (par id)
  'toggle-visibility', // afficher/masquer un bloc (par son id HTML)
] as const

export const actionSchema = z.object({
  type: z.enum(ACTION_TYPES).optional(),
  href: z.string().max(4096).optional(),
  target: z.string().max(200).optional(),
  text: z.string().max(4096).optional(),
  filename: z.string().max(200).optional(),
  event: z.string().max(120).optional(),
  priceId: z.string().max(120).optional(),
  newTab: z.boolean().optional(),
})

export type PageActionConfig = z.infer<typeof actionSchema>
