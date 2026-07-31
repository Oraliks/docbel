import { describe, expect, it } from "vitest";
import {
  C47_FIELDS,
  C47_GROUPE_IDENTITE,
  C47_QUESTIONS,
  applyC47Improvements,
} from "../c47-fields";

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
    expect(ids).toContain("cadreDemande");
    expect(ids).toContain("dateDA");
    expect(ids).toContain("aujourd_hui");
    expect(ids).toContain("signature");
    // Les deux cases à cocher séparées ont fusionné dans `cadreDemande`
    // (2026-07-30) : leur champ AcroForm partagé cochait deux cadres à la fois.
    expect(ids).not.toContain("jeuneTravailleurStageInsertion");
    expect(ids).not.toContain("chomeurCompletIndemniseInaptitude");
  });

  it("compte 12 champs — 9 widgets écrits par le schéma + 2 sous-champs d'adresse + le choix", () => {
    // « rue + numéro » et « code postal + commune » sont saisis séparément
    // mais imprimés sur une seule ligne chacun ; `cadreDemande` couvre à lui
    // seul les trois cases à cocher, écrites en positionnel.
    expect(C47_FIELDS.length).toBe(12);
  });

  it("les trois cases de « votre demande » sont UN choix unique, sans widget revendiqué", () => {
    const choix = C47_FIELDS.find((f) => f.id === "cadreDemande");
    expect(choix?.type).toBe("radio");
    expect(choix?.required).toBe(true);
    // Aucune case revendiquée : les trois croix sont dessinées par les règles
    // serveur (clés sentinelles `c47:case-*`). Revendiquer en plus le champ
    // AcroForm serait un conflit de mapping — et surtout, ce champ porte DEUX
    // widgets dans deux cadres différents.
    expect(choix?.pdfFieldName).toBe("");
    expect(choix?.options?.map((o) => o.value)).toEqual([
      "art114",
      "jeune-travailleur",
      "chomeur-indemnise",
    ]);
  });

  it("le choix du cadre annonce le certificat médical à joindre", () => {
    // Le PDF imprime « Document à joindre » sous les DEUX cadres : l'encart est
    // donc posé sur la question, pas sur une réponse en particulier — il doit
    // s'afficher quel que soit le cadre choisi. Il n'existe aucun widget pour
    // cette pièce : sans cet encart, un citoyen qui remplit le C47 hors dossier
    // n'apprenait nulle part qu'un certificat lui serait réclamé.
    const choix = C47_FIELDS.find((f) => f.id === "cadreDemande");
    expect(choix?.notice?.tone).toBe("info");
    // Phrase RECOPIÉE du formulaire officiel (pdfplumber sur C47_FR.pdf), pas
    // rédigée : ce document engage une déclaration, aucun texte n'y est inventé.
    expect(choix?.notice?.text.fr).toBe(
      "Document à joindre : certificat médical qui atteste de votre inaptitude permanente au travail (l'indication du taux d'inaptitude n'est pas obligatoire)."
    );
  });

  it("la date de début n'est demandée que sur la branche art. 114", () => {
    // Le second cadre du formulaire n'imprime aucune case de date : la
    // demander là serait demander une valeur qui n'irait nulle part.
    const date = C47_FIELDS.find((f) => f.id === "dateDA");
    expect(date?.visibleIf).toEqual({
      fieldId: "cadreDemande",
      op: "equals",
      value: "art114",
    });
  });

  it("les trois guides imprimés en peigne reçoivent un chiffre par case", () => {
    const byId = new Map(C47_FIELDS.map((f) => [f.id, f]));
    // Sans peigne, « 85.07.14-231.05 » s'imprimerait par-dessus les « / » et
    // « - » déjà dessinés sur le formulaire (défaut signalé sur le C1).
    expect(byId.get("niss")?.printAsComb?.groups).toEqual([6, 3, 2]);
    expect(byId.get("dateDA")?.printAsComb?.groups).toEqual([2, 2, 4]);
    expect(byId.get("aujourd_hui")?.printAsComb?.groups).toEqual([2, 2, 4]);
    for (const id of ["niss", "dateDA", "aujourd_hui"]) {
      expect(byId.get(id)?.printAsComb?.slotWidth).toBeGreaterThan(0);
    }
  });

  it("l'identité et l'adresse sont héritées du dossier, jamais redemandées", () => {
    const herites = C47_FIELDS.filter((f) => f.inheritedFromDossier).map((f) => f.id);
    expect(herites.sort()).toEqual(
      ["codePostal", "commune", "niss", "numero", "pr_nom_et_nom", "rue"].sort()
    );
  });

  it("le téléphone et l'e-mail ne sont jamais demandés, mais restent imprimables", () => {
    // Muets à l'écran comme sur le C1 (Oraliks 2026-07-31) — le formulaire
    // imprime lui-même qu'ils sont facultatifs.
    const byId = new Map(C47_FIELDS.map((f) => [f.id, f]));
    for (const id of ["t_l_phone", "email"]) {
      expect(byId.get(id)?.autoAnswered, `${id} doit être muet`).toBe(true);
      // …et surtout PAS `hidden`, qui les retirerait aussi du PDF : la case
      // partirait blanche alors que la valeur est connue (c'est le défaut du
      // C1, pas son modèle).
      expect(byId.get(id)?.hidden, `${id} ne doit pas être masqué du PDF`).toBeUndefined();
      expect(byId.get(id)?.pdfFieldName, `${id} garde sa case`).toBeTruthy();
    }
  });

  it("chaque champ porte un stepGroup connu de l'ordre des étapes", () => {
    const groupes = new Set([C47_GROUPE_IDENTITE, ...C47_QUESTIONS]);
    for (const f of applyC47Improvements([])) {
      expect(f.stepGroup, `champ « ${f.id} » sans étape`).toBeTruthy();
      expect(groupes, `champ « ${f.id} » dans un groupe hors ordre`).toContain(f.stepGroup);
    }
  });

  it("chaque question a pour ancre un champ de même identifiant", () => {
    // C'est cette égalité qui donne son titre à l'étape (cf.
    // `stepAnchorField`) : une question sans champ ancre afficherait son
    // identifiant brut à un citoyen.
    const ids = new Set(C47_FIELDS.map((f) => f.id));
    for (const q of C47_QUESTIONS) expect(ids, `question « ${q} »`).toContain(q);
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
  });

  it("place les champs dans les bonnes sections", () => {
    const byId = new Map(C47_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("pr_nom_et_nom")?.section).toBe("identite");
    expect(byId.get("niss")?.section).toBe("identite");
    expect(byId.get("rue")?.section).toBe("adresse");
    expect(byId.get("numero")?.section).toBe("adresse");
    expect(byId.get("codePostal")?.section).toBe("adresse");
    expect(byId.get("commune")?.section).toBe("adresse");
    expect(byId.get("cadreDemande")?.section).toBe("demande");
    expect(byId.get("dateDA")?.section).toBe("demande");
    expect(byId.get("aujourd_hui")?.section).toBe("signature");
    expect(byId.get("signature")?.section).toBe("signature");
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

  it("applyC47Improvements() purge les deux anciennes cases à cocher restées en base", () => {
    // Sans ce filtre elles survivraient en base (le merge ne compare que les
    // `id`) et se battraient avec la règle serveur pour la même case — celle
    // de « jeune travailleur » cochant en prime la case « art. 114 » de
    // l'autre cadre, puisque les deux widgets partagent un champ AcroForm.
    const enBase = [
      {
        id: "jeuneTravailleurStageInsertion",
        pdfFieldName: "Je suis un jeune travailleur…",
        type: "checkbox" as const,
        required: false,
        label: { fr: "Ancienne case" },
      },
      {
        id: "chomeurCompletIndemniseInaptitude",
        pdfFieldName: "Je suis chômeur complet indemnisé…",
        type: "checkbox" as const,
        required: false,
        label: { fr: "Ancienne case" },
      },
    ];
    const ids = applyC47Improvements(enBase).map((f) => f.id);
    expect(ids).not.toContain("jeuneTravailleurStageInsertion");
    expect(ids).not.toContain("chomeurCompletIndemniseInaptitude");
    expect(ids).toContain("cadreDemande");
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
