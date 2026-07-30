import { describe, it, expect } from "vitest";
import { isSignatureField, isCreationDateField, isAutoField, applyServerAutoFields } from "../auto-fields";

describe("isSignatureField", () => {
  it("type signature explicite", () => {
    expect(isSignatureField({ id: "x", type: "signature" })).toBe(true);
  });
  it("type text mais libellé 'Signature' (cas C32)", () => {
    expect(isSignatureField({ id: "sig", type: "text", label: { fr: "Signature" } })).toBe(true);
  });
  it("libellé NL handtekening", () => {
    expect(isSignatureField({ id: "x", type: "text", label: { nl: "Handtekening" } })).toBe(true);
  });
  it("id 'Signature5' (ex. mockup)", () => {
    expect(isSignatureField({ id: "Signature5", type: "text" })).toBe(true);
  });
  it("ne déclenche pas sur un libellé non-signature", () => {
    expect(isSignatureField({ id: "remarks", type: "text", label: { fr: "Remarques" } })).toBe(false);
  });
  it("ne déclenche PAS sur un champ date de création dont le libellé contient « signature » (bug C1A 2026-07-30 : « Date de signature »)", () => {
    // Reproduit exactement le champ `dateSignature` du C1A (et de C1/C1B/C1C/
    // C46) : le mot « signature » dans « Date de signature » satisfaisait à
    // tort SIGNATURE_LABEL_RE, et le filler apposait le bloc « Signé
    // numériquement par… » sur le widget de la DATE au lieu d'y écrire le
    // jour — deux blocs de signature imprimés, la date jamais tamponnée.
    expect(
      isSignatureField({
        id: "dateSignature",
        type: "date",
        label: { fr: "Date de signature" },
        prefillFrom: "system.today",
      }),
    ).toBe(false);
  });
  it("ne déclenche pas non plus sans prefillFrom, sur le seul libellé « date de création/génération » + mot signature adjacent", () => {
    // Un champ typé `date` dont le libellé décrit une date de création reste
    // exclu même sans le marqueur `prefillFrom` explicite (repli purement par
    // libellé, cas des schémas hérités).
    expect(
      isSignatureField({ id: "d", type: "date", label: { fr: "Date de création (signature)" } }),
    ).toBe(false);
  });
});

describe("isCreationDateField", () => {
  it("prefillFrom system.today explicite", () => {
    expect(isCreationDateField({ id: "x", type: "date", prefillFrom: "system.today" })).toBe(true);
  });
  it("libellé 'Date de création' (cas C32)", () => {
    expect(isCreationDateField({ id: "d", type: "date", label: { fr: "Date de création" } })).toBe(true);
  });
  it("libellé 'Date de génération'", () => {
    expect(isCreationDateField({ id: "d", type: "date", label: { fr: "Date de génération" } })).toBe(true);
  });
  it("libellé NL Aanmaakdatum", () => {
    expect(isCreationDateField({ id: "d", type: "date", label: { nl: "Aanmaakdatum" } })).toBe(true);
  });
  it("ne déclenche pas sur 'Date de naissance'", () => {
    expect(isCreationDateField({ id: "n", type: "date", label: { fr: "Date de naissance" } })).toBe(false);
  });
});

describe("isAutoField", () => {
  it("vrai pour signature ou date de création, faux sinon", () => {
    expect(isAutoField({ id: "s", type: "text", label: { fr: "Signature" } })).toBe(true);
    expect(isAutoField({ id: "d", type: "date", label: { fr: "Date de création" } })).toBe(true);
    expect(isAutoField({ id: "n", type: "text", label: { fr: "Nom" } })).toBe(false);
  });

  it("vrai pour un champ marqué autoAnswered (ex. motifIntroduction restreint du C1)", () => {
    expect(isAutoField({ id: "motifIntroduction", type: "radio", autoAnswered: true })).toBe(true);
  });

  it("autoAnswered absent/false ne déclenche rien seul", () => {
    expect(isAutoField({ id: "x", type: "radio", label: { fr: "Motif" } })).toBe(false);
    expect(isAutoField({ id: "x", type: "radio", label: { fr: "Motif" }, autoAnswered: false })).toBe(false);
  });
});

describe("applyServerAutoFields", () => {
  const fields = [
    { id: "dateDoc", type: "date", prefillFrom: "system.today", label: { fr: "Date de création" } },
    { id: "sig", type: "signature", label: { fr: "Signature" } },
    { id: "nom", type: "text", label: { fr: "Nom" } },
    { id: "sigEcole", type: "signature", hidden: true, label: { fr: "Signature de l'école" } },
    { id: "dateEcole", type: "date", hidden: true, label: { fr: "Date de création (école)" } },
  ];

  it("injecte la date du jour + la signature confirmée, sans toucher aux autres champs", () => {
    const out = applyServerAutoFields(fields, { nom: "Devos" } as Record<string, unknown>, "2026-07-11");
    expect(out.dateDoc).toBe("2026-07-11");
    expect(out.sig).toBe("confirmed");
    expect(out.nom).toBe("Devos");
  });

  it("n'injecte JAMAIS un champ hidden (volet rempli par un tiers, ex. école)", () => {
    const out = applyServerAutoFields(fields, {}, "2026-07-11") as Record<string, unknown>;
    expect(out.sigEcole).toBeUndefined();
    expect(out.dateEcole).toBeUndefined();
  });

  it("n'écrase pas une signature déjà fournie, mais réécrit toujours la date de création", () => {
    const out = applyServerAutoFields(fields, { sig: "deja-signe", dateDoc: "2020-01-01" } as Record<string, unknown>, "2026-07-11");
    expect(out.sig).toBe("deja-signe"); // signature préexistante préservée
    expect(out.dateDoc).toBe("2026-07-11"); // date TOUJOURS = jour de génération
  });

  it("est pure : ne mute pas le payload d'entrée", () => {
    const input = { nom: "X" };
    const out = applyServerAutoFields(fields, input, "2026-07-11");
    expect(input).toEqual({ nom: "X" }); // entrée intacte
    expect(out).not.toBe(input); // nouvel objet
  });
});
