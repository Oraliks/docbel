export const USER_TABS = [
  "apercu",
  "securite",
  "profil",
  "activite",
  "confidentialite",
  "edition",
] as const

export type UserTab = (typeof USER_TABS)[number]
