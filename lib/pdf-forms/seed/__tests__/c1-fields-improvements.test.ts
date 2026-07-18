import { describe, expect, it } from "vitest";
import { C1_QUESTIONS, C1_TRIGGERS, applyC1Improvements } from "../c1-fields-improvements";
import { evaluateTrigger } from "../../triggers";
import { isFieldVisible, validateStepFields } from "../../validation";

const ACTIVITY_REVENUE_IDS = [
  "etudesPleinExercice",
  "apprentissageAlternance",
  "formationStageSyntra",
  "mandatArtistique",
  "mandatPolitique",
  "chapitreXIIArts",
  "tremplinIndependants",
  "activiteAccessoireOuAide",
  "administrateurSociete",
  "independantAccessoireOuPrincipal",
  "pensionCategorieParticuliere",
  "pensionRetraiteSurvie",
  "indemniteMaladieInvalidite",
  "indemniteAccidentTravail",
  "avantageFinancierFormation",
] as const;

describe("C1_QUESTIONS — identité", () => {
  it("rend la commune obligatoire et bloque l'étape quand elle est vide", () => {
    const commune = C1_QUESTIONS.find((field) => field.id === "commune");
    expect(commune?.required).toBe(true);
    expect(commune && validateStepFields([commune], {}, "fr").commune).toBeTruthy();
  });
});

describe("C1_QUESTIONS — activités et revenus saisis par le citoyen", () => {
  it("affiche les 15 déclarations officielles avec Non modifiable par défaut", () => {
    expect(C1_QUESTIONS.find((f) => f.id === "aExerceActivite")).toBeUndefined();
    expect(C1_QUESTIONS.find((f) => f.id === "aAutresRevenus")).toBeUndefined();

    for (const id of ACTIVITY_REVENUE_IDS) {
      const field = C1_QUESTIONS.find((f) => f.id === id);
      expect(field, `champ ${id} introuvable`).toBeDefined();
      expect(field?.required, `${id} doit être répondu`).toBe(true);
      expect(field?.defaultValue, `${id} doit commencer à Non`).toBe("non");
      expect(
        ["aExerceActivite", "aAutresRevenus"],
        `${id} ne doit pas être masqué`,
      ).not.toContain(field?.visibleIf?.fieldId);
    }
  });

  it("conserve le Non par défaut dans le C1 changement de situation", () => {
    const restricted = applyC1Improvements([], {
      defaultMotif: "modification",
      restrictMotifTo5Situations: true,
    });
    for (const id of ACTIVITY_REVENUE_IDS) {
      expect(restricted.find((f) => f.id === id)?.defaultValue, id).toBe("non");
    }
  });

  it("exige une réponse explicite aux suivis déjà déclaré / première fois", () => {
    for (const id of [
      "mandatArtistiqueDejaDeclare",
      "tremplinIndependantsDejaDeclare",
      "activiteAccessoireDejaDeclare",
      "administrateurSocieteDejaDeclare",
      "independantAccessoireDejaDeclare",
      "pensionRetraiteDejaDeclare",
    ]) {
      const field = C1_QUESTIONS.find((item) => item.id === id);
      expect(field, id).toBeDefined();
      expect(field?.required, id).toBe(true);
      expect(field?.defaultValue, id).toBeUndefined();
      expect(field?.visibleIf?.value, id).toBe("oui");
    }
  });

  it("commence à Non pour le congé sans solde ou l'incapacité de 33 %", () => {
    for (const id of ["congeSansSolde", "incapacite33"]) {
      const field = C1_QUESTIONS.find((item) => item.id === id);
      expect(field?.required, id).toBe(true);
      expect(field?.defaultValue, id).toBe("non");
    }
  });
});

describe("C1_QUESTIONS — habiteEnColocation", () => {
  it("existe (radio oui/non) et n'est posée QUE pour l'isolé (Oraliks 2026-07-09)", () => {
    // 2026-07-09 : la question colocation ne concerne plus que la branche
    // « isolé » (cas cohousing : officiellement seul mais partage en pratique).
    // Pour la branche « cohabite », la colocation est captée en amont par
    // `cohabiteType`, qui rebascule vers isolé + coche habiteEnColocation=oui.
    const q = C1_QUESTIONS.find((f) => f.id === "habiteEnColocation");
    expect(q).toBeDefined();
    expect(q?.type).toBe("radio");
    expect(q?.visibleIf).toEqual({ fieldId: "statutFamilial", op: "equals", value: "isole" });
  });
});

