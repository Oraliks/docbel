// Règles serveur du C47 — « Demande de dispense / inaptitude permanente ».
//
// Comme le C1A, le C47 imprime son adresse sur deux lignes qui fusionnent
// chacune DEUX informations. La saisie les garde séparées (une clé canonique =
// une valeur, pour hériter du C1) ; ces règles recomposent les lignes.
//
// Le nom n'a pas besoin de règle : `pr_nom_et_nom` est un champ `fullname` que
// le filler assemble seul.
//
// Ordre d'assemblage : rue puis numéro, code postal puis commune (confirmé par
// Oraliks le 2026-07-26), comme sur le C1 et le C1A. Le nom du widget dit
// l'inverse (« Commune et code postal ») : c'est sans importance, les
// formulaires ONEM alternent librement les deux formulations sans que ça
// change ce qu'on écrit dans la case.
//
// ⚠ `pdfFieldName` = nom EXACT du widget. Les copier depuis
// `pnpm tsx scripts/dump-pdf-widgets.ts C47_FR`, jamais les retaper : c'est
// une apostrophe retapée qui avait rendu ce formulaire impubliable.

import { concatBinding } from "../shared";
import type { MappingRule } from "../types";

const W_RUE = "Rue";
const W_COMMUNE_CODE_POSTAL = "Commune et code postal";

// Clés SENTINELLES (aucun widget AcroForm ne porte ces noms) résolues par
// `POSITIONAL_EXTRA_STAMPS` dans filler.ts, qui dessine alors directement sur
// la page au lieu de chercher un widget.
//
// Pourquoi les trois cases « votre demande » passent par là : le champ AcroForm
// « Je suis un jeune travailleur…(art. 36/3, § 2, AR 25.11.1991) » porte DEUX
// widgets (`/Kids`) — sa propre case (y=274,9) et la case « Je demande que le
// montant … soit fixé » de l'AUTRE cadre (y=394,6). Deux widgets d'un même
// champ partagent une seule valeur : le cocher cochait les deux cadres à la
// fois. La case « chômeur complet indemnisé », elle, a un champ sain, mais elle
// est dessinée pareil pour que les trois croix soient identiques à l'œil.
//
// ⚠ PAS de `declaredWidgets` sur ces trois règles : `declaredWidgets` sert au
// rapport de couverture AcroForm à vérifier qu'une règle cible un VRAI widget
// du PDF. Une clé sentinelle n'en est pas un — la lister ferait échouer la
// publication avec « Règle serveur cible un widget absent du PDF ».
const W_CASE_ART114 = "c47:case-art114";
const W_CASE_JEUNE_TRAVAILLEUR = "c47:case-jeune-travailleur";
const W_CASE_CHOMEUR_INDEMNISE = "c47:case-chomeur-indemnise";

/// Case à cocher du choix `cadreDemande`, par valeur d'option.
const CASE_PAR_CHOIX: Readonly<Record<string, string>> = {
  art114: W_CASE_ART114,
  "jeune-travailleur": W_CASE_JEUNE_TRAVAILLEUR,
  "chomeur-indemnise": W_CASE_CHOMEUR_INDEMNISE,
};

export const C47_RULES: MappingRule[] = [
  concatBinding({ name: "adresse-rue-numero", widget: W_RUE, fields: ["rue", "numero"] }),
  concatBinding({
    name: "code-postal-commune",
    widget: W_COMMUNE_CODE_POSTAL,
    fields: ["codePostal", "commune"],
  }),

  // Une seule croix, sur la case du choix retenu. Les deux autres restent
  // vierges parce que rien n'y est dessiné — pas besoin de les « décocher » :
  // en positionnel, ne rien écrire EST la case vide.
  //
  // Valeur « X » et non `true` : `dessinerStampPositionnel` dessine du texte,
  // un booléen n'y aurait aucun sens (les stamps booléens sont réservés aux
  // vrais widgets checkbox).
  {
    name: "cadre-demande-case",
    whenFn: (payload) =>
      typeof payload.cadreDemande === "string" && payload.cadreDemande in CASE_PAR_CHOIX,
    stampFn: (payload) => {
      const widget = CASE_PAR_CHOIX[String(payload.cadreDemande)];
      return widget ? [{ widget, value: "X" }] : [];
    },
  },
];
