import { describe, it, expect } from "vitest";
import { buildEnrichedSchema } from "../field-inference";
import type { AcroFieldRaw } from "../types";

function raw(name: string, opts?: Partial<AcroFieldRaw>): AcroFieldRaw {
  return {
    pdfFieldName: name,
    acroType: opts?.acroType ?? "text",
    ...opts,
  };
}

describe("field-inference — auto-tagging canonicalKey", () => {
  it("tag identity.niss sur les widgets NISS / RRN / rijksregister", () => {
    const enriched = buildEnrichedSchema([
      raw("NISS"),
      raw("Numéro RRN"),
      raw("rijksregisternummer"),
    ]);
    expect(enriched.every((f) => f.canonicalKey === "identity.niss")).toBe(true);
  });

  it("tag identity.nom et identity.prenom sur les widgets nom/prenom", () => {
    const enriched = buildEnrichedSchema([
      raw("Nom"),
      raw("Prénom"),
      raw("Voornaam"),
    ]);
    expect(enriched[0].canonicalKey).toBe("identity.nom");
    expect(enriched[1].canonicalKey).toBe("identity.prenom");
    expect(enriched[2].canonicalKey).toBe("identity.prenom");
  });

  it("distingue banque.titulaire de identity.nom (piège classique)", () => {
    const enriched = buildEnrichedSchema([raw("Nom du titulaire")]);
    expect(enriched[0].canonicalKey).toBe("banque.titulaire");
  });

  it("distingue identity.nationalite de adresse.pays", () => {
    const enriched = buildEnrichedSchema([raw("Nationalité"), raw("Pays")]);
    expect(enriched[0].canonicalKey).toBe("identity.nationalite");
    expect(enriched[1].canonicalKey).toBe("adresse.pays");
  });

  it("tag adresse.rue mais PAS identity.nom sur « Rue »", () => {
    const enriched = buildEnrichedSchema([raw("Rue")]);
    expect(enriched[0].canonicalKey).toBe("adresse.rue");
  });

  it("tag banque.iban / banque.bic", () => {
    const enriched = buildEnrichedSchema([raw("IBAN"), raw("BIC")]);
    expect(enriched[0].canonicalKey).toBe("banque.iban");
    expect(enriched[1].canonicalKey).toBe("banque.bic");
  });

  it("tag contact.email / contact.telephone", () => {
    const enriched = buildEnrichedSchema([
      raw("Email"),
      raw("E-mail"),
      raw("Téléphone"),
      raw("GSM"),
    ]);
    expect(enriched[0].canonicalKey).toBe("contact.email");
    expect(enriched[1].canonicalKey).toBe("contact.email");
    expect(enriched[2].canonicalKey).toBe("contact.telephone");
    expect(enriched[3].canonicalKey).toBe("contact.telephone");
  });

  it("N'infère PAS de canonicalKey sur un widget checkbox (sémantique différente)", () => {
    const enriched = buildEnrichedSchema([raw("nom_de_la_case", { acroType: "checkbox" })]);
    expect(enriched[0].canonicalKey).toBeUndefined();
  });

  it("N'infère PAS de canonicalKey sur un widget dropdown / radio", () => {
    const enriched = buildEnrichedSchema([
      raw("nom_dropdown", { acroType: "dropdown" }),
      raw("nom_radio", { acroType: "radio" }),
    ]);
    expect(enriched[0].canonicalKey).toBeUndefined();
    expect(enriched[1].canonicalKey).toBeUndefined();
  });

  it("regex Prénom ne matche PAS « nom » (garantie ordre d'insertion)", () => {
    // Les 2 widgets « Prénom » et « Nom » côte-à-côte : chacun doit avoir
    // sa propre clé, pas la même.
    const enriched = buildEnrichedSchema([raw("Prénom"), raw("Nom")]);
    expect(enriched[0].canonicalKey).toBe("identity.prenom");
    expect(enriched[1].canonicalKey).toBe("identity.nom");
  });

  it("tooltip fournit un indice supplémentaire (fallback quand le nom est cryptique)", () => {
    const enriched = buildEnrichedSchema([raw("Text42", { tooltip: "Votre adresse e-mail" })]);
    expect(enriched[0].canonicalKey).toBe("contact.email");
  });

  it("champ sans match → pas de canonicalKey (safe)", () => {
    const enriched = buildEnrichedSchema([raw("montant_brut_mensuel")]);
    expect(enriched[0].canonicalKey).toBeUndefined();
  });
});
