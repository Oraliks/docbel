import { describe, it, expect } from "vitest";
import { aUneSaisieSignalable } from "../field-error-report";

/// Sous chaque champ en erreur, le runner proposait « Vous êtes sûr de votre
/// saisie ? Signaler un problème ». Sur un champ VIDE, la phrase ne veut rien
/// dire — il n'y a pas de saisie dont on puisse être sûr — et l'étape Identité
/// du C1 en affichait dix d'un coup au premier « Continuer » à blanc
/// (2026-08-02). Le lien n'a de sens que pour un faux positif : une valeur
/// écrite que le validateur refuse.
///
/// Ce prédicat est la frontière. Il ne dit pas « le champ est valide », il dit
/// « il y a quelque chose à montrer à l'administrateur ».

describe("aUneSaisieSignalable", () => {
  it("dit non sur un champ jamais rempli", () => {
    expect(aUneSaisieSignalable(undefined)).toBe(false);
    expect(aUneSaisieSignalable(null)).toBe(false);
    expect(aUneSaisieSignalable("")).toBe(false);
    expect(aUneSaisieSignalable("   ")).toBe(false);
  });

  it("dit oui dès qu'un texte a été écrit, même refusé", () => {
    // Le cas d'usage même du signalement : un NISS que le validateur rejette
    // alors que le citoyen le lit sur sa carte.
    expect(aUneSaisieSignalable("85.07.14-231.06")).toBe(true);
    expect(aUneSaisieSignalable("0")).toBe(true);
  });

  it("traite 0 comme une saisie", () => {
    // Un montant de 0 € est une réponse, pas une absence de réponse.
    expect(aUneSaisieSignalable(0)).toBe(true);
    expect(aUneSaisieSignalable(1850)).toBe(true);
  });

  it("ne compte une case à cocher que si elle est cochée", () => {
    // Une case obligatoire non cochée est le cas « champ vide » du bloc des
    // affirmations : rien à signaler.
    expect(aUneSaisieSignalable(false)).toBe(false);
    expect(aUneSaisieSignalable(true)).toBe(true);
  });

  it("regarde À L'INTÉRIEUR d'un nom composé", () => {
    // `fullname` arrive toujours comme un objet : `JSON.stringify` le rendrait
    // « {} », donc non vide, et le lien réapparaîtrait sous un champ vierge.
    expect(aUneSaisieSignalable({})).toBe(false);
    expect(aUneSaisieSignalable({ first: "", last: "" })).toBe(false);
    expect(aUneSaisieSignalable({ first: "", last: "Vandenbroucke" })).toBe(true);
  });

  it("regarde À L'INTÉRIEUR d'une grille de lignes", () => {
    // Le tableau des cohabitants crée une ligne vierge au clic sur « Ajouter » :
    // elle ne vaut pas une saisie.
    expect(aUneSaisieSignalable([])).toBe(false);
    expect(aUneSaisieSignalable([{ prenom: "", nom: "" }])).toBe(false);
    expect(aUneSaisieSignalable([{ prenom: "Nadia", nom: "" }])).toBe(true);
  });
});
