/** Documentary attestations cannot contain an unverified legal conclusion. */
export const DOCUMENTARY_REASONS = {
  amount: 'Montant confirmé dans le nouveau fichier',
  removal: 'Retrait documentaire constaté dans le nouveau fichier',
  context: 'Formule et contexte confirmés dans les fichiers',
} as const
export const INSTITUTIONAL_DOMAINS = [
  'onem.be',
  'rva.be',
  'wallonie.be',
  'leforem.be',
  'actiris.brussels',
  'belgique.be',
  'just.fgov.be',
  'vlaanderen.be',
  'vdab.be',
  'ostbelgienlive.be',
  'adg.be',
  'belgium.be',
  'belgie.be',
  'fgov.be',
  'socialsecurity.be',
  'mi-is.be',
  'europa.eu',
] as const
