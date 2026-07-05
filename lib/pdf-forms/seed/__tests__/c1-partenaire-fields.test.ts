import { describe, expect, it } from "vitest";
import { C1_PARTENAIRE_FIELDS, applyC1PartenaireImprovements } from "../c1-partenaire-fields";

describe("C1_PARTENAIRE_FIELDS", () => {
  it("couvre l'identité du chômeur et du partenaire", () => {
    const ids = C1_PARTENAIRE_FIELDS.map((f) => f.id);
    expect(ids).toContain("niss_ch_meur");
    expect(ids).toContain("nom_ch_meur");
    expect(ids).toContain("niss_partenaire");
    expect(ids).toContain("nom_partenaire");
  });

  it("les champs d'identité sont dans la section identite", () => {
    const byId = new Map(C1_PARTENAIRE_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("niss_ch_meur")?.section).toBe("identite");
    expect(byId.get("nom_ch_meur")?.section).toBe("identite");
    expect(byId.get("niss_partenaire")?.section).toBe("identite");
    expect(byId.get("nom_partenaire")?.section).toBe("identite");
  });

  it("couvre les 6 questions oui/non sur le partenaire, dans la section partenaire", () => {
    const byId = new Map(C1_PARTENAIRE_FIELDS.map((f) => [f.id, f]));
    const expected = [
      "partenaireRevenuProfessionnel",
      "partenaireRevenuRemplacement",
      "partenaireRevenuIntegration",
      "partenaireDejaDeclareAutreChomeur",
      "partenaireApparente3eDegre",
      "partenaireAllocationsFamiliales",
    ];
    for (const id of expected) {
      const field = byId.get(id);
      expect(field, `champ manquant: ${id}`).toBeDefined();
      expect(field?.type).toBe("radio");
      expect(field?.section).toBe("partenaire");
    }
  });

  it("chaque question oui/non pointe vers la bonne paire de checkboxes du dump JSON", () => {
    const byId = new Map(C1_PARTENAIRE_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("partenaireRevenuProfessionnel")?.pdfFieldName).toBe("oui|non");
    expect(byId.get("partenaireRevenuRemplacement")?.pdfFieldName).toBe("oui_2|non_2");
    expect(byId.get("partenaireRevenuIntegration")?.pdfFieldName).toBe("oui_3|non_3");
    expect(byId.get("partenaireDejaDeclareAutreChomeur")?.pdfFieldName).toBe("oui_4|non_4");
    expect(byId.get("partenaireApparente3eDegre")?.pdfFieldName).toBe("oui_5|non_5");
    expect(byId.get("partenaireAllocationsFamiliales")?.pdfFieldName).toBe("oui_6|non_6");
  });

  it("le détail de l'activité professionnelle et son montant ne sont visibles que si le partenaire a un revenu professionnel", () => {
    const byId = new Map(C1_PARTENAIRE_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("m_tier")?.visibleIf).toEqual({
      fieldId: "partenaireRevenuProfessionnel",
      op: "equals",
      value: "oui",
    });
    expect(byId.get("montant_mensuel_brut")?.visibleIf).toEqual({
      fieldId: "partenaireRevenuProfessionnel",
      op: "equals",
      value: "oui",
    });
  });

  it("la nature du revenu de remplacement n'est visible que si le partenaire a un revenu de remplacement", () => {
    const byId = new Map(C1_PARTENAIRE_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("revenu_de_remplacement")?.visibleIf).toEqual({
      fieldId: "partenaireRevenuRemplacement",
      op: "equals",
      value: "oui",
    });
  });

  it("couvre la date et les 2 signatures (chômeur + partenaire)", () => {
    const byId = new Map(C1_PARTENAIRE_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("aujourd_hui")?.type).toBe("date");
    expect(byId.get("aujourd_hui")?.prefillFrom).toBe("system.today");
    expect(byId.get("signature_du_ch_meur")?.type).toBe("signature");
    expect(byId.get("signature_du_partenaire")?.type).toBe("signature");
  });

  it("applyC1PartenaireImprovements() est idempotent (pas de doublon si ré-appliqué)", () => {
    const once = applyC1PartenaireImprovements([]);
    const twice = applyC1PartenaireImprovements(once);
    expect(twice.length).toBe(once.length);
    expect(twice.length).toBe(C1_PARTENAIRE_FIELDS.length);
  });

  it("applyC1PartenaireImprovements() remplace les entrées auto-inférées par leur version enrichie sans en dupliquer", () => {
    // Simule le dump JSON brut fourni : mêmes id, mais labels/sections auto-inférés.
    const raw = [
      { id: "non", pdfFieldName: "non", type: "checkbox" as const, required: false, label: { fr: "non" }, order: 0 },
      { id: "oui", pdfFieldName: "oui", type: "checkbox" as const, required: false, label: { fr: "oui" }, order: 6 },
      { id: "nom_partenaire", pdfFieldName: "Nom partenaire", type: "text" as const, required: false, label: { fr: "Nom Partenaire" }, order: 18 },
    ];
    const result = applyC1PartenaireImprovements(raw);
    expect(result.length).toBe(C1_PARTENAIRE_FIELDS.length);
    const byId = new Map(result.map((f) => [f.id, f]));
    // "non"/"oui" bruts sont retirés (fusionnés dans les radios "partenaireXxx").
    expect(byId.has("non")).toBe(false);
    expect(byId.has("oui")).toBe(false);
    // "nom_partenaire" est bien la version enrichie (section identite, pas auto-inférée).
    expect(byId.get("nom_partenaire")?.section).toBe("identite");
    expect(byId.get("nom_partenaire")?.label.fr).toBe("Nom et prénom du partenaire");
  });

  it("applyC1PartenaireImprovements() retire les 12 checkboxes brutes du dump JSON réel (id different du radio fusionné)", () => {
    // Reproduit le dump JSON fourni : les checkboxes non_2..non_6/oui_2..oui_6
    // ont un `id` propre (ex. "non_2") distinct de l'id du radio fusionné
    // (ex. "partenaireRevenuRemplacement") — seul le filtre par
    // `pdfFieldName` couvert peut les retirer, pas le filtre par `id`.
    const rawCheckboxes = [
      "non", "non_2", "non_3", "non_4", "non_5", "non_6",
      "oui", "oui_2", "oui_3", "oui_4", "oui_5", "oui_6",
    ].map((name, i) => ({
      id: name,
      pdfFieldName: name,
      type: "checkbox" as const,
      required: false,
      label: { fr: name.startsWith("non") ? "non" : "oui" },
      order: i,
    }));
    const result = applyC1PartenaireImprovements(rawCheckboxes);
    const byId = new Map(result.map((f) => [f.id, f]));
    for (const name of ["non", "non_2", "non_3", "non_4", "non_5", "non_6", "oui", "oui_2", "oui_3", "oui_4", "oui_5", "oui_6"]) {
      expect(byId.has(name), `checkbox brute non retirée: ${name}`).toBe(false);
    }
    expect(result.length).toBe(C1_PARTENAIRE_FIELDS.length);
  });

  it("couvre le champ 'Date de DA' réservé à l'organisme de paiement", () => {
    const byId = new Map(C1_PARTENAIRE_FIELDS.map((f) => [f.id, f]));
    const field = byId.get("dateDA");
    expect(field, "champ manquant: dateDA").toBeDefined();
    expect(field?.pdfFieldName).toBe("Date de DA");
    expect(field?.type).toBe("date");
    expect(field?.prefillFrom).toBe("system.today");
    expect(field?.section).toBe("identite");
  });

  it("le nombre total de champs correspond au schéma attendu (17 champs)", () => {
    // Dump brut = 23 widgets uniques. Une fois les 12 checkboxes oui/non
    // fusionnées en 6 radios (-6) : 6 (radios) + 5 (identité, dont dateDA) +
    // 3 (détails revenu) + 3 (date signature+signatures) = 17.
    // Aucun champ virtuel ajouté : le second "Montant mensuel brut" du
    // revenu de remplacement reste en A VALIDER (cf. commentaire dans
    // c1-partenaire-fields.ts) plutôt que d'être deviné.
    expect(C1_PARTENAIRE_FIELDS.length).toBe(17);
  });
});
