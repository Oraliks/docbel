import { describe, expect, it } from "vitest";
import { C46_FIELDS, applyC46Improvements } from "../c46-fields";

describe("C46_FIELDS", () => {
  it("couvre l'identité, la déclaration du mandat et les annexes de nomination", () => {
    const ids = C46_FIELDS.map((f) => f.id);
    expect(ids).toContain("nom_et_pr_nom");
    expect(ids).toContain("niss");
    expect(ids).toContain("lorganismes_suivants");
    expect(ids).toContain("publicationMoniteurBelge");
    expect(ids).toContain("moniteur_belge_du");
    expect(ids).toContain("moniteur_belge_du_2");
    for (let n = 1; n <= 5; n++) {
      expect(ids).toContain(`nominations_suivantes_${n}`);
    }
    expect(ids).toContain("date39_af_date");
    expect(ids).toContain("signature");
  });

  it("le total de champs correspond au nombre attendu (13 champs du dump + 1 question virtuelle publicationMoniteurBelge)", () => {
    expect(C46_FIELDS.length).toBe(14);
  });

  it("les champs d'identité sont bien rattachés à la section partagée 'identite'", () => {
    const byId = new Map(C46_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("nom_et_pr_nom")?.section).toBe("identite");
    expect(byId.get("niss")?.section).toBe("identite");
  });

  it("les champs 'Moniteur belge' pointent vers les vrais noms de widgets PDF et sont masqués tant que la publication n'est pas confirmée", () => {
    const byId = new Map(C46_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("moniteur_belge_du")?.pdfFieldName).toBe("Moniteur Belge du");
    expect(byId.get("moniteur_belge_du_2")?.pdfFieldName).toBe("Moniteur Belge du_2");
    expect(byId.get("moniteur_belge_du")?.visibleIf).toEqual({
      fieldId: "publicationMoniteurBelge",
      op: "equals",
      value: "oui",
    });
  });

  it("les 5 lignes de nomination pointent vers les vrais noms de widgets PDF et sont masquées tant que la publication est confirmée", () => {
    const byId = new Map(C46_FIELDS.map((f) => [f.id, f]));
    for (let n = 1; n <= 5; n++) {
      expect(byId.get(`nominations_suivantes_${n}`)?.pdfFieldName).toBe(`nominations suivantes ${n}`);
      expect(byId.get(`nominations_suivantes_${n}`)?.visibleIf).toEqual({
        fieldId: "publicationMoniteurBelge",
        op: "equals",
        value: "non",
      });
    }
  });

  it("le champ 'AUJOURD'HUI' (tampon administratif) est masqué au citoyen", () => {
    const byId = new Map(C46_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("aujourd_hui")?.hidden).toBe(true);
  });

  it("la signature et la date de signature sont requises", () => {
    const byId = new Map(C46_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("date39_af_date")?.required).toBe(true);
    expect(byId.get("signature")?.required).toBe(true);
    expect(byId.get("signature")?.type).toBe("signature");
  });

  it("applyC46Improvements() est idempotent (pas de doublon si ré-appliqué)", () => {
    const once = applyC46Improvements([]);
    const twice = applyC46Improvements(once);
    expect(twice.length).toBe(once.length);
    expect(twice.length).toBe(C46_FIELDS.length);
  });

  it("applyC46Improvements() retire les anciens champs bruts couverts par un id redéfini et préserve le reste", () => {
    const bruts = [
      { id: "nom_et_pr_nom", pdfFieldName: "Nom et prénom", type: "text" as const, required: false, label: { fr: "undefined" } },
      { id: "champInconnu", pdfFieldName: "un widget non listé ici", type: "text" as const, required: false, label: { fr: "Champ préservé" } },
    ];
    const result = applyC46Improvements(bruts);
    const ids = result.map((f) => f.id);
    expect(ids).toContain("champInconnu");
    expect(ids.filter((id) => id === "nom_et_pr_nom")).toHaveLength(1);
    expect(result.length).toBe(C46_FIELDS.length + 1);
  });
});
