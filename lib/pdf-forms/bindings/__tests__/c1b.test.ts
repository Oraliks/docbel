import { describe, it, expect } from "vitest";
import { resolveStamps } from "../engine";
import { C1B_RULES } from "../per-form/c1b";

/// L'en-tête de la page 2 du C1B (« Suite C1B — NISS … Nom … ») duplique le
/// nom saisi page 1. C'était un champ `readOnly` prérempli depuis le profil :
/// il restait VIDE pour qui saisissait son nom directement dans le C1B, sans
/// possibilité de corriger. Une règle le recopie à la génération.
describe("Rules C1B — en-tête de la page 2", () => {
  // Cible POSITIONNELLE depuis le 2026-08-02 (`c1b:header-p2-nom`) : le widget
  // « Nom » est plus court que sa police, pdf-lib y centrait le texte et le
  // pointillé imprimé traversait les lettres.
  const NOM = "c1b:header-p2-nom";

  it("recopie le nom ET le prénom de la page 1", () => {
    // Le bandeau ne portait que le NOM (2026-08-02) : « El Ouazzani » là où le
    // C1A affiche « El Ouazzani Mohammed » sous le même libellé imprimé. Sur
    // une page 2 détachée, un patronyme seul identifie moins bien son porteur
    // qu'un nom complet, et la ligne pointillée a la place.
    expect(resolveStamps({ nom: "Dupont", pr_nom: "Jean" }, C1B_RULES).get(NOM)).toBe(
      "Dupont Jean",
    );
  });

  it("se contente du nom quand le prénom manque", () => {
    expect(resolveStamps({ nom: "Dupont" }, C1B_RULES).get(NOM)).toBe("Dupont");
  });

  it("ne stampe rien quand le nom est vide", () => {
    expect(resolveStamps({ nom: "" }, C1B_RULES).has(NOM)).toBe(false);
    expect(resolveStamps({}, C1B_RULES).has(NOM)).toBe(false);
  });

  it("recopie aussi le NISS dans l'en-tête de la PAGE 1", () => {
    // Le champ `niss` écrit en peigne, ce qui ne couvre qu'un rectangle —
    // celui de la page 2 sur ce document. Sans cette règle, l'en-tête de la
    // page 1 partirait blanc.
    expect(resolveStamps({ niss: "85073003328" }, C1B_RULES).get("c1b:header-p1-niss")).toBe(
      "85073003328",
    );
  });
});
