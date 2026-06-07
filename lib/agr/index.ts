/**
 * Point d'entrée client-safe du module AGR.
 *
 * N'exporte QUE des modules purs (calcul, types, barèmes, parseur de texte,
 * catégorie). `extract-pdf-text.ts` est volontairement exclu : il dépend de
 * pdfjs (server-only) et ne doit pas être tiré dans le bundle client.
 */

export * from "./types";
export * from "./baremes";
export * from "./calcul";
export * from "./categorie-travailleur";
export * from "./parse-wech506";
