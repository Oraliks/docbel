import { describe, it, expect } from "vitest";
import { visiblePayload } from "../validation";
import { resolveStamps } from "../bindings/engine";
import { getRulesForSlug } from "../bindings/registry";
import { applyC1Improvements } from "../seed/c1-fields-improvements";
import type { FormPayload } from "../types";

/// Ce que le citoyen NE VOYAIT PAS ne doit pas s'imprimer.
///
/// Un champ masqué par `visibleIf` garde sa valeur dans le state du runner. Le
/// filler le savait et sautait ces champs ; le moteur de règles serveur, lui,
/// lisait le payload brut. Deux déclarations officielles fausses en sont
/// sorties, toutes deux reproduites ici avant correction :
///
///   - un IBAN imprimé à côté d'une case « chèque circulaire » cochée ;
///   - des remarques sur des cohabitants dans un dossier déclaré isolé.
///
/// Les tests passent par le VRAI schéma C1 et le VRAI registre de règles : ce
/// sont les conditions de visibilité réelles qui sont exercées, pas des
/// conditions inventées pour le test.

const C1_FIELDS = applyC1Improvements([], {
  defaultMotif: "modification",
  restrictMotifTo5Situations: true,
});
const C1_RULES = getRulesForSlug("c1-changement-situation");

function stampsFor(payload: FormPayload): Map<string, string | boolean> {
  return resolveStamps(visiblePayload(C1_FIELDS, payload), C1_RULES);
}

describe("visiblePayload — le compte bancaire", () => {
  it("n'imprime aucun IBAN quand le citoyen a choisi le chèque circulaire", () => {
    // Parcours réel : le citoyen saisit son IBAN (« virement » est la valeur
    // par défaut), puis bascule sur le chèque. `iban` devient invisible mais
    // sa valeur reste dans le state — et Zod ne la strippe pas.
    const stamps = stampsFor({
      modePaiement: "cheque",
      iban: "BE68539007547034",
    });

    // Les 4 widgets du compte belge éclaté doivent rester vierges.
    expect(stamps.get("B E")).toBeUndefined();
    expect(stamps.get("undefined_11")).toBeUndefined();
    expect(stamps.get("undefined_12")).toBeUndefined();
    expect(stamps.get("undefined_13")).toBeUndefined();
  });

  it("n'imprime pas non plus un IBAN étranger résiduel", () => {
    const stamps = stampsFor({
      modePaiement: "cheque",
      iban: "FR7630006000011234567890189",
    });
    expect(stamps.get("IBAN")).toBeUndefined();
  });

  it("imprime bien l'IBAN quand le virement est effectivement choisi", () => {
    // Contrôle négatif : sans lui, un filtre trop zélé passerait ce test
    // suite sans rien imprimer du tout.
    const stamps = stampsFor({
      modePaiement: "virement",
      iban: "BE68539007547034",
    });
    expect(stamps.get("B E")).toBe("68");
    expect(stamps.get("undefined_11")).toBe("5390");
    expect(stamps.get("undefined_12")).toBe("0754");
    expect(stamps.get("undefined_13")).toBe("7034");
  });
});

describe("visiblePayload — les remarques de situation familiale", () => {
  it("n'imprime pas le statut d'un jugement quand le dossier n'est plus isolé", () => {
    // Isolé → pension alimentaire « oui » → « jugement en cours », puis
    // bascule sur « je cohabite ». Les deux champs deviennent invisibles.
    const isole = stampsFor({
      statutFamilial: "isole",
      pensionAlimentaire: "oui",
      statutJugementPensionAlimentaire: "en-cours",
    });
    const bascule = stampsFor({
      statutFamilial: "cohabitant",
      pensionAlimentaire: "oui",
      statutJugementPensionAlimentaire: "en-cours",
    });

    // Contrôle négatif d'abord : la remarque existe bien dans le cas légitime.
    expect(String(isole.get("Remarques 1 Haut") ?? "")).toContain("jugement");
    // …et disparaît dès que la rubrique n'est plus posée au citoyen.
    expect(String(bascule.get("Remarques 1 Haut") ?? "")).not.toContain("jugement");
  });
});
