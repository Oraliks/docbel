import { describe, it, expect } from "vitest";
import { resolveSignerName, buildSignatureBlock, signatureTimestamp } from "../signature";

describe("resolveSignerName", () => {
  it("utilise un champ fullname en priorité", () => {
    const fields = [{ id: "name", type: "fullname", nameOrder: "first-last" as const }];
    const name = resolveSignerName(fields, { name: { first: "Jean", last: "Dupont" } });
    expect(name).toBe("Jean Dupont");
  });

  it("respecte l'ordre nameOrder du fullname", () => {
    const fields = [{ id: "name", type: "fullname", nameOrder: "last-first" as const }];
    expect(resolveSignerName(fields, { name: { first: "Jean", last: "Dupont" } })).toBe("Dupont Jean");
  });

  it("compose prénom + nom via prefillFrom", () => {
    const fields = [
      { id: "fn", type: "text", prefillFrom: "profile.firstName" },
      { id: "ln", type: "text", prefillFrom: "profile.lastName" },
    ];
    expect(resolveSignerName(fields, { fn: "Cecilia", ln: "Demo" })).toBe("Cecilia Demo");
  });

  it("retombe sur l'heuristique libellé/id (Prénom / Nom)", () => {
    const fields = [
      { id: "prenom", type: "text", label: { fr: "Prénom" } },
      { id: "nom", type: "text", label: { fr: "Nom" } },
    ];
    expect(resolveSignerName(fields, { prenom: "Cecilia", nom: "Demo" })).toBe("Cecilia Demo");
  });

  it("renvoie '' si aucun nom exploitable", () => {
    const fields = [{ id: "x", type: "text", label: { fr: "Remarque" } }];
    expect(resolveSignerName(fields, { x: "blabla" })).toBe("");
  });
});

describe("signatureTimestamp / buildSignatureBlock", () => {
  it("horodatage au format AAAA.MM.JJ HH:mm:ss", () => {
    expect(signatureTimestamp(new Date("2026-05-31T12:30:00Z"))).toMatch(/^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}$/);
  });
  it("compose les 3 lignes du bloc", () => {
    const b = buildSignatureBlock("Jean Dupont", new Date("2026-05-31T12:30:00Z"));
    expect(b.name).toBe("Jean Dupont");
    expect(b.by).toBe("Signé numériquement par Jean Dupont");
    expect(b.date).toMatch(/^Date : \d{4}\.\d{2}\.\d{2}/);
  });
});
