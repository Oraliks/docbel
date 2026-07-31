import { describe, expect, it } from "vitest";
import {
  C1B_FIELDS,
  C1B_GROUPE_IDENTITE,
  C1B_QUESTIONS,
  applyC1BImprovements,
} from "../c1b-fields";

describe("C1B_FIELDS", () => {
  it("couvre l'identité, les 15 questions numérotées et la signature", () => {
    const ids = C1B_FIELDS.map((f) => f.id);
    expect(ids).toContain("niss");
    expect(ids).toContain("nom");
    expect(ids).toContain("pr_nom");
    expect(ids).toContain("droitPensionRetraiteComplete"); // Q1
    expect(ids).toContain("typePensionRetraiteComplete"); // Q2
    expect(ids).toContain("denominationPensionRetraiteComplete"); // Q3
    expect(ids).toContain("datePensionRetraiteComplete"); // Q4
    expect(ids).toContain("percoitPension"); // Q5
    expect(ids).toContain("typePensionPercue"); // Q6
    expect(ids).toContain("cumulPensionSurvieChomage"); // Q7 (cumul)
    expect(ids).toContain("cumulAnterieurMaladieChomagePrepension"); // Q7 (cumul antérieur)
    expect(ids).toContain("indemniteMaladieInvaliditeEtrangere"); // Q8
    expect(ids).toContain("montantIndemniteMaladieInvalidite"); // Q9
    expect(ids).toContain("indemniteAccidentTravailBelge"); // Q10
    expect(ids).toContain("natureIndemniteAccidentTravail"); // Q11
    expect(ids).toContain("indemniteAccidentTravailEtrangere"); // Q12
    expect(ids).toContain("congeSansSolde"); // Q13
    expect(ids).toContain("congeSansSoldeNomEmployeur"); // Q14
    expect(ids).toContain("congeSansSoldeAdresseEmployeur"); // Q14
    expect(ids).toContain("annexeDecisionsBelges"); // Q15
    expect(ids).toContain("signature");
  });

  it("les champs clés portent la bonne section", () => {
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("niss")?.section).toBe("identite");
    expect(byId.get("nom")?.section).toBe("identite");
    expect(byId.get("droitPensionRetraiteComplete")?.section).toBe("mes-revenus");
    expect(byId.get("percoitPension")?.section).toBe("mes-revenus");
    expect(byId.get("congeSansSolde")?.section).toBe("divers");
    expect(byId.get("annexeDecisionsBelges")?.section).toBe("annexes");
    expect(byId.get("signature")?.section).toBe("signature");
  });

  it("les questions oui/non pointent vers les vrais noms de widgets PDF (paires oui_N/non_N)", () => {
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("droitPensionRetraiteComplete")?.pdfFieldName).toBe("oui_2|non_2");
    expect(byId.get("percoitPension")?.pdfFieldName).toBe("oui|non");
    expect(byId.get("indemniteMaladieInvaliditeEtrangere")?.pdfFieldName).toBe("oui_3|non_5");
    expect(byId.get("indemniteAccidentTravailBelge")?.pdfFieldName).toBe("oui_5|non_7");
    expect(byId.get("indemniteAccidentTravailEtrangere")?.pdfFieldName).toBe("oui_6|non_8");
    expect(byId.get("congeSansSolde")?.pdfFieldName).toBe("oui_4|non_6");
  });

  it("le champ Q6 (type de pension perçue) fusionne les 4 checkboxes en un seul radio", () => {
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    const field = byId.get("typePensionPercue");
    expect(field?.pdfFieldName).toBe("une pens|une pens_2|une pens_3|une pens_4");
    expect(field?.options?.map((o) => o.value)).toEqual([
      "retraite-belge",
      "retraite-etrangere",
      "survie-etrangere",
      "survie-belge",
    ]);
  });

  it("le champ Q11 (nature de l'indemnité accident du travail) fusionne les 3 checkboxes i/i_2/i_3", () => {
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    const field = byId.get("natureIndemniteAccidentTravail");
    expect(field?.pdfFieldName).toBe("i|i_2|i_3");
    expect(field?.options?.length).toBe(3);
  });

  it("les sous-questions de Q1/Q6/Q7/Q13 sont masquées tant que la question parente n'est pas répondue", () => {
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("typePensionRetraiteComplete")?.visibleIf).toEqual({
      fieldId: "droitPensionRetraiteComplete",
      op: "equals",
      value: "oui",
    });
    expect(byId.get("cumulPensionSurvieChomage")?.visibleIf).toEqual({
      fieldId: "typePensionPercue",
      op: "equals",
      value: "survie-belge",
    });
    expect(byId.get("congeSansSoldeNomEmployeur")?.visibleIf).toEqual({
      fieldId: "congeSansSolde",
      op: "equals",
      value: "oui",
    });
  });

  it("les 4 annexes de la question 15 pointent chacune vers un widget checkbox distinct", () => {
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("annexeDecisionsBelges")?.pdfFieldName).toBe("déc");
    expect(byId.get("annexeDecisionsEtrangeres")?.pdfFieldName).toBe("déc_2");
    expect(byId.get("annexeCopiesPaiement")?.pdfFieldName).toBe("copies de paiement");
    expect(byId.get("annexeModele74")?.pdfFieldName).toBe(
      "une copie du modèle 74 ou 74bis PSS ou de la Déc"
    );
  });

  it("applyC1BImprovements() est idempotent (pas de doublon si ré-appliqué)", () => {
    const once = applyC1BImprovements([]);
    const twice = applyC1BImprovements(once);
    expect(twice.length).toBe(once.length);
    const ids = twice.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("applyC1BImprovements() retire tous les champs auto-inférés bruts et ne laisse aucun doublon", () => {
    // Reproduit un sous-ensemble représentatif de l'inférence automatique
    // (libellés laids typiques), y compris des champs texte génériques qui
    // seraient sinon en doublon avec leur version enrichie (ex. "undefined").
    const rawInferred = [
      { id: "oui", pdfFieldName: "oui", type: "checkbox" as const, required: false, label: { fr: "oui" } },
      { id: "non", pdfFieldName: "non", type: "checkbox" as const, required: false, label: { fr: "non" } },
      { id: "undefined", pdfFieldName: "undefined", type: "text" as const, required: false, label: { fr: "undefined" } },
      { id: "texte48", pdfFieldName: "Texte48", type: "text" as const, required: false, label: { fr: "Texte48" } },
      { id: "aujourd_hui", pdfFieldName: "AUJOURD'HUI", type: "text" as const, required: false, label: { fr: "AUJOURD'HUI" } },
    ];
    const improved = applyC1BImprovements(rawInferred);
    // Aucun des champs bruts d'origine ne doit survivre tel quel.
    for (const raw of rawInferred) {
      const survivor = improved.find((f) => f.id === raw.id);
      // Si un champ du même id existe encore, il doit être la version enrichie
      // (label différent de l'auto-inférence), jamais le doublon brut.
      if (survivor) {
        expect(survivor.label.fr).not.toBe(raw.label.fr);
      }
    }
    // Pas de doublon de pdfFieldName parmi les champs simples (hors radio pipe).
    const simpleNames = improved
      .map((f) => f.pdfFieldName)
      .filter((n) => n && !n.includes("|"));
    expect(new Set(simpleNames).size).toBe(simpleNames.length);
  });

  it("le nombre de champs après application sur le dump brut correspond au schéma enrichi attendu (37 champs)", () => {
    const improved = applyC1BImprovements([]);
    expect(improved.length).toBe(C1B_FIELDS.length);
    // 39 depuis le 2026-07-26 : `nomPage2` (doublon de l'en-tête page 2) a
    // quitté le schéma au profit de la règle serveur `bind:Nom`.
    // 37 depuis le 2026-07-31 : les lignes 2 et 3 de la dénomination et la
    // 2e ligne de « autre, à savoir » sont repliées dans leur textarea
    // (`lineTargets`), et le compte d'annexes est devenu un champ à part.
    expect(improved.length).toBe(37);
  });

  it("les six dates partagées sont écrites en positionnel, à six endroits distincts", () => {
    // `Date46_af_date` porte QUATRE widgets (Q4, Q7 « à partir du », et le
    // « du »/« au » d'une même période), `Date50_af_date` en porte DEUX (les
    // deux bornes du congé sans solde). Une seule valeur pour tous : les
    // remplir par leur nom sortait la même date partout — et trois des six
    // n'étaient même pas mappées, donc jamais imprimées.
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    const dates = [
      "datePensionRetraiteComplete",
      "dateEffetPensionSurvieBelge",
      "cumulAnterieurDateDebut",
      "cumulAnterieurDateFin",
      "congeSansSoldeDateDebut",
      "congeSansSoldeDateFin",
    ].map((id) => byId.get(id)!);

    for (const champ of dates) {
      expect(champ, "champ de date manquant").toBeDefined();
      expect(champ.pdfFieldName, `${champ.id} ne doit revendiquer aucun widget`).toBe("");
      expect(champ.drawAt, `${champ.id} doit être écrit en positionnel`).toBeDefined();
    }
    // Six emplacements DISTINCTS : c'est tout l'enjeu. Le « du » et le « au »
    // du congé sans solde sont sur la MÊME ligne imprimée, donc à la même
    // ordonnée — l'abscisse fait partie de l'identité d'une case.
    const places = dates.map((f) => `${f.drawAt!.page}:${f.drawAt!.x}:${f.drawAt!.y}`);
    expect(new Set(places).size).toBe(6);

    // Et plus personne ne revendique les deux champs AcroForm partagés.
    for (const partage of ["Date46_af_date", "Date50_af_date"]) {
      expect(
        C1B_FIELDS.filter((f) => f.pdfFieldName === partage),
        `${partage} ne doit plus être revendiqué par son nom`
      ).toHaveLength(0);
    }
  });

  it("le compte d'annexes vise le widget que la fin de période occupait à tort", () => {
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    // `Liste déroulante49` est posé sur « Je joins ...... annexe(s): »
    // (page 2, y=469), pas sur le « au » du congé sans solde (y=584) où le
    // schéma précédent écrivait une DATE.
    expect(byId.get("nombreAnnexes")?.pdfFieldName).toBe("Liste déroulante49");
    expect(byId.get("congeSansSoldeDateFin")?.pdfFieldName).toBe("");
  });

  it("chaque champ porte un stepGroup connu de l'ordre des étapes", () => {
    const groupes = new Set([C1B_GROUPE_IDENTITE, ...C1B_QUESTIONS]);
    for (const f of applyC1BImprovements([])) {
      expect(f.stepGroup, `champ « ${f.id} » sans étape`).toBeTruthy();
      expect(groupes, `champ « ${f.id} » dans un groupe hors ordre`).toContain(f.stepGroup);
    }
  });

  it("chaque question a pour ancre un champ de même identifiant", () => {
    const ids = new Set(C1B_FIELDS.map((f) => f.id));
    for (const q of C1B_QUESTIONS) expect(ids, `question « ${q} »`).toContain(q);
  });
});
