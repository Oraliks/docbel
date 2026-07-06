import { describe, expect, it } from "vitest";
import { deriveBirthDateFromNiss } from "../niss-birthdate";

describe("deriveBirthDateFromNiss", () => {
  it("exemple officiel T.I. 000 (Registre national) : 42.01.22.051-81, homme né le 22/01/1942", () => {
    expect(deriveBirthDateFromNiss("42012205181")).toEqual({ iso: "1942-01-22" });
  });

  it("naissance après 2000 (checksum avec préfixe '2') : décode le bon siècle", () => {
    // NISS déjà utilisé et validé ailleurs (validation.test.ts / auto-fields).
    expect(deriveBirthDateFromNiss("85073003328")).toEqual({ iso: "1985-07-30" });
  });

  it("tolère les formats avec séparateurs (masque AAMMJJ-SSS.CC)", () => {
    expect(deriveBirthDateFromNiss("42.01.22-051.81")).toEqual({ iso: "1942-01-22" });
  });

  it("NISS invalide (checksum incorrect) : renvoie null (pas de date)", () => {
    expect(deriveBirthDateFromNiss("42012205182")).toBeNull();
  });

  it("NISS trop court : renvoie null", () => {
    expect(deriveBirthDateFromNiss("850730")).toBeNull();
  });

  it("date de naissance incomplète (mois='00', T.I. 000 p.2) : NISS valide mais iso=null", () => {
    // 40 00 01 001-33 : année seule connue, jour forcé à 01 (série 00 épuisée),
    // mois toujours "00" = inconnu — cf. exemple officiel T.I. 000 p.2.
    expect(deriveBirthDateFromNiss("40000100133")).toEqual({ iso: null });
  });

  it("rejette une date calendaire impossible même si le checksum matche", () => {
    // AAMMJJ = 85-04-31 (31 avril n'existe pas), checksum valide (97 - 850431001%97 = 09) :
    // on refuse de produire une date bancale plutôt que de la "rouler" sur mai.
    expect(deriveBirthDateFromNiss("85043100109")).toEqual({ iso: null });
  });
});
