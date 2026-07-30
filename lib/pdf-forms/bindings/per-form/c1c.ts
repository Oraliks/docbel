// Règles serveur du C1C — « Déclaration d'une activité accessoire »
// (Tremplin-indépendants).
//
// Une seule règle : l'adresse du site internet. Le formulaire imprime
// « ☐ oui: www …… » (page 1, y=369) — le « www » est SUR LE PAPIER, en amont
// de la ligne à remplir. Un citoyen qui colle l'adresse depuis son navigateur
// écrit `https://www.exemple.be`, et la ligne se lisait « www
// https://www.exemple.be ».
//
// Pourquoi une règle serveur et pas une normalisation à la saisie : ce que le
// citoyen a tapé reste ce qu'il relit et corrige à l'écran. Seule l'écriture
// sur le PDF est déshabillée, comme le « BE » des IBAN belges du C1 (cf.
// `iban-strip-be`). Les deux valeurs ne peuvent pas diverger : la règle lit le
// payload au moment de générer le document.
//
// Le champ `siteInternetUrl` garde par ailleurs son `pdfFieldName` dans le
// seed — le moteur applique `extraStamps` APRÈS le mapping du schéma
// (cf. `filler.ts`), la règle écrase donc la valeur brute sur le même widget.
//
// ⚠ `widget` = nom EXACT du widget dans l'AcroForm. Le copier depuis
// `pnpm tsx scripts/dump-pdf-widgets.ts C1C_FR`, jamais le retaper.

import { bind } from "../engine";
import type { MappingRule } from "../types";

/// Ligne pointillée qui suit « ☐ oui: www » (page 1, y=369,7, x=324,4). Comme
/// souvent dans les AcroForms de l'ONEM, le widget porte le nom du texte
/// imprimé au-dessus de lui — ici la question elle-même.
const W_SITE_INTERNET = "Je dispose dun site internet pour mon activité";

export const C1C_RULES: MappingRule[] = [
  bind("siteInternetUrl", W_SITE_INTERNET, "web-strip-www"),
];
