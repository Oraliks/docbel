// Garde-fou générique : une valeur ENREGISTRÉE (brouillon serveur, brouillon
// local, pré-remplissage du dossier) peut avoir été écrite sous un ANCIEN
// schéma. Un champ peut garder son `id` mais changer de `type` — ex. Q5 du
// C1A, `descriptionAide1` : `array` (lignes numérotées) → `textarea` (commit
// `1f36623`) — et `LEGACY_C1A_FIELD_IDS` ne purge QUE les id qui disparaissent,
// jamais un id qui reste avec un type différent.
//
// Sans garde, la valeur de mauvaise forme traverse jusqu'au rendu : un
// `<Textarea value={tableau} />` la fait passer par la conversion implicite
// de React, et `[{ description: "…" }].toString()` vaut littéralement
// `"[object Object]"` — exactement le symptôme rapporté par Oraliks.
//
// Ces tests couvrent, dans l'ordre demandé :
//   1. le cas rapporté (array hérité sur un champ devenu textarea → vide) ;
//   2. une valeur légitime de chaque type traverse intacte ;
//   3. le cas réel à ne PAS casser : `cohabitants` (C1), qui reçoit
//      légitimement un tableau via le pré-remplissage de l'assistant Mon
//      dossier (`familyAnswersToC1Prefill`).

import { describe, it, expect } from "vitest";
import {
  isValueShapeUsable,
  sanitizeStoredPayload,
  buildInitialValues,
} from "../initial-values";
import { toPublicField, type PublicField } from "../public-serializer";
import { C1_FAMILLE } from "../seed/c1/famille";
import type { FormPayload } from "../types";

function champ(p: Partial<PublicField> & Pick<PublicField, "id" | "type">): PublicField {
  return { required: false, label: { fr: p.id }, ...p } as PublicField;
}

/// Champ réel du C1 (pas un mock) : c'est LUI que la consigne désigne comme
/// le cas à ne pas abîmer. Une erreur explicite si le seed change de forme
/// vaut mieux qu'un `!` silencieux.
function cohabitantsField(): PublicField {
  const raw = C1_FAMILLE.find((f) => f.id === "cohabitants");
  if (!raw) {
    throw new Error(
      "Champ 'cohabitants' introuvable dans C1_FAMILLE (lib/pdf-forms/seed/c1/famille.ts) — seed modifié ?",
    );
  }
  return toPublicField(raw);
}

describe("isValueShapeUsable — la forme brute correspond-elle au type ACTUEL du champ ?", () => {
  it("texte (text/textarea/date/select/radio/niss/iban/…) : une chaîne, jamais un objet ni un tableau ni null", () => {
    expect(isValueShapeUsable("textarea", "un texte")).toBe(true);
    expect(isValueShapeUsable("textarea", "")).toBe(true); // forme valide ; le vide se juge ailleurs
    expect(isValueShapeUsable("text", "un texte")).toBe(true);
    expect(isValueShapeUsable("niss", "85073003328")).toBe(true);
    // Le cas rapporté : un ancien champ `array` (lignes) devenu `textarea`.
    expect(isValueShapeUsable("textarea", [{ description: "ancien format array" }])).toBe(false);
    expect(isValueShapeUsable("textarea", { description: "objet quelconque" })).toBe(false);
    expect(isValueShapeUsable("textarea", null)).toBe(false);
    expect(isValueShapeUsable("textarea", undefined)).toBe(false);
  });

  it("checkbox : un booléen, jamais une chaîne", () => {
    expect(isValueShapeUsable("checkbox", true)).toBe(true);
    expect(isValueShapeUsable("checkbox", false)).toBe(true);
    expect(isValueShapeUsable("checkbox", "true")).toBe(false);
    expect(isValueShapeUsable("checkbox", 1)).toBe(false);
    expect(isValueShapeUsable("checkbox", null)).toBe(false);
  });

  it("array : un tableau de lignes-objets, jamais une chaîne ni un tableau de scalaires", () => {
    expect(isValueShapeUsable("array", [{ lien: "epoux" }])).toBe(true);
    expect(isValueShapeUsable("array", [])).toBe(true);
    expect(isValueShapeUsable("array", "texte")).toBe(false);
    expect(isValueShapeUsable("array", ["a", "b"])).toBe(false);
    expect(isValueShapeUsable("array", null)).toBe(false);
  });

  it("number : un nombre ou une chaîne numérique, jamais un texte quelconque", () => {
    expect(isValueShapeUsable("number", 42)).toBe(true);
    expect(isValueShapeUsable("number", 0)).toBe(true);
    expect(isValueShapeUsable("number", "42")).toBe(true);
    expect(isValueShapeUsable("number", "42.5")).toBe(true);
    expect(isValueShapeUsable("number", "abc")).toBe(false);
    expect(isValueShapeUsable("number", "")).toBe(false);
    expect(isValueShapeUsable("number", "   ")).toBe(false);
    expect(isValueShapeUsable("number", Infinity)).toBe(false);
  });

  it("fullname : la forme {first, last}, jamais une chaîne brute (normalisée ailleurs, pas ici)", () => {
    expect(isValueShapeUsable("fullname", { first: "Jean", last: "Dupont" })).toBe(true);
    expect(isValueShapeUsable("fullname", { first: "", last: "" })).toBe(true);
    expect(isValueShapeUsable("fullname", { first: "Jean" })).toBe(true);
    expect(isValueShapeUsable("fullname", "Jean Dupont")).toBe(false);
    expect(isValueShapeUsable("fullname", null)).toBe(false);
  });

  it("une valeur undefined n'est jamais utilisable, quel que soit le type", () => {
    for (const type of ["text", "textarea", "checkbox", "array", "number", "fullname"] as const) {
      expect(isValueShapeUsable(type, undefined)).toBe(false);
    }
  });
});

