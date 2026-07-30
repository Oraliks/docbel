// `inheritedFromDossier` — masquer ce que le dossier a déjà donné, JAMAIS ce
// qui est vide.
//
// L'invariant que ces tests protègent tient en une phrase : un champ retiré de
// l'écran est un champ dont la valeur part quand même sur le PDF officiel. Le
// mode de panne inverse — champ invisible ET vide — produit une déclaration
// ONEM sans nom, que personne ne voit avant l'usager.

import { describe, it, expect } from "vitest";
import { applyDossierInheritance, isUsableInheritedValue } from "../dossier-inheritance";
import { buildInitialValues, sanitizeStoredPayload } from "../initial-values";
import { buildMacroSteps } from "../build-steps";
import type { PublicField } from "../public-serializer";
import type { PrefillMap } from "../canonical/extract";

function champ(p: Partial<PublicField> & Pick<PublicField, "id" | "type">): PublicField {
  return { required: false, label: { fr: p.id }, ...p } as PublicField;
}

/// En-tête d'un compagnon : nom composite + NISS + adresse éclatée, tous
/// hérités, plus une question qui n'a rien à voir.
const CHAMPS: PublicField[] = [
  champ({
    id: "nomEtPrenom",
    type: "fullname",
    required: true,
    inheritedFromDossier: true,
    stepGroup: "identite",
    section: "identite",
  }),
  champ({
    id: "niss",
    type: "niss",
    required: true,
    inheritedFromDossier: true,
    canonicalKey: "identity.niss",
    stepGroup: "identite",
    section: "identite",
  }),
  champ({
    id: "rue",
    type: "text",
    required: true,
    inheritedFromDossier: true,
    canonicalKey: "adresse.rue",
    stepGroup: "identite",
    section: "identite",
  }),
  champ({
    id: "question1",
    type: "radio",
    required: true,
    stepGroup: "question1",
    section: "activites",
    options: [{ value: "oui", label: { fr: "Oui" } }],
  }),
];

const DOSSIER_COMPLET: PrefillMap = {
  nomEtPrenom: { first: "Jean", last: "Dupont" },
  niss: "85073003328",
  rue: "Rue de la Loi",
};

function auto(fields: PublicField[]): string[] {
  return fields.filter((f) => f.autoAnswered).map((f) => f.id);
}

describe("applyDossierInheritance — dans un dossier qui a fourni les valeurs", () => {
  it("masque les champs hérités et EUX SEULS", () => {
    const out = applyDossierInheritance(CHAMPS, DOSSIER_COMPLET);
    expect(auto(out)).toEqual(["nomEtPrenom", "niss", "rue"]);
    expect(out.find((f) => f.id === "question1")?.autoAnswered).toBeUndefined();
  });

  it("ne mute pas la liste d'entrée", () => {
    applyDossierInheritance(CHAMPS, DOSSIER_COMPLET);
    expect(CHAMPS.every((f) => f.autoAnswered === undefined)).toBe(true);
  });

  it("fait disparaître l'étape d'identité du stepper", () => {
    const avant = buildMacroSteps(CHAMPS, {}, ["identite", "question1"]);
    expect(avant?.map((s) => s.id)).toEqual(["identite", "question1"]);

    const out = applyDossierInheritance(CHAMPS, DOSSIER_COMPLET);
    const apres = buildMacroSteps(out, {}, ["identite", "question1"]);
    expect(apres?.map((s) => s.id)).toEqual(["question1"]);
  });

  it("la valeur héritée reste dans l'état de départ du runner", () => {
    // C'est TOUT l'enjeu : le champ n'est plus rendu, mais `buildInitialValues`
    // — la fonction dont le runner tire son `useState` initial — le porte
    // toujours, donc il part avec la soumission.
    const out = applyDossierInheritance(CHAMPS, DOSSIER_COMPLET);
    const valeurs = buildInitialValues(out, DOSSIER_COMPLET);
    expect(valeurs.nomEtPrenom).toEqual({ first: "Jean", last: "Dupont" });
    expect(valeurs.niss).toBe("85073003328");
    expect(valeurs.rue).toBe("Rue de la Loi");
  });
});

