// Règles serveur du C1B — « Déclaration de revenus (pension, indemnités) ».
//
// Le C1B n'a besoin que d'une chose : recopier le nom du citoyen dans
// l'en-tête de la page 2 (« Suite C1B — NISS … Nom … »), un doublon imprimé de
// ce qui est déjà saisi page 1.
//
// C'était auparavant un champ `readOnly` prérempli depuis le profil : il ne se
// remplissait qu'au montage, et seulement pour un utilisateur connecté ayant
// un profil. Quelqu'un qui saisissait son nom directement dans le C1B laissait
// l'en-tête vide — sans pouvoir corriger, le champ étant verrouillé. Une règle
// serveur lit la valeur au moment de générer le PDF : elle ne peut pas être
// désynchronisée de la page 1.
//
// Le NISS de ce même en-tête a bien son widget (« NISS », page 2, x=123 y=793),
// contrairement à ce que disait ce commentaire jusqu'au 2026-07-26 — mais il est
// déjà revendiqué par le champ `niss` du seed. Aucune règle à écrire de ce côté,
// pour une autre raison que celle annoncée.
//
// ⚠ `pdfFieldName` = nom EXACT du widget. Le copier depuis
// `pnpm tsx scripts/dump-pdf-widgets.ts C1B_FR`, jamais le retaper.

import { bind } from "../engine";
import type { MappingRule } from "../types";

/// Widget « Nom » de l'en-tête de la page 2 (distinct du widget « nom » de la
/// page 1, en minuscule — le PDF distingue bien les deux par la casse).
const W_NOM_PAGE_2 = "Nom";

export const C1B_RULES: MappingRule[] = [bind("nom", W_NOM_PAGE_2)];