describe("C1_QUESTIONS — cohabiteType (router colocation vs ménage commun)", () => {
  const q = C1_QUESTIONS.find((f) => f.id === "cohabiteType");

  it("existe, visible seulement si statutFamilial = cohabite, sans mapping PDF", () => {
    expect(q).toBeDefined();
    expect(q?.type).toBe("radio");
    expect(q?.pdfFieldName).toBe("");
    expect(q?.visibleIf).toEqual({ fieldId: "statutFamilial", op: "equals", value: "cohabite" });
    expect(q?.options?.map((o) => o.value)).toEqual(["menage-commun", "colocation"]);
  });

  it("bascule vers isolé + colocation via onSelectSet quand on choisit « colocation »", () => {
    expect(q?.onSelectSet).toEqual({
      whenValue: "colocation",
      set: [
        { fieldId: "statutFamilial", value: "isole" },
        { fieldId: "habiteEnColocation", value: "oui" },
      ],
    });
  });

  it("situationCohabitationAmbigue et la grille cohabitants ne s'ouvrent que pour le ménage commun", () => {
    const ambigue = C1_QUESTIONS.find((f) => f.id === "situationCohabitationAmbigue");
    const cohab = C1_QUESTIONS.find((f) => f.id === "cohabitants");
    expect(ambigue?.visibleIf).toEqual({ fieldId: "cohabiteType", op: "equals", value: "menage-commun" });
    expect(cohab?.visibleIf).toEqual({ fieldId: "cohabiteType", op: "equals", value: "menage-commun" });
  });
});

describe("C1_TRIGGERS — colocation → Annexe Regis", () => {
  it("déclenche c1-regis quand habiteEnColocation = oui", () => {
    const t = C1_TRIGGERS.find(
      (trig) => trig.whenFieldId === "habiteEnColocation" && trig.requiresFormSlug === "c1-regis",
    );
    expect(t).toBeDefined();
    expect(evaluateTrigger(t!, { habiteEnColocation: "oui" })).toBe(true);
    expect(evaluateTrigger(t!, { habiteEnColocation: "non" })).toBe(false);
  });

  it("le trigger existant 'situationCohabitationAmbigue' reste inchangé (autres cas ambigus)", () => {
    const t = C1_TRIGGERS.find((trig) => trig.whenFieldId === "situationCohabitationAmbigue");
    expect(t).toBeDefined();
    expect(t?.requiresFormSlug).toBe("c1-regis");
  });

  it("les 9 déclencheurs pré-existants sont toujours présents (aucun retiré)", () => {
    expect(C1_TRIGGERS.length).toBeGreaterThanOrEqual(10); // 9 existants + 1 nouveau
    const targets = C1_TRIGGERS.map((t) => t.requiresFormSlug);
    for (const slug of ["c1-partenaire", "c47", "c1-regis", "c46", "c1c", "c1a", "c1b"]) {
      expect(targets).toContain(slug);
    }
  });
});

describe("C1_TRIGGERS — Tremplin-indépendants → C1C", () => {
  const trigger = C1_TRIGGERS.find(
    (item) =>
      item.whenFieldId === "tremplinIndependants" && item.requiresFormSlug === "c1c",
  );

  it("ajoute le C1C pour une première déclaration Tremplin", () => {
    expect(trigger).toBeDefined();
    expect(
      evaluateTrigger(trigger!, {
        tremplinIndependants: "oui",
        tremplinIndependantsDejaDeclare: "non",
      }),
    ).toBe(true);
  });

  it("n'ajoute pas le C1C si la déclaration précédente reste inchangée", () => {
    expect(
      evaluateTrigger(trigger!, {
        tremplinIndependants: "oui",
        tremplinIndependantsDejaDeclare: "oui",
      }),
    ).toBe(false);
  });
});

