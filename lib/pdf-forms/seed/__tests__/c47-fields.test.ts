import { describe, expect, it } from "vitest";
import { C47_FIELDS, applyC47Improvements } from "../c47-fields";

describe("C47_FIELDS", () => {
  it("couvre l'identité, l'adresse, la demande et la signature", () => {
    const ids = C47_FIELDS.map((f) => f.id);
    expect(ids).toContain("pr_nom_et_nom");
    // Adresse scindée le 2026-07-26 : quatre valeurs canoniques héritables
    // du C1, recomposées sur les deux lignes imprimées par les règles
    // serveur (bindings/per-form/c47.ts).
    expect(ids).toContain("rue");
    expect(ids).toContain("numero");
    expect(ids).toContain("codePostal");
    expect(ids).toContain("commune");
    expect(ids).not.toContain("commune_et_code_postal");
    expect(ids).toContain("niss");
    expect(ids).toContain("t_l_phone");
    expect(ids).toContain("email");
    expect(ids).toContain("dateDA");
    expect(ids).toContain("jeuneTravailleurStageInsertion");
    expect(ids).toContain("chomeurCompletIndemniseInaptitude");
    expect(ids).toContain("aujourd_hui");
    expect(ids).toContain("signature");
  });

  it("compte 13 champs — 11 widgets AcroForm + 2 sous-champs d'adresse", () => {
    // « rue + numéro » et « code postal + commune » sont saisis séparément
    // mais imprimés sur une seule ligne chacun : plus de champs que de
    // widgets, l'écart étant comblé par les règles serveur.
    expect(C47_FIELDS.length).toBe(13);
  });

  it("les pdfFieldName sont copiés exactement depuis le dump AcroForm (casse, espaces, retours à la ligne)", () => {
    const byId = new Map(C47_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("pr_nom_et_nom")?.pdfFieldName).toBe("Prénom et nom");
    // `rue` / `numero` / `codePostal` / `commune` n'ont volontairement PAS
    // de pdfFieldName : leurs deux widgets sont écrits par des règles.
    expect(byId.get("rue")?.pdfFieldName).toBe("");
    expect(byId.get("commune")?.pdfFieldName).toBe("");
    expect(byId.get("niss")?.pdfFieldName).toBe("NISS");
    expect(byId.get("t_l_phone")?.pdfFieldName).toBe("Téléphone");
    expect(byId.get("email")?.pdfFieldName).toBe("Email");
    expect(byId.get("dateDA")?.pdfFieldName).toBe("Date de DA");
    expect(byId.get("aujourd_hui")?.pdfFieldName).toBe("AUJOURD'HUI");
    expect(byId.get("signature")?.pdfFieldName).toBe("Signature");
    // Apostrophes TYPOGRAPHIQUES (’) : ces deux attentes ont longtemps été
    // écrites avec l'apostrophe ASCII (') — le test disait « copiés exactement
    // depuis le dump » tout en comparant à une chaîne RETAPÉE à la main, donc
    // il validait la faute au lieu de l'attraper. Les champs pointaient vers un
    // widget inexistant et le C47 était impubliable. L'autorité, c'est le PDF :
    // cf. `seeds-vs-pdf.test.ts`, qui compare les seeds au vrai fichier.
    expect(byId.get("jeuneTravailleurStageInsertion")?.pdfFieldName).toBe(
      "Je suis un jeune travailleur en stage d’insertion professionnelle et j’invoque une inaptitude permanente au travail de 33 % au moins.\n(art. 36/3, § 2, AR 25.11.1991)"
    );
    expect(byId.get("chomeurCompletIndemniseInaptitude")?.pdfFieldName).toBe(
      "Je suis chômeur complet indemnisé et j’invoque une inaptitude permanente au travail de 33 % au moins.\n(art. 58, § 1er, et 58/3, § 4, AR 25.11.1991)"
    );
  });

  it("place les champs dans les bonnes sections", () => {
    const byId = new Map(C47_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("pr_nom_et_nom")?.section).toBe("identite");
    expect(byId.get("niss")?.section).toBe("identite");
    expect(byId.get("rue")?.section).toBe("adresse");
    expect(byId.get("numero")?.section).toBe("adresse");
    expect(byId.get("codePostal")?.section).toBe("adresse");
    expect(byId.get("commune")?.section).toBe("adresse");
    expect(byId.get("dateDA")?.section).toBe("demande");
    expect(byId.get("jeuneTravailleurStageInsertion")?.section).toBe("demande");
    expect(byId.get("chomeurCompletIndemniseInaptitude")?.section).toBe("demande");
    expect(byId.get("aujourd_hui")?.section).toBe("signature");
    expect(byId.get("signature")?.section).toBe("signature");
  });

  it("les 2 cases de situation (jeune travailleur / chômeur indemnisé) restent des checkboxes distinctes, pas fusionnées", () => {
    const byId = new Map(C47_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("jeuneTravailleurStageInsertion")?.type).toBe("checkbox");
    expect(byId.get("chomeurCompletIndemniseInaptitude")?.type).toBe("checkbox");
  });

  it("l'aide des 2 cases de situation mentionne l'exclusivité mutuelle", () => {
    const byId = new Map(C47_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("jeuneTravailleurStageInsertion")?.help?.fr).toMatch(/mutuellement exclusives/);
    expect(byId.get("chomeurCompletIndemniseInaptitude")?.help?.fr).toMatch(/mutuellement exclusives/);
  });

  it("téléphone et email sont facultatifs", () => {
    const byId = new Map(C47_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("t_l_phone")?.required).toBe(false);
    expect(byId.get("email")?.required).toBe(false);
  });

  it("les champs d'identité obligatoires sont marqués required", () => {
    const byId = new Map(C47_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("pr_nom_et_nom")?.required).toBe(true);
    expect(byId.get("rue")?.required).toBe(true);
    expect(byId.get("codePostal")?.required).toBe(true);
    expect(byId.get("commune")?.required).toBe(true);
    expect(byId.get("niss")?.required).toBe(true);
    expect(byId.get("dateDA")?.required).toBe(true);
    expect(byId.get("aujourd_hui")?.required).toBe(true);
    expect(byId.get("signature")?.required).toBe(true);
  });

  it("applyC47Improvements() est idempotent (pas de doublon si ré-appliqué)", () => {
    const once = applyC47Improvements([]);
    const twice = applyC47Improvements(once);
    expect(twice.length).toBe(once.length);
    expect(twice.length).toBe(C47_FIELDS.length);
  });

  it("applyC47Improvements() remplace les entrées auto-inférées de même id sans les dupliquer", () => {
    const stale = [
      {
        id: "niss",
        pdfFieldName: "NISS",
        type: "text" as const,
        required: false,
        label: { fr: "[3]" },
      },
      {
        id: "champ_non_couvert",
        pdfFieldName: "Un widget hors périmètre",
        type: "text" as const,
        required: false,
        label: { fr: "Ancien champ conservé tel quel" },
      },
    ];
    const result = applyC47Improvements(stale);
    expect(result.length).toBe(C47_FIELDS.length + 1);
    expect(result.find((f) => f.id === "champ_non_couvert")).toBeTruthy();
    const niss = result.find((f) => f.id === "niss");
    expect(niss?.type).toBe("niss");
    expect(niss?.label.fr).toBe("Numéro NISS (registre national)");
  });
});