describe("applyDossierInheritance — quand le dossier ne fournit rien", () => {
  it("hors dossier (aucun pré-remplissage), aucun champ n'est masqué", () => {
    expect(auto(applyDossierInheritance(CHAMPS, undefined))).toEqual([]);
    expect(auto(applyDossierInheritance(CHAMPS, {}))).toEqual([]);
  });

  it("l'étape d'identité reste alors dans le parcours, et en tête", () => {
    const out = applyDossierInheritance(CHAMPS, undefined);
    const steps = buildMacroSteps(out, {}, ["identite", "question1"]);
    expect(steps?.map((s) => s.id)).toEqual(["identite", "question1"]);
  });

  it("un dossier PARTIEL ne masque que ce qu'il a réellement transmis", () => {
    const out = applyDossierInheritance(CHAMPS, { niss: "85073003328" });
    expect(auto(out)).toEqual(["niss"]);
  });

  it("une valeur vide ou blanche ne masque rien", () => {
    const out = applyDossierInheritance(CHAMPS, { niss: "   ", rue: "" });
    expect(auto(out)).toEqual([]);
  });

  it("un nom composite À MOITIÉ transmis reste saisissable", () => {
    // `canonicalToPrefill` compose `{ first, last }` dès qu'UNE des deux clés
    // canoniques existe. Masquer sur cette base ferait signer « Jean » sans
    // nom de famille une déclaration officielle.
    const out = applyDossierInheritance(CHAMPS, { nomEtPrenom: { first: "Jean", last: "" } });
    expect(auto(out)).toEqual([]);
  });
});

describe("applyDossierInheritance — le brouillon a le dernier mot", () => {
  it("un brouillon qui VIDE une valeur héritée rouvre le champ", () => {
    // Brouillon enregistré AVANT que le C1 soit rempli : le runner l'applique
    // par-dessus le pré-remplissage. Masquer ici bloquerait le citoyen sur une
    // erreur « obligatoire » posée sur un champ qu'il ne voit pas.
    const out = applyDossierInheritance(CHAMPS, DOSSIER_COMPLET, {
      nomEtPrenom: { first: "", last: "" },
      niss: "",
    });
    expect(auto(out)).toEqual(["rue"]);
  });

  it("un brouillon qui CORRIGE la valeur héritée laisse le champ masqué", () => {
    const out = applyDossierInheritance(CHAMPS, DOSSIER_COMPLET, { niss: "72020200290" });
    expect(auto(out)).toEqual(["nomEtPrenom", "niss", "rue"]);
  });
});

describe("applyDossierInheritance — un brouillon a la mauvaise forme (ancien schéma)", () => {
  // `draftValues` est un payload ENREGISTRÉ, jamais revalidé depuis : un champ
  // peut avoir changé de `type` sans changer d'`id` (ex. Q5 du C1A, commit
  // `1f36623`). Sans `sanitizeStoredPayload`, une valeur de mauvaise forme
  // laissée dans `draftValues` serait pourtant un tableau NON VIDE — donc
  // "usable" au sens `isUsableInheritedValue` (qui ne juge que le vide, pas la
  // forme) — et masquerait le champ hérité (`autoAnswered: true`) sur la foi
  // d'une valeur qui ne pourrait de toute façon jamais passer `buildValidator`
  // (le niss attend une chaîne). Résultat AVANT le garde-fou : un champ requis
  // invisible, bloqué sur une valeur que le citoyen ne peut plus corriger —
  // pire que le simple "[object Object]" d'un champ resté à l'écran.
  it("une valeur de brouillon mal formée n'empêche pas l'héritage de la BONNE valeur du dossier", () => {
    const draftMalForme = {
      // Ancien format (imaginons `niss` autrefois porté par un champ array) :
      // un tableau non vide, que `isUsableInheritedValue` jugerait "usable"
      // s'il n'était pas filtré en amont par la forme attendue (`niss` = texte).
      niss: [{ oops: true }] as unknown as string,
    };
    const out = applyDossierInheritance(CHAMPS, DOSSIER_COMPLET, draftMalForme);
    // Le champ reste correctement masqué : la valeur retenue est celle du
    // dossier (un vrai NISS), jamais le tableau parasite du brouillon.
    expect(auto(out)).toEqual(["nomEtPrenom", "niss", "rue"]);

    // Reproduit EXACTEMENT la formule du runner (cf. `PdfFormRunner`, useState
    // initial) : le brouillon parasite ne doit jamais survivre à la fusion.
    const valeursRunner = {
      ...buildInitialValues(out, DOSSIER_COMPLET),
      ...sanitizeStoredPayload(out, draftMalForme),
    };
    expect(valeursRunner.niss).toBe("85073003328");
  });
});

describe("isUsableInheritedValue", () => {
  it("refuse le vide sous toutes ses formes", () => {
    for (const v of [null, undefined, "", "   ", false, [], {}, { first: "Jean" }]) {
      expect(isUsableInheritedValue(v)).toBe(false);
    }
  });

  it("accepte une valeur réellement exploitable", () => {
    for (const v of ["Dupont", 0, true, [{ a: "b" }], { first: "Jean", last: "Dupont" }]) {
      expect(isUsableInheritedValue(v)).toBe(true);
    }
  });
});
