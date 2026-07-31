import { describe, expect, it } from "vitest";
import {
  C1B_FIELDS,
  C1B_GROUPE_IDENTITE,
  C1B_QUESTIONS,
  applyC1BImprovements,
} from "../c1b-fields";
import { countRequirements, validateStepFields } from "../../validation";

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

// ===========================================================================
// Q15 — « COMPLETEZ TOUJOURS CETTE RUBRIQUE »
// ===========================================================================
//
// Le titre imprimé n'admet aucun chemin qui saute la rubrique : on pouvait
// pourtant signer un C1B sans déclarer la moindre annexe, alors que chaque
// branche « oui » des quatorze questions précédentes en réclame une (décision
// d'octroi, copie de paiement, modèle 74…). Ces tests font tourner le VRAI
// validateur, pas une relecture du schéma : c'est lui qui bloque « Continuer »
// côté écran et qui refuse la soumission côté serveur.
describe("C1B Q15 — au moins une annexe", () => {
  const CASES_ANNEXES = [
    "annexeDecisionsBelges",
    "annexeDecisionsEtrangeres",
    "annexeCopiesPaiement",
    "annexeModele74",
    "annexeAutre",
  ] as const;

  /// Les champs de l'étape Q15, tels que `buildMacroSteps` les groupe.
  const etapeQ15 = () =>
    applyC1BImprovements([]).filter((f) => f.stepGroup === "nombreAnnexes");

  it("les cinq cases partagent une même clé de groupe, et aucune n'est requise seule", () => {
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    const cles = CASES_ANNEXES.map((id) => byId.get(id)?.requiredGroup);
    expect(new Set(cles).size, `clés trouvées : ${JSON.stringify(cles)}`).toBe(1);
    expect(cles[0]).toBeTruthy();
    // Rendre obligatoire une case plutôt que sa voisine n'aurait aucun sens :
    // rien ne dit qu'un dossier comporte une décision belge PLUTÔT
    // qu'étrangère. C'est le choix qui commande la rubrique qui est exigé.
    for (const id of CASES_ANNEXES) expect(byId.get(id)?.required, id).toBe(false);
  });

  it("le validateur refuse l'étape tant qu'aucune case n'est cochée", () => {
    const erreurs = validateStepFields(etapeQ15(), { nombreAnnexes: "1" }, "fr");
    // L'erreur s'attache à la PREMIÈRE case du groupe (cf. `buildValidator`).
    expect(erreurs.annexeDecisionsBelges).toBeTruthy();
  });

  it("une seule case cochée suffit — n'importe laquelle des cinq", () => {
    for (const id of CASES_ANNEXES) {
      const payload: Record<string, unknown> = { nombreAnnexes: "1", [id]: true };
      // « autre » ouvre une ligne « à savoir : … » qu'il faut alors renseigner.
      if (id === "annexeAutre") payload.annexeAutreDescription = "Attestation de la caisse";
      const erreurs = validateStepFields(etapeQ15(), payload, "fr");
      expect(erreurs, `case « ${id} »`).toEqual({});
    }
  });

  it("« autre » sans dire quoi ne passe pas : le papier demande « à savoir : … »", () => {
    const erreurs = validateStepFields(
      etapeQ15(),
      { nombreAnnexes: "1", annexeAutre: true },
      "fr",
    );
    expect(erreurs.annexeAutreDescription).toBeTruthy();
  });

  it("le compte d'annexes est exigé, et ne peut pas valoir zéro", () => {
    const coche = { annexeCopiesPaiement: true };
    expect(validateStepFields(etapeQ15(), coche, "fr").nombreAnnexes).toBeTruthy();
    expect(
      validateStepFields(etapeQ15(), { ...coche, nombreAnnexes: "0" }, "fr").nombreAnnexes,
    ).toBeTruthy();
    expect(validateStepFields(etapeQ15(), { ...coche, nombreAnnexes: "2" }, "fr")).toEqual({});
  });

  it("l'étape se compte comme UNE exigence de groupe, pas cinq", () => {
    // Le compteur du stepper doit dire la même chose que le bouton
    // « Continuer », sinon l'étape s'affiche verte pendant qu'il refuse.
    const avant = countRequirements(etapeQ15(), { nombreAnnexes: "1" }, "fr");
    expect(avant.missing).toBe(1);
    const apres = countRequirements(
      etapeQ15(),
      { nombreAnnexes: "1", annexeModele74: true },
      "fr",
    );
    expect(apres.missing).toBe(0);
  });

  it("les cases ne sont PAS des chips : le rendu reste une liste, pas le tableau du C1", () => {
    // Le form-runner bascule une section entière sur `MotifSituationPicker`
    // quand elle contient un champ à la fois `requiredGroup` ET
    // `renderAs: "chip"` — le moule des cinq situations du C1. Les annexes du
    // C1B partagent la contrainte de validation, pas le rendu : sans ce test,
    // un `renderAs: "chip"` ajouté ici transformerait la rubrique en tableau
    // de situations sans qu'aucune autre vérification ne s'en aperçoive.
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    for (const id of CASES_ANNEXES) expect(byId.get(id)?.renderAs, id).toBeUndefined();
  });
});
