import { describe, expect, it } from "vitest";
import { C1C_FIELDS, applyC1CImprovements } from "../c1c-fields";

describe("C1C_FIELDS", () => {
  it("couvre l'identité, la description d'activité, le lieu d'exercice et la forme d'exercice", () => {
    const ids = C1C_FIELDS.map((f) => f.id);
    expect(ids).toContain("pr_nom_et_nom");
    expect(ids).toContain("niss");
    expect(ids).toContain("dateDebutActivite");
    expect(ids).toContain("descriptionActivite1");
    expect(ids).toContain("possedeSiteInternet");
    expect(ids).toContain("lieuExerciceActivite");
    expect(ids).toContain("formeExerciceActivite");
    expect(ids).toContain("numeroBce");
    expect(ids).toContain("activiteExerceeParTiers");
    expect(ids).toContain("competencesProfessionnellesSpecifiques");
  });

  it("couvre les revenus, les activités antérieures, les affirmations, annexes et signature", () => {
    const ids = C1C_FIELDS.map((f) => f.id);
    expect(ids).toContain("revenuBrutAnnuel");
    expect(ids).toContain("revenuNetImposableAnnuel");
    expect(ids).toContain("activiteIndependanteAnterieure");
    expect(ids).toContain("descriptionActivitesAnterieures1");
    expect(ids).toContain("affirmationSincereEtComplete");
    expect(ids).toContain("annexes");
    expect(ids).toContain("dateSignature");
    expect(ids).toContain("signature");
  });

  it("les champs clés portent la bonne section", () => {
    const byId = new Map(C1C_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("pr_nom_et_nom")?.section).toBe("identite");
    expect(byId.get("niss")?.section).toBe("identite");
    expect(byId.get("descriptionActivite1")?.section).toBe("mes-activites");
    expect(byId.get("formeExerciceActivite")?.section).toBe("mes-activites");
    expect(byId.get("revenuBrutAnnuel")?.section).toBe("mes-revenus");
    expect(byId.get("revenuNetImposableAnnuel")?.section).toBe("mes-revenus");
    expect(byId.get("activiteIndependanteAnterieure")?.section).toBe("activites-anterieures");
    expect(byId.get("affirmationSincereEtComplete")?.section).toBe("affirmations");
    expect(byId.get("annexes")?.section).toBe("annexes");
    expect(byId.get("signature")?.section).toBe("signature");
  });

  it("les pdfFieldName des champs fusionnés (radio oui/non) pointent vers les vrais noms de widgets du dump", () => {
    const byId = new Map(C1C_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("possedeSiteInternet")?.pdfFieldName).toBe("non|oui www");
    expect(byId.get("lieuExerciceActivite")?.pdfFieldName).toBe("à ladresse de mon domicile|à une autre adresse");
    expect(byId.get("formeExerciceActivite")?.pdfFieldName).toBe(
      "toggle_5|société mandataire administrateur gérant ou associé actif"
    );
    expect(byId.get("activiteExerceeParTiers")?.pdfFieldName).toBe("non_2|oui");
    expect(byId.get("competencesProfessionnellesSpecifiques")?.pdfFieldName).toBe(
      "oui_2|non jai besoin dun tiers conjoint aidantfamilial mandataire pour me"
    );
    expect(byId.get("activiteIndependanteAnterieure")?.pdfFieldName).toBe("non_3|oui_3");
  });

  it("les champs de précision (URL site, autre adresse, nom entreprise, description antérieure) sont masqués tant que la question parente n'a pas la bonne réponse", () => {
    const byId = new Map(C1C_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("siteInternetUrl")?.visibleIf).toEqual({
      fieldId: "possedeSiteInternet",
      op: "equals",
      value: "oui",
    });
    expect(byId.get("adresseActiviteLigne1")?.visibleIf).toEqual({
      fieldId: "lieuExerciceActivite",
      op: "equals",
      value: "autre",
    });
    expect(byId.get("nomEntreprise")?.visibleIf).toEqual({
      fieldId: "formeExerciceActivite",
      op: "equals",
      value: "societe",
    });
    expect(byId.get("descriptionActivitesAnterieures1")?.visibleIf).toEqual({
      fieldId: "activiteIndependanteAnterieure",
      op: "equals",
      value: "oui",
    });
  });

  it("applyC1CImprovements() est idempotent (pas de doublon si ré-appliqué)", () => {
    const once = applyC1CImprovements([]);
    const twice = applyC1CImprovements(once);
    expect(twice.length).toBe(once.length);
    expect(twice.length).toBe(C1C_FIELDS.length);
  });

  it("applyC1CImprovements() retire les anciens champs checkbox individuels désormais couverts par les radios fusionnés", () => {
    const rawInferred = [
      { id: "non", pdfFieldName: "non", type: "checkbox" as const, required: false, label: { fr: "non" } },
      { id: "oui_www", pdfFieldName: "oui www", type: "checkbox" as const, required: false, label: { fr: "oui: www" } },
      {
        id: "toggle_5",
        pdfFieldName: "toggle_5",
        type: "checkbox" as const,
        required: false,
        label: { fr: "personne physique" },
      },
      {
        id: "un_champ_non_touche",
        pdfFieldName: "un widget hors périmètre",
        type: "text" as const,
        required: false,
        label: { fr: "Non couvert par ce schéma" },
      },
    ];
    const result = applyC1CImprovements(rawInferred);
    const ids = result.map((f) => f.id);
    expect(ids).not.toContain("non");
    expect(ids).not.toContain("oui_www");
    expect(ids).not.toContain("toggle_5");
    // Un champ hors périmètre de ce schéma doit être préservé tel quel.
    expect(ids).toContain("un_champ_non_touche");
  });

  it("le nombre total de champs après application correspond au nombre de champs enrichis définis", () => {
    const fields = applyC1CImprovements([]);
    expect(fields.length).toBe(C1C_FIELDS.length);
    expect(fields.length).toBe(27);
  });
});