describe("C1_QUESTIONS — dateModificationEffective", () => {
  it("existe, type date, visible seulement si motifIntroduction = modification", () => {
    const f = C1_QUESTIONS.find((q) => q.id === "dateModificationEffective");
    expect(f).toBeDefined();
    expect(f?.type).toBe("date");
    expect(f?.required).toBe(false);
    expect(f?.visibleIf).toEqual({ fieldId: "motifIntroduction", op: "equals", value: "modification" });
  });
});

describe("C1_QUESTIONS — dateChangementOrganisme aide enrichie", () => {
  it("mentionne que le délai dépend du type d'allocation en cours", () => {
    const f = C1_QUESTIONS.find((q) => q.id === "dateChangementOrganisme");
    expect(f?.help?.fr).toContain("type d'allocation");
  });
});

describe("applyC1Improvements — defaultMotif optionnel", () => {
  it("sans options, motifIntroduction n'a pas de defaultValue (comportement actuel inchangé)", () => {
    const result = applyC1Improvements([]);
    const motif = result.find((f) => f.id === "motifIntroduction");
    expect(motif).toBeDefined();
    expect(motif?.defaultValue).toBeUndefined();
  });

  it("avec defaultMotif, motifIntroduction porte la defaultValue fournie", () => {
    const result = applyC1Improvements([], { defaultMotif: "modification" });
    const motif = result.find((f) => f.id === "motifIntroduction");
    expect(motif?.defaultValue).toBe("modification");
  });

  it("C1_QUESTIONS partagé reste non muté après un appel avec defaultMotif", () => {
    applyC1Improvements([], { defaultMotif: "modification" });
    const motif = C1_QUESTIONS.find((f) => f.id === "motifIntroduction");
    expect(motif?.defaultValue).toBeUndefined();
  });
});

describe("C1_QUESTIONS — habillage renderAs / stepPriority", () => {
  it("motifIntroduction et les champs de modification sont renderAs=chip", () => {
    const chipIds = ["motifIntroduction", "modificationAdresse", "modificationCompte", "modificationSituationFamiliale", "modificationPermisSejour", "modificationCotisationSyndicale"];
    for (const id of chipIds) {
      const f = C1_QUESTIONS.find((q) => q.id === id);
      expect(f, `champ ${id} introuvable`).toBeDefined();
      expect(f?.renderAs, `champ ${id} devrait être renderAs=chip`).toBe("chip");
    }
  });

  it("toutes les sections activités/revenus/cotisation/non-UE/divers/annexes sont stepPriority=optional", () => {
    const optionalSectionKeys = ["mes-activites", "mes-revenus", "cotisation-syndicale", "non-eee", "divers", "annexes"];
    for (const key of optionalSectionKeys) {
      const fieldsInSection = C1_QUESTIONS.filter((q) => q.section === key);
      expect(fieldsInSection.length, `aucun champ trouvé pour la section ${key}`).toBeGreaterThan(0);
      for (const f of fieldsInSection) {
        expect(f.stepPriority, `champ ${f.id} (section ${key}) devrait être stepPriority=optional`).toBe("optional");
      }
    }
  });

  it("identite/demande/situation-familiale/mode-paiement/affirmations/signature restent stepPriority core (absent)", () => {
    const coreSectionKeys = ["identite", "demande", "situation-familiale", "mode-paiement", "affirmations", "signature"];
    for (const key of coreSectionKeys) {
      const fieldsInSection = C1_QUESTIONS.filter((q) => q.section === key);
      expect(fieldsInSection.length, `aucun champ trouvé pour la section ${key}`).toBeGreaterThan(0);
      for (const f of fieldsInSection) {
        expect(f.stepPriority, `champ ${f.id} (section ${key}) ne devrait PAS être optional`).not.toBe("optional");
      }
    }
  });

  it("chaque champ ayant un renderAs=chip conserve son pdfFieldName/visibleIf/section/order d'origine", () => {
    const expectations: Record<string, { pdfFieldName: string; section: string; order: number; visibleIf?: unknown }> = {
      motifIntroduction: {
        pdfFieldName:
          "PremièreFois|après une interruption de mes allocations 5|je déclare une modification concernant|je change dorganisme de paiement à partir du 5",
        section: "demande",
        order: 3,
      },
      modificationAdresse: {
        pdfFieldName: "mon adresse à partir du",
        section: "demande",
        order: 5,
        visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
      },
      modificationCompte: {
        pdfFieldName: "le mode de paiement de mes allocations ou mon numéro de compte6",
        section: "demande",
        order: 6,
        visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
      },
      modificationSituationFamiliale: {
        pdfFieldName: "ma situation personnelle ou celle des membres de mon ménage 7",
        section: "demande",
        order: 7,
        visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
      },
      modificationPermisSejour: {
        pdfFieldName: "mon permis de séjour ou mon permis de travail",
        section: "demande",
        order: 8,
        visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
      },
      modificationCotisationSyndicale: {
        pdfFieldName: "la retenue des cotisations syndicales",
        section: "demande",
        order: 9,
        visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
      },
    };
    for (const [id, expected] of Object.entries(expectations)) {
      const f = C1_QUESTIONS.find((q) => q.id === id);
      expect(f, `champ ${id} introuvable`).toBeDefined();
      expect(f?.pdfFieldName, `pdfFieldName de ${id} ne doit pas changer`).toBe(expected.pdfFieldName);
      expect(f?.section, `section de ${id} ne doit pas changer`).toBe(expected.section);
      expect(f?.order, `order de ${id} ne doit pas changer`).toBe(expected.order);
      if (expected.visibleIf) {
        expect(f?.visibleIf, `visibleIf de ${id} ne doit pas changer`).toEqual(expected.visibleIf);
      }
    }
  });
});

