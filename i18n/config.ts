// Façade de compatibilité. Tout le contenu « langues » vit désormais dans le
// registre unique `i18n/locales.ts` ; on le ré-exporte ici pour ne pas casser
// les imports existants `@/i18n/config`. Seul LOCALE_COOKIE reste propre à la
// config runtime (mode cookie, sans routing URL).
//
// Pour ajouter/retirer une langue → éditer `i18n/locales.ts`, jamais ce fichier.

export * from "./locales";

/** Nom du cookie qui mémorise la langue choisie par l'utilisateur. */
export const LOCALE_COOKIE = "BELDOC_LOCALE";
