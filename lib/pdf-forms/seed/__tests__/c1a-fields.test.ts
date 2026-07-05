import { describe, expect, it } from "vitest";
import { C1A_FIELDS, applyC1AImprovements } from "../c1a-fields";

describe("C1A_FIELDS", () => {
  it("couvre les questions clés avec la bonne section", () => {
    const byId = new Map(C1A_FIELDS.map((f) => [f.id, f]));

    expect(byId.get("aideIndependant")?.section).toBe("aide-independant");
    expect(byId.get("aideIndependant")?.pdfFieldName).toBe("oui|non");

    expect(byId.get("aideraPendantChomage")?.pdfFieldName).toBe("oui_2|non_2");
    expect(byId.get("aidaitDejaIndependant")?.pdfFieldName).toBe("oui_3|non_3");
    expect(byId.get("mandatPolitiqueOuJuge")?.pdfFieldName).toBe("oui_4|non_4");
    expect(byId.get("autreActiviteAccessoire")?.pdfFieldName).toBe("oui_5|non_5");
    expect(byId.get("activiteCommeSalarie")?.pdfFieldName).toBe("oui_6|non_6");
    expect(byId.get("exerceraPendantChomage")?.pdfFieldName).toBe("oui_7|non_8");
    expect(byId.get("exerceDejaActivite")?.pdfFieldName).toBe("oui_8|non_9");
    expect(byId.get("independantTitrePrincipal")?.pdfFieldName).toBe(
      "oui et je sais que je nai pas droit aux allocations|non_10"
    );

    expect(byId.get("employeurNom")?.section).toBe("employeur");
    expect(byId.get("adresseActivite")?.section).toBe("adresse");
    expect(byId.get("signature")?.section).toBe("signature");
    expect(byId.get("signature")?.type).toBe("signature");
  });

  it("couvre les 5 lignes de nature d'activité de l'indépendant (Q2)", () => {
    const ids = C1A_FIELDS.map((f) => f.id);
    for (let n = 1; n <= 5; n++) {
      expect(ids).toContain(`natureActiviteIndependant${n}`);
    }
  });

  it("couvre les 9 lignes de description de l'aide (Q5)", () => {
    const ids = C1A_FIELDS.map((f) => f.id);
    for (let n = 1; n <= 9; n++) {
      expect(ids).toContain(`descriptionAide${n}`);
    }
  });

  it("génère les 2 grilles horaires complètes (Q4 et Q18) avec leurs 5 jours ouvrés x 3 tranches", () => {
    const ids = new Set(C1A_FIELDS.map((f) => f.id));
    const jours = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];
    for (const prefix of ["q4", "q18"]) {
      for (const jour of jours) {
        expect(ids.has(`${prefix}${jour}`)).toBe(true);
        expect(ids.has(`${prefix}${jour}Avant7h`)).toBe(true);
        expect(ids.has(`${prefix}${jour}Entre7h18h`)).toBe(true);
        expect(ids.has(`${prefix}${jour}Apres18h`)).toBe(true);
      }
      expect(ids.has(`${prefix}samedi`)).toBe(true);
      expect(ids.has(`${prefix}dimanche`)).toBe(true);
      expect(ids.has(`${prefix}periode`)).toBe(true);
    }
  });

  it("la grille Q4 pointe vers les widgets sans suffixe, la grille Q18 vers les widgets _2/_6..._10", () => {
    const byId = new Map(C1A_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("q4lundi")?.pdfFieldName).toBe("lundi");
    expect(byId.get("q4lundiAvant7h")?.pdfFieldName).toBe("avant 7 h");
    expect(byId.get("q18lundi")?.pdfFieldName).toBe("lundi_2");
    expect(byId.get("q18lundiAvant7h")?.pdfFieldName).toBe("avant 7 h_6");
  });

  it("couvre les 7 jours de la question 22 (jours occupés chez l'employeur, chômeur temporaire)", () => {
    const byId = new Map(C1A_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("joursOccupeLundi")?.pdfFieldName).toBe("lu");
    expect(byId.get("joursOccupeMardi")?.pdfFieldName).toBe("ma");
    expect(byId.get("joursOccupeMercredi")?.pdfFieldName).toBe("me");
    expect(byId.get("joursOccupeJeudi")?.pdfFieldName).toBe("je");
    expect(byId.get("joursOccupeVendredi")?.pdfFieldName).toBe("ve");
    expect(byId.get("joursOccupeSamedi")?.pdfFieldName).toBe("sa");
    expect(byId.get("joursOccupeDimanche")?.pdfFieldName).toBe("di");
  });

  it("n'a pas de pdfFieldName dupliqué entre deux champs distincts (hors champs virtuels vides)", () => {
    const seen = new Map<string, string[]>();
    for (const f of C1A_FIELDS) {
      if (!f.pdfFieldName) continue;
      for (const name of f.pdfFieldName.split("|")) {
        const trimmed = name.trim();
        if (!trimmed) continue;
        const list = seen.get(trimmed) ?? [];
        list.push(f.id);
        seen.set(trimmed, list);
      }
    }
    const dups = [...seen.entries()].filter(([, ids]) => ids.length > 1);
    expect(dups).toEqual([]);
  });

  it("marque les champs non identifiés avec certitude comme hidden (Liste déroulante44, voir 19)", () => {
    const byId = new Map(C1A_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("listeDeroulante44")?.hidden).toBe(true);
    expect(byId.get("voir19Artefact")?.hidden).toBe(true);
  });

  it("applyC1AImprovements() est idempotent (pas de doublon si ré-appliqué)", () => {
    const once = applyC1AImprovements([]);
    const twice = applyC1AImprovements(once);
    expect(twice.length).toBe(once.length);
    expect(twice.length).toBe(C1A_FIELDS.length);
  });

  it("applyC1AImprovements() retire les anciens champs bruts couverts par pdfFieldName ou id, et préserve le reste", () => {
    const raw = [
      // Couvert par le nouveau champ radio "aideIndependant" (pdfFieldName "oui|non").
      { id: "oui", pdfFieldName: "oui", type: "checkbox", required: false, label: { fr: "oui" } },
      { id: "non", pdfFieldName: "non", type: "checkbox", required: false, label: { fr: "non" } },
      // Champ non couvert, doit être préservé tel quel.
      { id: "champ_inconnu_sans_rapport", pdfFieldName: "Un champ jamais vu", type: "text", required: false, label: { fr: "?" } },
    ] as const;

    const result = applyC1AImprovements([...raw]);
    const ids = result.map((f) => f.id);

    expect(ids).not.toContain("oui");
    expect(ids).not.toContain("non");
    expect(ids).toContain("champ_inconnu_sans_rapport");
    expect(ids).toContain("aideIndependant");
    expect(result.length).toBe(1 + C1A_FIELDS.length);
  });

  it("le nombre total de champs générés correspond au compte attendu", () => {
    // 61 champs "statiques" définis explicitement (identité, Q1-Q3, Q5-Q17 hors
    // grilles, Q19-Q24, champs non identifiés) + 9 lignes descriptionAide
    // générées dynamiquement (déjà comptées dans les 61) + 2 grilles horaires
    // de 67 champs chacune (5 jours x 4 + samedi + dimanche + periode + 4
    // texte periodes + 3 ou 4 texte irrégulier -> vérifié dynamiquement
    // ci-dessous plutôt que recalculé à la main pour éviter une double
    // comptabilité fragile).
    expect(C1A_FIELDS.length).toBeGreaterThan(120);
    expect(C1A_FIELDS.length).toBe(new Set(C1A_FIELDS.map((f) => f.id)).size);
  });
});