describe("sanitizeStoredPayload — le cas rapporté (Q5 du C1A : array devenu textarea, même id)", () => {
  const FIELDS: PublicField[] = [champ({ id: "descriptionAide1", type: "textarea", required: true })];

  it("caractérise le symptôme : un tableau affiché tel quel produit exactement '[object Object]'", () => {
    expect(String([{ description: "Je fais les courses" }])).toBe("[object Object]");
  });

  it("une valeur array laissée par l'ancien schéma est ignorée, pas transmise telle quelle", () => {
    const brouillonAncienFormat: FormPayload = {
      descriptionAide1: [{ description: "Je fais les courses" }],
    };
    const sain = sanitizeStoredPayload(FIELDS, brouillonAncienFormat);
    expect(sain.descriptionAide1).toBeUndefined();
    expect("descriptionAide1" in sain).toBe(false);
  });

  it("fusionnée comme le fait le runner (defaults + brouillon assaini), le champ part vide", () => {
    const brouillonAncienFormat: FormPayload = {
      descriptionAide1: [{ description: "Je fais les courses" }],
    };
    const valeursInitiales: FormPayload = {
      ...buildInitialValues(FIELDS, undefined),
      ...sanitizeStoredPayload(FIELDS, brouillonAncienFormat),
    };
    // Absent du payload → `pdf-field.tsx` rend `(value as string) ?? ""` : vide.
    expect(valeursInitiales.descriptionAide1).toBeUndefined();
  });

  it("une valeur légitime (chaîne) du même brouillon traverse intacte", () => {
    const brouillonValide: FormPayload = {
      descriptionAide1: "Je fais les courses de ma voisine.",
    };
    const sain = sanitizeStoredPayload(FIELDS, brouillonValide);
    expect(sain.descriptionAide1).toBe("Je fais les courses de ma voisine.");
  });
});

describe("sanitizeStoredPayload — une valeur légitime de chaque type traverse intacte", () => {
  const FIELDS: PublicField[] = [
    champ({ id: "champTexte", type: "text" }),
    champ({ id: "champCheckbox", type: "checkbox" }),
    champ({ id: "champNumber", type: "number" }),
    champ({ id: "champFullname", type: "fullname" }),
    champ({ id: "champArray", type: "array" }),
  ];

  it("chaque type reçoit sa forme attendue sans être altéré", () => {
    const brouillon: FormPayload = {
      champTexte: "Bonjour",
      champCheckbox: true,
      champNumber: "123.45",
      champFullname: { first: "Jean", last: "Dupont" },
      champArray: [{ x: "1" }],
    };
    expect(sanitizeStoredPayload(FIELDS, brouillon)).toEqual(brouillon);
  });
});

describe("sanitizeStoredPayload — le cas réel à ne pas abîmer : cohabitants (C1)", () => {
  it("le champ existe, est bien de type array (garde-fou du test lui-même)", () => {
    expect(cohabitantsField().type).toBe("array");
  });

  it("une grille de cohabitants déjà remplie n'est pas vidée", () => {
    const brouillon: FormPayload = {
      cohabitants: [
        { prenom: "Marie", nom: "Dupont", lien: "epoux", dateNaissance: "1990-01-01" },
      ],
    };
    const sain = sanitizeStoredPayload([cohabitantsField()], brouillon);
    expect(sain.cohabitants).toEqual(brouillon.cohabitants);
  });
});

describe("sanitizeStoredPayload — cas limites", () => {
  it("un id absent du schéma courant (champ retiré) est conservé tel quel", () => {
    const sain = sanitizeStoredPayload([], { champFantome: "valeur ancienne" });
    expect(sain.champFantome).toBe("valeur ancienne");
  });

  it("undefined en entrée donne un payload vide", () => {
    expect(sanitizeStoredPayload([champ({ id: "x", type: "text" })], undefined)).toEqual({});
  });
});

describe("buildInitialValues — le pré-remplissage du dossier applique la même garde", () => {
  it("un prefill array ne s'injecte plus dans un champ redevenu texte", () => {
    const fields: PublicField[] = [champ({ id: "descriptionAide1", type: "textarea" })];
    const valeurs = buildInitialValues(fields, {
      descriptionAide1: [{ description: "ancien format" }],
    });
    expect(valeurs.descriptionAide1).toBeUndefined();
  });

  it("cohabitants (array légitime issu de l'assistant Mon dossier) n'est pas cassé par le même garde-fou", () => {
    // Cf. lib/dossiers/family-prefill.ts : `familyAnswersToC1Prefill` produit
    // `{ cohabitants: [{ lien }] }`, injecté ici via `bundlePrefill`.
    const valeurs = buildInitialValues([cohabitantsField()], { cohabitants: [{ lien: "epoux" }] });
    expect(valeurs.cohabitants).toEqual([{ lien: "epoux" }]);
  });
});
