import { describe, expect, it } from "vitest";
import { resolveStamps } from "../engine";
import { getRulesForSlug } from "../registry";
import { C1C_RULES } from "../per-form/c1c";

const W_SITE = "Je dispose dun site internet pour mon activité";

/// Valeur écrite sur le widget du site internet pour un payload donné.
function siteStampe(saisie: unknown): string | boolean | undefined {
  return resolveStamps({ siteInternetUrl: saisie } as never, C1C_RULES).get(W_SITE);
}

describe("C1C — le « www » est déjà imprimé sur le papier", () => {
  it("est branché dans le registry", () => {
    expect(getRulesForSlug("c1c")).toBe(C1C_RULES);
  });

  it("retire le schéma et le « www. » de tête", () => {
    // Ce que colle un navigateur.
    expect(siteStampe("https://www.exemple.be")).toBe("exemple.be");
    expect(siteStampe("http://www.exemple.be")).toBe("exemple.be");
    // Ce que tape un citoyen qui a lu le « www » imprimé… ou qui ne l'a pas lu.
    expect(siteStampe("www.exemple.be")).toBe("exemple.be");
    expect(siteStampe("https://exemple.be")).toBe("exemple.be");
    // Déjà propre : rien à faire.
    expect(siteStampe("exemple.be")).toBe("exemple.be");
  });

  it("garde le chemin, les sous-domaines et la casse du reste de l'adresse", () => {
    expect(siteStampe("https://www.exemple.be/ma-boutique")).toBe("exemple.be/ma-boutique");
    expect(siteStampe("https://shop.exemple.be")).toBe("shop.exemple.be");
    expect(siteStampe("www.Exemple.BE")).toBe("Exemple.BE");
  });

  it("ne mange pas un « www » qui fait partie du nom de domaine", () => {
    // Le point est exigé : `wwwfoo.be` est un domaine valide.
    expect(siteStampe("wwwfoo.be")).toBe("wwwfoo.be");
  });

  it("n'émet aucun stamp quand le citoyen n'a pas de site (case « non »)", () => {
    expect(siteStampe(undefined)).toBeUndefined();
    expect(siteStampe("")).toBeUndefined();
    expect(siteStampe("   ")).toBeUndefined();
  });
});
