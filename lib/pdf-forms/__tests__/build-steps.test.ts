import { describe, expect, it } from "vitest";
import { buildSteps, buildMacroSteps } from "../build-steps";
import { getFormPresentation, stepAnchorField } from "../form-presentation";
import type { PublicField } from "../public-serializer";
import type { FormPayload } from "../types";
import { applyC1AImprovements } from "../seed/c1a-fields";

const LABELS = { fallbackTitle: "Informations", fallbackSubtitle: "Complétez les champs" };

function field(overrides: Partial<PublicField> & { id: string }): PublicField {
  return {
    type: "text",
    required: false,
    label: { fr: overrides.id },
    ...overrides,
  } as PublicField;
}

describe("buildSteps — comportement inchangé sans stepPriority (rétrocompatibilité)", () => {
  it("toutes les sections deviennent des core steps, comme aujourd'hui", () => {
    const fields = [
      field({ id: "a", section: "identite" }),
      field({ id: "b", section: "adresse" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps).toHaveLength(2);
    expect(result.coreSteps[0].id).toBe("identite");
    expect(result.coreSteps[1].id).toBe("adresse");
    expect(result.optionalSections).toHaveLength(0);
  });

  it("regroupe globalement par section (pas seulement les champs consécutifs)", () => {
    const fields = [
      field({ id: "a", section: "identite" }),
      field({ id: "b", section: "adresse" }),
      field({ id: "c", section: "identite" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps).toHaveLength(2);
    expect(result.coreSteps[0].fields.map((f) => f.id)).toEqual(["a", "c"]);
  });

  it("un champ sans section utilise le titre/sous-titre de repli", () => {
    const fields = [field({ id: "a" })];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps[0].title).toBe("Informations");
  });
});

describe("buildSteps — sections optionnelles", () => {
  it("une section stepPriority=optional ne devient pas un core step", () => {
    const fields = [
      field({ id: "a", section: "identite" }),
      field({ id: "b", section: "mes-activites", stepPriority: "optional" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps).toHaveLength(1);
    expect(result.coreSteps[0].id).toBe("identite");
    expect(result.optionalSections).toHaveLength(1);
    expect(result.optionalSections[0].key).toBe("mes-activites");
  });

  it("une section optionnelle SANS réponse est repliée par défaut", () => {
    const fields = [field({ id: "b", section: "mes-activites", stepPriority: "optional" })];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.optionalSections[0].defaultOpen).toBe(false);
  });

  it("une section optionnelle AVEC une valeur déjà répondue est dépliée par défaut", () => {
    const fields = [field({ id: "b", section: "mes-activites", stepPriority: "optional" })];
    const result = buildSteps(fields, { b: "oui" }, "fr", LABELS);
    expect(result.optionalSections[0].defaultOpen).toBe(true);
  });

  it("mélange core + optional : l'ordre des core steps ne compte pas les sections optionnelles", () => {
    const fields = [
      field({ id: "a", section: "identite" }),
      field({ id: "b", section: "mes-activites", stepPriority: "optional" }),
      field({ id: "c", section: "adresse" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps.map((s) => s.id)).toEqual(["identite", "adresse"]);
    expect(result.optionalSections.map((s) => s.key)).toEqual(["mes-activites"]);
  });
});

describe("buildSteps — champs invisibles et auto-champs exclus", () => {
  it("un champ dont visibleIf n'est pas satisfait n'apparaît dans aucun step", () => {
    const fields = [
      field({ id: "a", section: "demande" }),
      field({ id: "b", section: "demande", visibleIf: { fieldId: "a", op: "equals", value: "oui" } }),
    ];
    const result = buildSteps(fields, { a: "non" }, "fr", LABELS);
    expect(result.coreSteps[0].fields.map((f) => f.id)).toEqual(["a"]);
  });

  it("un champ signature est exclu des steps (auto-rempli)", () => {
    const fields = [
      field({ id: "name", section: "demande" }),
      field({ id: "sig", section: "demande", type: "signature" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps[0].fields.map((f) => f.id)).toEqual(["name"]);
  });

  it("un champ avec prefillFrom=system.today est exclu des steps (date de création auto-injectée)", () => {
    const fields = [
      field({ id: "name", section: "demande" }),
      field({ id: "created_at", section: "demande", type: "text", prefillFrom: "system.today" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps[0].fields.map((f) => f.id)).toEqual(["name"]);
  });

  it("un champ signature détecté au label est exclu (rétrocompatibilité)", () => {
    const fields = [
      field({ id: "name", section: "demande" }),
      field({ id: "sig", section: "demande", type: "text", label: { fr: "Signature numérique" } }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps[0].fields.map((f) => f.id)).toEqual(["name"]);
  });

  it("un champ date créée détecté au label est exclu (rétrocompatibilité)", () => {
    const fields = [
      field({ id: "name", section: "demande" }),
      field({ id: "date_doc", section: "demande", type: "text", label: { fr: "Date de création" } }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps[0].fields.map((f) => f.id)).toEqual(["name"]);
  });
});

describe("buildMacroSteps — regroupement en macro-étapes (mode opt-in)", () => {
  it("renvoie null si aucun champ n'a de stepGroup (formulaire non-macro)", () => {
    const fields = [field({ id: "a", section: "identite" }), field({ id: "b", section: "adresse" })];
    expect(buildMacroSteps(fields, {})).toBeNull();
  });

  it("ordonne selon l'ordre canonique du formulaire, pas l'ordre des champs du PDF", () => {
    // Champs dans l'ordre PDF : identité d'abord, motif ensuite — l'ordre du
    // parcours doit rester Motif → Identité → Activités&revenus → Famille.
    // L'ordre n'est plus codé en dur dans build-steps : il vient de
    // `form-presentation.ts`, ce qui rend la fonction utilisable par un autre
    // formulaire à macro-étapes.
    const ordreDuC1 = getFormPresentation("c1-changement-situation").stepGroupOrder ?? [];
    const fields = [
      field({ id: "i1", section: "identite", stepGroup: "identite" }),
      field({ id: "m", section: "demande", stepGroup: "motif" }),
      field({ id: "f", section: "situation-familiale", stepGroup: "famille" }),
      field({ id: "a", section: "mes-activites", stepGroup: "activites-revenus" }),
    ];
    const steps = buildMacroSteps(fields, {}, ordreDuC1);
    expect(steps).not.toBeNull();
    expect(steps!.map((s) => s.id)).toEqual(["motif", "identite", "activites-revenus", "famille"]);
  });

  it("sous-groupe par section à l'intérieur d'une macro-étape (sous-titres)", () => {
    const fields = [
      field({ id: "i1", section: "identite", stepGroup: "identite" }),
      field({ id: "p1", section: "mode-paiement", stepGroup: "identite" }),
      field({ id: "i2", section: "identite", stepGroup: "identite" }),
    ];
    const steps = buildMacroSteps(fields, {})!;
    const identite = steps.find((s) => s.id === "identite")!;
    expect(identite.sections.map((sec) => sec.key)).toEqual(["identite", "mode-paiement"]);
    expect(identite.sections[0].fields.map((f) => f.id)).toEqual(["i1", "i2"]);
  });

  it("rattache les champs SANS stepGroup à la dernière macro-étape (advanced)", () => {
    const fields = [
      field({ id: "m", section: "demande", stepGroup: "motif" }),
      field({ id: "final1", section: "divers", stepGroup: "final" }),
      field({ id: "raw1" }),
      field({ id: "raw2", section: undefined }),
    ];
    const steps = buildMacroSteps(fields, {})!;
    expect(steps.map((s) => s.id)).toEqual(["motif", "final"]);
    expect(steps[0].advanced).toEqual([]);
    expect(steps[1].advanced.map((f) => f.id)).toEqual(["raw1", "raw2"]);
  });

  it("exclut les champs invisibles (visibleIf non satisfait) et auto (signature)", () => {
    const fields = [
      field({ id: "m", section: "demande", stepGroup: "motif" }),
      field({ id: "gated", section: "divers", stepGroup: "final", visibleIf: { fieldId: "m", op: "equals", value: "x" } }),
      field({ id: "sig", type: "signature", section: "signature", stepGroup: "final" }),
    ];
    const steps = buildMacroSteps(fields, {})!;
    // "gated" caché (m != x) et "sig" auto → seul "motif" reste, pas de "final".
    expect(steps.map((s) => s.id)).toEqual(["motif"]);
  });
});

describe("buildMacroSteps — formulaire non enregistré", () => {
  it("retombe sur l'ordre de première apparition, sans ordre canonique", () => {
    // Comportement de repli : un formulaire à macro-étapes qui n'a pas encore
    // d'entrée dans `form-presentation.ts` reste utilisable — ses étapes
    // suivent simplement l'ordre de ses champs.
    const fields = [
      field({ id: "b", section: "identite", stepGroup: "deuxieme" }),
      field({ id: "a", section: "demande", stepGroup: "premier" }),
    ];
    expect(buildMacroSteps(fields, {})!.map((s) => s.id)).toEqual(["deuxieme", "premier"]);
  });
});

describe("C1A — une question, une étape", () => {
  // Mêmes champs que ceux servis au runner : `toPublicForm` écarte les champs
  // `hidden` et TRIE par `order` — l'ordre de déclaration du seed n'est pas
  // celui de l'écran (le NISS est imprimé au-dessus du nom, order -100 / -99).
  const CHAMPS = applyC1AImprovements([])
    .filter((f) => !f.hidden)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) as unknown as PublicField[];
  const ORDRE = getFormPresentation("c1a").stepGroupOrder ?? [];

  const etapes = (values: FormPayload) => buildMacroSteps(CHAMPS, values, ORDRE) ?? [];

  /// Toutes les questions d'aiguillage à « non » : le parcours le plus court.
  const TOUT_NON: FormPayload = {
    aideIndependant: "non",
    mandatPolitiqueOuJuge: "non",
    autreActiviteAccessoire: "non",
    estChomeurTemporaire: "non",
  };

  /// Toutes à « oui » : le parcours le plus long, aucune question sautée.
  const TOUT_OUI: FormPayload = {
    aideIndependant: "oui",
    aideraPendantChomage: "oui",
    aidaitDejaIndependant: "oui",
    mandatPolitiqueOuJuge: "oui",
    autreActiviteAccessoire: "oui",
    activiteCommeSalarie: "oui",
    exerceraPendantChomage: "oui",
    exerceDejaActivite: "oui",
    estChomeurTemporaire: "oui",
  };

  it("le parcours le plus court tient en sept écrans", () => {
    // Sept questions posées à tout le monde : l'identité (seul bloc sans
    // numéro), les trois aiguillages, la consigne « chômeur temporaire », et
    // les deux rubriques « COMPLÉTEZ TOUJOURS » (Q23, Q24). Tout le reste est
    // sauté par l'arbre et ne produit AUCUNE étape — pas une étape vide.
    expect(etapes(TOUT_NON).map((s) => s.id)).toEqual([
      "identite",
      "aideIndependant", // Q1
      "mandatPolitiqueOuJuge", // Q9
      "autreActiviteAccessoire", // Q12
      "estChomeurTemporaire", // Q22
      "independantTitrePrincipal", // Q23
      "affirmationSincerite", // Q24
    ]);
  });

  it("le parcours le plus long pose les vingt-quatre questions, dans l'ordre du document", () => {
    expect(etapes(TOUT_OUI).map((s) => s.id)).toEqual([
      "identite",
      "aideIndependant", // Q1
      "independantNom", // Q2
      "aideraPendantChomage", // Q3
      "q4periode", // Q4
      "descriptionAide1", // Q5
      "montantAidePeriodicite", // Q6
      "aidaitDejaIndependant", // Q7
      "dateDebutAide", // Q8
      "mandatPolitiqueOuJuge", // Q9
      "mandatDescription", // Q10
      "revenuAnnuelMandat", // Q11
      "autreActiviteAccessoire", // Q12
      "activiteCommeSalarie", // Q13
      "employeurNom", // Q14
      "adresseActivite", // Q15
      "formeActivite", // Q16
      "exerceraPendantChomage", // Q17
      "q18periode", // Q18
      "revenuNetSalarieParMois", // Q19
      "exerceDejaActivite", // Q20
      "dateDebutActivite", // Q21
      "estChomeurTemporaire", // Q22
      "independantTitrePrincipal", // Q23
      "affirmationSincerite", // Q24
    ]);
  });

  it("aucun champ visible ne tombe dans le fourre-tout « Autres informations »", () => {
    // `advanced` est le refuge des champs sans étape : un champ qui y atterrit
    // est un champ que le citoyen risque de ne jamais déplier. Sur une
    // déclaration officielle, c'est une case blanche en puissance.
    for (const values of [TOUT_NON, TOUT_OUI]) {
      for (const etape of etapes(values)) {
        expect(etape.advanced.map((f) => f.id), etape.id).toEqual([]);
      }
    }
  });

  it("chaque étape porte le champ qui pose sa question — c'est lui qui la titre", () => {
    // Le titre d'une étape est le libellé de son champ ancre (cf.
    // `stepAnchorField`). Sans ancre, le runner retomberait sur le libellé de
    // section, voire sur l'identifiant brut du groupe.
    for (const etape of etapes(TOUT_OUI)) {
      if (etape.id === "identite") continue; // titré par clé i18n, pas de champ ancre.
      const champs = etape.sections.flatMap((s) => s.fields);
      expect(stepAnchorField(etape.id, champs), etape.id).toBeDefined();
    }
  });

  it("la question d'entrée reste seule à l'écran tant qu'on répond non", () => {
    const q1 = etapes(TOUT_NON).find((s) => s.id === "aideIndependant");
    expect(q1?.sections.flatMap((s) => s.fields.map((f) => f.id))).toEqual(["aideIndependant"]);
  });

  it("l'identité ouvre le parcours, la signature n'a pas d'étape à elle", () => {
    const premiere = etapes(TOUT_NON)[0];
    expect(premiere.sections.flatMap((s) => s.fields.map((f) => f.id))).toEqual([
      "niss", "nomEtPrenom", "rue", "numero", "codePostal", "commune",
    ]);
    // `dateSignature` et `signature` sont des champs AUTO : jamais rendus comme
    // contrôle, apposés par le serveur à la génération. Leur place est le pied
    // de la DERNIÈRE étape (bloc « Signé numériquement par X » + envoi), pas une
    // étape à eux — ils ne doivent donc apparaître dans AUCUNE.
    const tousLesChamps = etapes(TOUT_OUI).flatMap((s) => [
      ...s.sections.flatMap((sec) => sec.fields.map((f) => f.id)),
      ...s.advanced.map((f) => f.id),
    ]);
    expect(tousLesChamps).not.toContain("signature");
    expect(tousLesChamps).not.toContain("dateSignature");
  });

  it("les sept jours de Q22 vivent dans l'étape « chômeur temporaire »", () => {
    // Ils avaient leur propre nœud dans l'arbre : ils auraient donc formé une
    // étape intitulée « Lundi ».
    const q22 = etapes(TOUT_OUI).find((s) => s.id === "estChomeurTemporaire");
    const ids = q22?.sections.flatMap((s) => s.fields.map((f) => f.id)) ?? [];
    expect(ids).toContain("estChomeurTemporaire");
    expect(ids).toContain("joursOccupeLundi");
    expect(ids).toContain("joursOccupeDimanche");
    // …et disparaissent avec la réponse « non », sans faire disparaître l'étape.
    const nonTemp = etapes(TOUT_NON).find((s) => s.id === "estChomeurTemporaire");
    expect(nonTemp?.sections.flatMap((s) => s.fields.map((f) => f.id))).toEqual([
      "estChomeurTemporaire",
    ]);
  });

  it("la grille horaire de Q4 tient dans l'étape de Q4, fréquence comprise", () => {
    const q4 = etapes(TOUT_OUI).find((s) => s.id === "q4periode");
    const ids = q4?.sections.flatMap((s) => s.fields.map((f) => f.id)) ?? [];
    expect(ids).toContain("q4lundi");
    expect(ids).toContain("q4periode");
    expect(ids).toContain("q4dimanche");
    // La rubrique ne déborde pas sur la question suivante.
    expect(ids).not.toContain("descriptionAide1");
  });
});
