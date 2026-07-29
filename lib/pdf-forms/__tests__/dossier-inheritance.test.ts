// `inheritedFromDossier` — masquer ce que le dossier a déjà donné, JAMAIS ce
// qui est vide.
//
// L'invariant que ces tests protègent tient en une phrase : un champ retiré de
// l'écran est un champ dont la valeur part quand même sur le PDF officiel. Le
// mode de panne inverse — champ invisible ET vide — produit une déclaration
// ONEM sans nom, que personne ne voit avant l'usager.

import { describe, it, expect } from "vitest";
import { applyDossierInheritance, isUsableInheritedValue } from "../dossier-inheritance";
import { buildInitialValues } from "../initial-values";
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
