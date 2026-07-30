// Règles serveur du C1A — « Déclaration d'activité accessoire / aide à un
// indépendant ».
//
// Le C1A a deux besoins de recomposition, sans rapport entre eux :
//
//   1. Deux widgets d'ADRESSE (page 1) fusionnent chacun DEUX informations,
//      alors que le formulaire de saisie les garde séparées pour pouvoir les
//      hériter du C1 (une clé canonique = une valeur).
//
//   2. L'en-tête de la page 2 (« Suite C1A | NISS ⎵⎵⎵⎵⎵⎵⎵⎵⎵⎵⎵ | Nom .......... »)
//      n'a AUCUN widget exploitable : les deux cases partagent le champ
//      AcroForm "1_3" avec la 1ʳᵉ ligne « périodes » de Q18 (cf.
//      seed/c1a-fields.ts, commentaire près de `q18periodesTexte`) — écrire
//      dedans imprimerait la même valeur aux TROIS emplacements. C'est pour
//      cette raison que le commit d4c470b a cessé d'alimenter ce champ,
//      laissant l'en-tête blanc. Les règles "nom-header-p2"/"niss-header-p2"
//      ci-dessous réparent ça par RAPPEL POSITIONNEL (aucun widget cible, cf.
//      `POSITIONAL_EXTRA_STAMPS` dans filler.ts) de l'identité déjà saisie en
//      page 1 — rien n'est redemandé au citoyen.
//
// Le nom complet DE LA PAGE 1, lui, n'a besoin d'AUCUNE règle : le champ
// `nomEtPrenom` est de type `fullname` et le filler assemble « Nom Prénom »
// tout seul sur son propre widget (cf. `assembleFullName`,
// `nameOrder: "last-first"`). La règle "nom-header-p2" refait le MÊME
// assemblage pour le rappel de page 2, qui lui n'a pas de widget.
//
// ⚠ Les `pdfFieldName` ci-dessous doivent reproduire EXACTEMENT les noms de
// widgets de C1A_FR.pdf. Ne jamais les retaper : les copier depuis
// `pnpm tsx scripts/dump-pdf-widgets.ts C1A_FR`. Le test `seeds-vs-pdf`
// n'attrape que les champs du schéma, pas les widgets déclarés par une règle —
// c'est `checkPublishable` qui s'en charge (erreur bloquante).

import { concatBinding } from "../shared";
import type { MappingRule } from "../types";
import { assembleFullName } from "../../system-values";

const W_RUE = "Rue";
const W_CODE_POSTAL_COMMUNE = "Code postal et commune";

// Clés SENTINELLES (aucun widget AcroForm ne porte ce nom) résolues par
// `POSITIONAL_EXTRA_STAMPS` dans filler.ts, qui dessine alors directement sur
// la page au lieu de chercher un widget. Cf. le commentaire d'en-tête
// ci-dessus pour le pourquoi (widget "1_3" partagé, inutilisable ici).
const W_HEADER_P2_NOM = "c1a:header-p2-nom";
const W_HEADER_P2_NISS = "c1a:header-p2-niss";

export const C1A_RULES: MappingRule[] = [
  // « Rue et numéro » sur une seule ligne imprimée.
  concatBinding({ name: "adresse-rue-numero", widget: W_RUE, fields: ["rue", "numero"] }),
  // « 1000 Bruxelles » — même grammaire que la règle `code-postal-commune`
  // du C1 changement de situation.
  concatBinding({
    name: "code-postal-commune",
    widget: W_CODE_POSTAL_COMMUNE,
    fields: ["codePostal", "commune"],
  }),

  // -------- Rappel d'identité en-tête page 2 (écriture positionnelle) -----
  //
  // Composition IDENTIQUE à celle du widget "Nom et prénom" de la page 1
  // (même `assembleFullName`, même `nameOrder: "last-first"` → « NOM
  // Prénom ») : le rappel de page 2 doit afficher la même chose, pas une
  // variante.
  //
  // ⚠ PAS de `declaredWidgets` sur ces deux règles, à la différence des
  // autres règles de ce fichier : `declaredWidgets` sert au rapport de
  // couverture AcroForm (`mapping-report.ts` → `checkPublishable`) à vérifier
  // qu'un `stampFn` cible bien un VRAI widget du PDF. Une clé sentinelle n'en
  // est pas un — la lister ferait échouer la publication avec « Règle serveur
  // cible un widget absent du PDF » (vérifié : c'est exactement ce qui arrive
  // si on l'ajoute, cf. seeds-vs-pdf.test.ts). `POSITIONAL_EXTRA_STAMPS`
  // (filler.ts) est la seule source de vérité pour ces deux cibles.
  {
    name: "nom-header-p2",
    whenFn: (payload) => assembleFullName(payload.nomEtPrenom, "last-first").trim() !== "",
    stampFn: (payload) => {
      const value = assembleFullName(payload.nomEtPrenom, "last-first").trim();
      return value ? [{ widget: W_HEADER_P2_NOM, value }] : [];
    },
  },
  // Valeur brute (avec points/tirets éventuels) : le dessin positionnel du
  // peigne (`placerPeigne`) retire déjà tout caractère non alphanumérique
  // avant de répartir les 11 chiffres sur le guide — pas besoin de la
  // nettoyer ici.
  {
    name: "niss-header-p2",
    whenFn: (payload) => typeof payload.niss === "string" && payload.niss.trim() !== "",
    stampFn: (payload) => {
      const value = typeof payload.niss === "string" ? payload.niss.trim() : "";
      return value ? [{ widget: W_HEADER_P2_NISS, value }] : [];
    },
  },
];