describe("applyC1Improvements — restrictMotifTo5Situations (Oraliks, 2026-07-06)", () => {
  it("absent (par défaut) : comportement inchangé, pas de 5e chip, cotisation syndicale toujours visible", () => {
    const result = applyC1Improvements([]);
    expect(result.find((f) => f.id === "transfereOrganismePaiement")).toBeUndefined();
    const cotisation = result.find((f) => f.id === "modificationCotisationSyndicale");
    expect(cotisation?.hidden).toBeFalsy();
    const adresse = result.find((f) => f.id === "modificationAdresse");
    expect(adresse?.label?.fr).toBe("Modification d'adresse");
  });

  it("actif : motifIntroduction garde ses 4 options ET son pdfFieldName pipe d'origine intacts", () => {
    // Invariant critique : le filler mappe options[i] <-> pdfFieldName.split('|')[i]
    // positionnellement (cf. filler-checkbox-pair.test.ts). Toucher ici casserait
    // le stamping PDF pour "première fois"/"interruption"/"modification"/"changement-op".
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const motif = result.find((f) => f.id === "motifIntroduction");
    expect(motif?.options).toHaveLength(4);
    expect(motif?.pdfFieldName).toBe(
      "PremièreFois|après une interruption de mes allocations 5|je déclare une modification concernant|je change dorganisme de paiement à partir du 5"
    );
  });

  it("actif : motifIntroduction devient autoAnswered (exclu du rendu interactif, reste requis/soumis)", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const motif = result.find((f) => f.id === "motifIntroduction");
    expect(motif?.autoAnswered).toBe(true);
    expect(motif?.required).toBe(true); // reste requis : le filler/validator le voient toujours
    expect(motif?.defaultValue).toBeUndefined(); // note: defaultMotif est un opt séparé, testé ailleurs
  });

  it("absent : motifIntroduction n'est PAS autoAnswered sans restriction de motif", () => {
    const result = applyC1Improvements([]);
    const motif = result.find((f) => f.id === "motifIntroduction");
    expect(motif?.autoAnswered).toBeFalsy();
  });

  it("actif : ajoute le 5e chip virtuel transfereOrganismePaiement (aucune case PDF propre)", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const f = result.find((q) => q.id === "transfereOrganismePaiement");
    expect(f).toBeDefined();
    expect(f?.pdfFieldName).toBe("");
    expect(f?.type).toBe("checkbox");
    expect(f?.required).toBe(false);
    expect(f?.renderAs).toBe("chip");
    expect(f?.section).toBe("demande");
    expect(f?.label?.fr).toBe("Je transfère mon dossier vers un autre organisme de paiement");
  });

  it("actif : masque modificationCotisationSyndicale (hors périmètre de ce dossier)", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const f = result.find((q) => q.id === "modificationCotisationSyndicale");
    expect(f?.hidden).toBe(true);
  });

  it("actif : relabelle et réordonne les 4 chips de modification restants selon le phrasé Oraliks", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const expected: Record<string, { label: string; order: number }> = {
      modificationAdresse: { label: "J'ai changé d'adresse", order: 5 },
      modificationSituationFamiliale: {
        label: "Ma situation personnelle ou celle des membres de mon ménage a changé",
        order: 6,
      },
      modificationPermisSejour: { label: "Mon permis de séjour ou mon permis de travail a changé", order: 7 },
      modificationCompte: { label: "Mon n° de compte bancaire a changé", order: 8 },
    };
    for (const [id, exp] of Object.entries(expected)) {
      const f = result.find((q) => q.id === id);
      expect(f?.label?.fr, `label de ${id}`).toBe(exp.label);
      expect(f?.order, `order de ${id}`).toBe(exp.order);
    }
  });

  it("actif : les 4 chips de modification perdent leur visibleIf sur motifIntroduction (bug Oraliks 2026-07-07)", () => {
    // motifIntroduction est autoAnswered -> absent du schéma Zod scindé par
    // étape (validateStepFields) ; garder ce visibleIf faisait passer ces
    // 4 champs pour "invisibles" en validation d'étape, laissant SEULE
    // transfereOrganismePaiement pouvoir satisfaire le requiredGroup et
    // bloquant à tort l'avancée même quand un autre motif était coché.
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    for (const id of [
      "modificationAdresse",
      "modificationSituationFamiliale",
      "modificationPermisSejour",
      "modificationCompte",
    ]) {
      expect(result.find((q) => q.id === id)?.visibleIf, id).toBeUndefined();
    }
  });

  it("actif : dateChangementOrganisme se déclenche sur transfereOrganismePaiement, plus sur motifIntroduction", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const f = result.find((q) => q.id === "dateChangementOrganisme");
    expect(f?.visibleIf).toEqual({ fieldId: "transfereOrganismePaiement", op: "equals", value: true });
  });

  it("actif : dateChangementOrganisme porte le libellé contextualisé au transfert", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const f = result.find((q) => q.id === "dateChangementOrganisme");
    expect(f?.label?.fr).toBe("Transférer mon dossier à partir du");
  });

  it("actif : les 5 chips situation partagent la même clé requiredGroup (au moins une obligatoire)", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const ids = [
      "modificationAdresse",
      "modificationSituationFamiliale",
      "modificationPermisSejour",
      "modificationCompte",
      "transfereOrganismePaiement",
    ];
    const groups = ids.map((id) => result.find((q) => q.id === id)?.requiredGroup);
    expect(groups.every((g) => g === "motifSituation")).toBe(true);
  });

  it("actif : l'ancre (modificationAdresse, 1ʳᵉ des 5) porte un message d'erreur explicite", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const anchor = result.find((q) => q.id === "modificationAdresse");
    expect(anchor?.errorMsg?.fr).toBeTruthy();
  });

  it("absent : les 5 chips n'ont PAS de requiredGroup sans restriction de motif", () => {
    const result = applyC1Improvements([]);
    for (const id of ["modificationAdresse", "modificationSituationFamiliale", "modificationPermisSejour", "modificationCompte"]) {
      expect(result.find((q) => q.id === id)?.requiredGroup).toBeUndefined();
    }
    expect(result.find((q) => q.id === "transfereOrganismePaiement")).toBeUndefined();
  });

  it("actif : chomeurTemporaireAlternance est masquée (retirée du form runner pour ce dossier — Oraliks 2026-07-10)", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const f = result.find((q) => q.id === "chomeurTemporaireAlternance");
    expect(f?.hidden).toBe(true);
  });

  it("actif : adapte les libellés du panneau bancaire sans changer les valeurs", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const mode = result.find((field) => field.id === "modePaiement");
    const titulaire = result.find((field) => field.id === "titulaireCompte");
    expect(mode?.label.fr).toBe("Réception des allocations");
    expect(mode?.options?.map((option) => [option.value, option.label.fr])).toEqual([
      ["virement", "Virement bancaire"],
      ["cheque", "Chèque circulaire envoyé à mon adresse"],
    ]);
    expect(titulaire?.label.fr).toBe("Titulaire du compte");
    expect(titulaire?.options?.map((option) => option.value)).toEqual(["mon-nom", "autre-nom"]);
  });

  it("le BIC n'est requis que pour un IBAN étranger ET en mode virement (masqué sur chèque)", () => {
    const bic = C1_QUESTIONS.find((field) => field.id === "bic");
    expect(bic?.visibleIf).toEqual({
      fieldId: "iban",
      op: "matchesRegex",
      value: "^(?![Bb][Ee])[A-Za-z]{2}",
      and: [{ fieldId: "modePaiement", op: "equals", value: "virement" }],
    });
    const foreignIban = "FR7630001007941234567890185";
    // Virement + IBAN étranger → BIC visible.
    expect(isFieldVisible(bic?.visibleIf, { iban: foreignIban, modePaiement: "virement" })).toBe(true);
    // L'usager avait saisi un IBAN étranger PUIS basculé sur « chèque » : la
    // valeur IBAN persiste mais le BIC doit disparaître (plus de blocage).
    expect(isFieldVisible(bic?.visibleIf, { iban: foreignIban, modePaiement: "cheque" })).toBe(false);
  });

  it("la confirmation « chèque circulaire » porte le libellé validé par Oraliks", () => {
    const warning = C1_QUESTIONS.find((field) => field.id === "modePaiementChequeWarning");
    expect(warning?.label.fr).toBe(
      "Je confirme avoir compris que le chèque circulaire est rare et plus lent à la réception. Celui-ci sera envoyé à l'adresse mentionnée sur le formulaire C1.",
    );
    // Requise, mais uniquement quand le mode « chèque » est choisi.
    expect(warning?.required).toBe(true);
    expect(warning?.visibleIf).toEqual({ fieldId: "modePaiement", op: "equals", value: "cheque" });
  });

  it("absent : chomeurTemporaireAlternance garde son libellé d'origine sans restriction", () => {
    const result = applyC1Improvements([]);
    const f = result.find((q) => q.id === "chomeurTemporaireAlternance");
    expect(f?.label?.fr).toBe("… comme chômeur temporaire suivant une formation en alternance");
  });

  it("actif : la date de changement est obligatoire et validable dans l'étape Motif", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const f = result.find((q) => q.id === "dateModificationEffective");
    expect(f?.label?.fr).toBe("Date de changement");
    expect(f?.help?.fr).toContain("Date de la demande");
    expect(f?.required).toBe(true);
    // motifIntroduction est autoAnswered et absent du schéma Zod scindé
    // par étape : la date doit donc être inconditionnelle dans ce parcours.
    expect(f?.visibleIf).toBeUndefined();
    expect(f && validateStepFields([f], {}, "fr").dateModificationEffective).toBeTruthy();
  });

  it("actif : C1_QUESTIONS partagé reste non muté (labels/visibleIf/hidden d'origine intacts)", () => {
    applyC1Improvements([], { restrictMotifTo5Situations: true });
    const adresse = C1_QUESTIONS.find((q) => q.id === "modificationAdresse");
    expect(adresse?.label?.fr).toBe("Modification d'adresse");
    expect(adresse?.order).toBe(5);
    const cotisation = C1_QUESTIONS.find((q) => q.id === "modificationCotisationSyndicale");
    expect(cotisation?.hidden).toBeFalsy();
    const dateChangement = C1_QUESTIONS.find((q) => q.id === "dateChangementOrganisme");
    expect(dateChangement?.visibleIf).toEqual({ fieldId: "motifIntroduction", op: "equals", value: "changement-op" });
    expect(C1_QUESTIONS.find((q) => q.id === "transfereOrganismePaiement")).toBeUndefined();
  });

  it("délègue la remarque de situation familiale au binding serveur", () => {
    expect(C1_QUESTIONS.find((field) => field.id === "remarqueSituationFamiliale")?.pdfFieldName).toBe("");
  });
});
