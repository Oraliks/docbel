import { describe, it, expect } from "vitest";
import { deriveBirthDateFromNiss } from "../niss-birthdate";

/// Le siècle d'un NISS se déduit de la branche de checksum qui valide le
/// numéro : sans préfixe « 2 » → 19xx, avec → 20xx. Le calcul était juste, mais
/// il ne se demandait pas si la date obtenue existait DANS LE PASSÉ.
///
/// Un numéro inventé (ou mal recopié) a environ une chance sur 97 de satisfaire
/// la branche 20xx par hasard. Quand ses deux premiers chiffres dépassent
/// l'année en cours, la dérivation rendait alors une naissance à venir —
/// « 2078-11-02 » relevé le 2026-08-02 en remplissant le C1 à l'écran. Le champ
/// « date de naissance » est dérivé et verrouillé : le citoyen ne pouvait ni le
/// voir venir ni le corriger, et la date partait sur une déclaration officielle.
///
/// Personne ne naît demain. Une date future signifie que la lecture du numéro
/// est fausse, pas que le citoyen a un état civil singulier.

describe("deriveBirthDateFromNiss — les dates impossibles", () => {
  it("REFUSE une naissance dans le futur", () => {
    // Ce numéro passe bien le checksum (branche 20xx), et donnait 2078-11-02.
    expect(deriveBirthDateFromNiss("78.11.02-088.44")).toEqual({ iso: null });
  });

  it("rend toujours une date passée quand le numéro en encode une", () => {
    // Contrôle négatif : sans lui, un garde trop large viderait toutes les
    // dates et le test précédent passerait pour de mauvaises raisons.
    const nee1968 = deriveBirthDateFromNiss("68.05.21-123.31");
    expect(nee1968?.iso).toBe("1968-05-21");

    const nee2003 = deriveBirthDateFromNiss("03.09.15-101.89");
    expect(nee2003?.iso).toBe("2003-09-15");
  });

  it("laisse passer une naissance du jour même", () => {
    // La borne est « après aujourd'hui », pas « avant aujourd'hui » : un
    // nouveau-né a un NISS le jour de sa déclaration.
    const aujourdhui = new Date();
    const aa = String(aujourdhui.getFullYear() % 100).padStart(2, "0");
    const mm = String(aujourdhui.getMonth() + 1).padStart(2, "0");
    const jj = String(aujourdhui.getDate()).padStart(2, "0");
    const base = `${aa}${mm}${jj}001`;
    // Checksum de la branche 20xx (préfixe « 2 »), la seule possible pour une
    // naissance de cette année.
    const check = String(97 - (Number(`2${base}`) % 97)).padStart(2, "0");
    expect(deriveBirthDateFromNiss(`${base}${check}`)?.iso).toBe(
      `${aujourdhui.getFullYear()}-${mm}-${jj}`,
    );
  });
});
