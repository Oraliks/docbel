import { describe, it, expect } from "vitest";
import { frVersISO, masqueDateFR } from "../date-picker-input";

/// Le champ date n'était qu'un bouton ouvrant un calendrier, alors que son
/// espace réservé annonçait « JJ/MM/AAAA » — il invitait à taper ce qu'on ne
/// pouvait pas taper. La saisie au clavier ajoutée le 2026-08-02 repose sur ces
/// deux fonctions pures ; c'est ici qu'elles se vérifient, sans monter React.

describe("masqueDateFR", () => {
  it("place les barres obliques à mesure de la frappe", () => {
    expect(masqueDateFR("")).toBe("");
    expect(masqueDateFR("1")).toBe("1");
    expect(masqueDateFR("15")).toBe("15");
    expect(masqueDateFR("158")).toBe("15/8");
    expect(masqueDateFR("1508")).toBe("15/08");
    expect(masqueDateFR("150820")).toBe("15/08/20");
    expect(masqueDateFR("15082026")).toBe("15/08/2026");
  });

  it("accepte une saisie déjà ponctuée, sans doubler les séparateurs", () => {
    // Un citoyen qui colle « 15/08/2026 » depuis un document, ou qui tape les
    // barres lui-même, doit obtenir la même chose que celui qui tape huit
    // chiffres.
    expect(masqueDateFR("15/08/2026")).toBe("15/08/2026");
    expect(masqueDateFR("15-08-2026")).toBe("15/08/2026");
    expect(masqueDateFR("15.08.2026")).toBe("15/08/2026");
  });

  it("ignore le surplus au lieu d'effacer la saisie", () => {
    // Neuf chiffres : on garde les huit premiers. Repartir de zéro ferait
    // disparaître le champ sous les doigts.
    expect(masqueDateFR("150820267")).toBe("15/08/2026");
  });
});

describe("frVersISO", () => {
  it("convertit une date complète", () => {
    expect(frVersISO("15/08/2026")).toBe("2026-08-15");
    expect(frVersISO("01/01/1990")).toBe("1990-01-01");
  });

  it("rend vide sur une saisie incomplète", () => {
    // Pendant la frappe, « 15/0 » n'est pas une date : le parent doit la
    // traiter comme absente, jamais comme une date fausse.
    expect(frVersISO("")).toBe("");
    expect(frVersISO("15")).toBe("");
    expect(frVersISO("15/08")).toBe("");
    expect(frVersISO("15/08/202")).toBe("");
  });

  it("REFUSE une date bien formée qui n'existe pas", () => {
    // Le piège : `new Date(2026, 1, 31)` ne lève pas, il glisse au 3 mars. Sans
    // ce contrôle, un citoyen tapant le 31 février signait une déclaration
    // officielle datée du 3 mars sans jamais l'avoir vu.
    expect(frVersISO("31/02/2026")).toBe("");
    expect(frVersISO("31/04/2026")).toBe("");
    expect(frVersISO("30/02/2024")).toBe("");
    expect(frVersISO("00/08/2026")).toBe("");
    expect(frVersISO("15/13/2026")).toBe("");
  });

  it("accepte le 29 février d'une année bissextile, refuse celui d'une autre", () => {
    expect(frVersISO("29/02/2024")).toBe("2024-02-29");
    expect(frVersISO("29/02/2025")).toBe("");
  });

  it("borne les années sur celles du calendrier", () => {
    // Une date tapée ne doit pas viser une année que le sélecteur refuserait :
    // les deux voies d'entrée mènent au même domaine de valeurs.
    expect(frVersISO("15/08/1919")).toBe("");
    expect(frVersISO("15/08/1920")).toBe("1920-08-15");
    const dansCinqAns = new Date().getFullYear() + 5;
    expect(frVersISO(`15/08/${dansCinqAns}`)).toBe(`${dansCinqAns}-08-15`);
    expect(frVersISO(`15/08/${dansCinqAns + 1}`)).toBe("");
  });

  it("tolère les espaces autour", () => {
    expect(frVersISO("  15/08/2026 ")).toBe("2026-08-15");
  });
});
