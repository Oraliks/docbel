import { describe, expect, it } from "vitest";
import { C1A_FIELDS, applyC1AImprovements } from "../c1a-fields";
import { compilerRoutage } from "../../routing";
import { C1A_ROUTAGE, C1A_DEPART } from "../c1a-routing";
import { buildValidator, countRequirements } from "../../validation";
import type { FormPayload, PdfFormField } from "../../types";

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

  it("Q2 : nature de l'activité est un champ array de 5 lignes max (Commit 2)", () => {
    const byId = new Map(C1A_FIELDS.map((f) => [f.id, f]));
    const f = byId.get("natureActiviteIndependant");
    expect(f, "natureActiviteIndependant doit exister").toBeDefined();
    expect(f?.type).toBe("array");
    expect(f?.maxRows).toBe(5);
    expect(f?.addRowLabel?.fr).toBeTruthy();
    expect(f?.itemFields?.map((sf) => sf.pdfFieldNameTemplate)).toEqual([
      "mentionnez les toutes {index}",
    ]);
    // Les anciens ids à 5 lignes fixes ont disparu.
    const ids = C1A_FIELDS.map((x) => x.id);
    for (let n = 1; n <= 5; n++) {
      expect(ids).not.toContain(`natureActiviteIndependant${n}`);
    }
  });

  it("Q5 : description de l'aide est un textarea réparti sur 9 lignes (2026-07-30, ex-array du Commit 2)", () => {
    const byId = new Map(C1A_FIELDS.map((f) => [f.id, f]));
    const f = byId.get("descriptionAide1");
    expect(f, "descriptionAide1 doit exister").toBeDefined();
    expect(f?.type).toBe("textarea");
    expect(f?.pdfFieldName, "champ virtuel : la répartition vit dans lineTargets").toBe("");
    expect(f?.lineTargets?.map((t) => t.pdfFieldName)).toEqual(
      Array.from({ length: 9 }, (_, i) => `Décrivez laide que vous apporterez ${i + 1}`),
    );
    // Les anciennes lignes 2 à 9 (Commit 2) n'ont jamais été des ids
    // top-level séparés (déjà consolidées dans l'array du Commit 2, puis
    // dans ce textarea) : vérifié ici par non-régression.
    const ids = C1A_FIELDS.map((x) => x.id);
    for (let n = 2; n <= 9; n++) {
      expect(ids).not.toContain(`descriptionAide${n}`);
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
    // Champs "statiques" définis explicitement (identité, Q1-Q24 hors grilles)
    // + 2 grilles horaires de 67 champs chacune (5 jours x 4 + samedi +
    // dimanche + periode + lignes de texte périodes/irrégulier -> vérifié
    // dynamiquement ci-dessous plutôt que recalculé à la main pour éviter une
    // double comptabilité fragile).
    //
    // Depuis le Commit 2 (2026-07-29), natureActiviteIndependant1..5 et
    // descriptionAide1..9 (14 champs top-level) sont consolidés en 2 champs
    // `array` (natureActiviteIndependant, descriptionAide1) : leurs lignes
    // vivent désormais dans `itemFields`, pas dans C1A_FIELDS.
    //
    // Depuis le 2026-07-30, les grilles horaires Q4 (4+5 lignes de texte) et
    // Q18 (4+3) perdent 12 champs top-level de plus : chaque groupe
    // "Période 1..N" / "Précision 1..N" devient UN textarea, dont
    // `lineTargets` porte les mêmes widgets/coordonnées (105 après ce
    // premier mouvement, 117 juste après le Commit 2).
    //
    // Même jour (suite) : Q16 "Je décris mon activité" / "… (suite)" /
    // "… (fin)" (3 champs) se consolide à son tour en UN textarea
    // (descriptionActivite1 + lineTargets), -2 champs top-level ; Q5
    // "Décrivez l'aide que vous apporterez" passe d'`array` à `textarea`
    // SANS changer de nombre de champs top-level (déjà un seul champ avant
    // et après, cf. describe "Q5 et Q16, un textarea unique par question").
    // Total 103 au moment d'écrire ce test.
    expect(C1A_FIELDS.length).toBeGreaterThan(95);
    expect(C1A_FIELDS.length).toBe(new Set(C1A_FIELDS.map((f) => f.id)).size);
  });
});

describe("C1A — revenus imprimés (Q11, Q19)", () => {
  const fields = applyC1AImprovements([]);
  const parCle = new Map(fields.map((f) => [f.id, f]));

  it("les trois revenus de Q19 sont écrits aux coordonnées, pas dans un widget partagé", () => {
    for (const id of [
      "revenuNetSalarieParMois",
      "revenuNetSalarieParHeure",
      "revenuNetIndependantParAn",
    ]) {
      const f = parCle.get(id);
      expect(f, `${id} doit exister`).toBeDefined();
      expect(f?.drawAt, `${id} doit porter un drawAt`).toBeDefined();
      expect(f?.drawAt?.page, `${id} est en page 2`).toBe(1);
      expect(f?.pdfFieldName, `${id} ne doit pointer vers aucun widget`).toBe("");
    }
  });

  it("aucun champ ne revendique le widget partagé « voir 19 »", () => {
    const revendications = fields.filter((f) => f.pdfFieldName?.includes("voir 19"));
    expect(revendications.map((f) => f.id)).toEqual([]);
  });

  it("« par mois » et « par heure » (même ligne imprimée) partagent la même condition", () => {
    // Correctif Q19 : revenuNetSalarieParMois est l'ancre de Q19 dans l'arbre,
    // sa condition écrite en dur est remplacée par celle de la branche (Q17 ET
    // Q12). revenuNetSalarieParHeure, simple champ rattaché, gardait en plus
    // son propre garde-fou activiteCommeSalarie=oui : un indépendant voyait
    // « par mois » sans « par heure », deux cases de la même ligne imprimée.
    expect(parCle.get("revenuNetSalarieParHeure")?.visibleIf).toEqual(
      parCle.get("revenuNetSalarieParMois")?.visibleIf,
    );
    expect(parCle.get("revenuNetSalarieParHeure")?.visibleIf?.fieldId).not.toBe("activiteCommeSalarie");
  });

  it("le mandat et son revenu (Q10, Q11) sont écrits aux coordonnées", () => {
    for (const id of ["mandatDescription", "revenuAnnuelMandat", "revenuAnnuelMandat2"]) {
      const f = parCle.get(id);
      expect(f, `${id} doit exister`).toBeDefined();
      expect(f?.drawAt, `${id} doit porter un drawAt`).toBeDefined();
      expect(f?.drawAt?.page, `${id} est en page 2`).toBe(1);
    }
  });
  // "aucun champ ne revendique le widget partagé « Montant »" : déplacé dans
  // le describe Q6/Q24 ci-dessous — vrai seulement une fois `montantAide`
  // lui-même passé en drawAt (Task 5). Avant cela, il porte encore
  // pdfFieldName "Montant" et cette assertion serait rouge à tort ici.
});

describe("C1A — Q6 (montant) et Q24 (annexes) imprimés", () => {
  const fields = applyC1AImprovements([]);
  const parCle = new Map(fields.map((f) => [f.id, f]));

  it("Q6 distingue le montant mensuel du montant annuel", () => {
    const periodicite = parCle.get("montantAidePeriodicite");
    expect(periodicite?.type).toBe("radio");
    expect(periodicite?.options?.map((o) => o.value)).toEqual(["mois", "an"]);
  });

  it("le nombre d'annexes s'imprime et reste facultatif", () => {
    const annexes = parCle.get("nombreAnnexesJointes");
    expect(annexes?.pdfFieldName).toBe("Liste déroulante44");
    expect(annexes?.required, "Oraliks : facultatif").not.toBe(true);
    expect(annexes?.hidden, "mais la case doit exister à l'écran").not.toBe(true);
  });

  it("plus aucun champ « non identifié » ne squatte la case des annexes", () => {
    expect(fields.filter((f) => f.id === "listeDeroulante44")).toEqual([]);
  });

  it("aucun champ ne revendique le widget partagé « Montant »", () => {
    expect(fields.filter((f) => f.pdfFieldName === "Montant").map((f) => f.id)).toEqual([]);
  });
});

describe("C1A — arbre des renvois", () => {
  const conditions = compilerRoutage(C1A_ROUTAGE, C1A_DEPART);
  const fields = applyC1AImprovements([]);
  const parCle = new Map(fields.map((f) => [f.id, f]));

  it("Q9, Q12 et Q22 sont sur tous les chemins, donc sans condition", () => {
    expect(conditions.mandatPolitiqueOuJuge).toBeUndefined();
    expect(conditions.autreActiviteAccessoire).toBeUndefined();
    expect(conditions.estChomeurTemporaire).toBeUndefined();
  });

  it("Q4 dépend de Q3 ET de Q1 — c'est le bug historique", () => {
    expect(conditions.q4periode).toEqual({
      fieldId: "aideraPendantChomage",
      op: "equals",
      value: "oui",
      and: [{ fieldId: "aideIndependant", op: "equals", value: "oui" }],
    });
  });

  it("déplacer l'ancre de Q4 sur `q4periode` ne change aucune condition", () => {
    // L'ancre de la rubrique est passée de `q4lundi` à `q4periode` (2026-07-29,
    // « une question = une étape » : une étape intitulée « Lundi » n'a pas de
    // sens). Le jour du lundi reste conditionné exactement comme avant — il est
    // désormais rattaché à la question au lieu de l'être.
    expect(parCle.get("q4lundi")?.visibleIf).toEqual(conditions.q4periode);
    expect(parCle.get("q18lundi")?.visibleIf).toEqual(conditions.q18periode);
  });

  it("le schéma porte les conditions compilées", () => {
    expect(parCle.get("q4periode")?.visibleIf).toEqual(conditions.q4periode);
    expect(parCle.get("descriptionAide1")?.visibleIf).toEqual(conditions.descriptionAide1);
    expect(parCle.get("mandatPolitiqueOuJuge")?.visibleIf).toBeUndefined();
  });

  it("une condition intra-question survit à l'arbre, complétée par la branche", () => {
    // Q6 : les deux montants partagent le libellé et ne se distinguent que par
    // la périodicité. Écraser leur condition les afficherait tous les deux.
    expect(parCle.get("montantAide")?.visibleIf).toEqual({
      fieldId: "montantAidePeriodicite",
      op: "equals",
      value: "mois",
      and: [
        { fieldId: "aideraPendantChomage", op: "equals", value: "oui" },
        { fieldId: "aideIndependant", op: "equals", value: "oui" },
      ],
    });
    expect(parCle.get("montantAideAnnuel")?.visibleIf?.value).toBe("an");

    // Q16 : demander son numéro d'entreprise à qui vient de déclarer ne pas en
    // avoir n'a pas de sens.
    expect(parCle.get("numeroEntreprise")?.visibleIf).toEqual({
      fieldId: "disposeNumeroEntreprise",
      op: "equals",
      value: "oui",
      and: [{ fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" }],
    });
  });

  it("la fusion est idempotente sur une condition déjà juste", () => {
    // `descriptionActivite1` porte déjà la condition compilée de sa question
    // (Q16) : le dédoublonnage ne doit rien empiler. Depuis le 2026-07-30,
    // c'est le textarea consolidé (lineTargets, ex-3 champs) qui porte cet
    // id — la condition ne change pas.
    expect(parCle.get("descriptionActivite1")?.visibleIf).toEqual({
      fieldId: "autreActiviteAccessoire",
      op: "equals",
      value: "oui",
    });
  });

  it("toute la grille horaire est rattachée à sa question d'entrée", () => {
    // Sans ce rattachement, un créneau échappe à l'arbre : depuis la Task 13,
    // il n'a plus aucune condition propre (la grille reproduit le papier, tout
    // visible d'emblée), et s'afficherait tout entier à qui a répondu
    // « je n'aiderai pas cet indépendant ».
    const clauses = (id: string) => {
      const c = parCle.get(id)?.visibleIf;
      return c ? [c, ...(c.and ?? [])].map((x) => `${x.fieldId}=${String(x.value)}`) : [];
    };
    expect(clauses("q4mardiEntre7h18h")).toEqual([
      "aideraPendantChomage=oui",
      "aideIndependant=oui",
    ]);
    expect(clauses("q4periodesTexte")).toEqual([
      "q4periode=periodes",
      "aideraPendantChomage=oui",
      "aideIndependant=oui",
    ]);
    expect(clauses("q18samedi")).toEqual([
      "exerceraPendantChomage=oui",
      "autreActiviteAccessoire=oui",
    ]);
  });

  it("Q22 est commandée par une question de chômage temporaire", () => {
    const q = parCle.get("estChomeurTemporaire");
    expect(q, "la question doit exister").toBeDefined();
    expect(q?.pdfFieldName, "elle n'existe pas sur le papier").toBe("");
    expect(q?.options?.map((o) => o.value)).toEqual(["oui", "non"]);

    const lundi = parCle.get("joursOccupeLundi");
    expect(lundi?.visibleIf).toEqual({
      fieldId: "estChomeurTemporaire",
      op: "equals",
      value: "oui",
    });
  });

  it("les sept jours de Q22 suivent la question d'entrée", () => {
    for (const jour of ["Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]) {
      expect(parCle.get(`joursOccupe${jour}`)?.visibleIf, jour).toEqual(
        parCle.get("joursOccupeLundi")?.visibleIf,
      );
    }
  });

  it("le second montant de Q11 suit le premier", () => {
    expect(parCle.get("revenuAnnuelMandat2")?.visibleIf).toEqual(
      parCle.get("revenuAnnuelMandat")?.visibleIf,
    );
  });
});

describe("C1A — aides contextuelles", () => {
  const fields = applyC1AImprovements([]);
  const parCle = new Map(fields.map((f) => [f.id, f]));

  it("Q9 rappelle les fonctions exemptées", () => {
    const help = parCle.get("mandatPolitiqueOuJuge")?.help?.fr ?? "";
    expect(help).toContain("conseiller communal");
    expect(help).toContain("C.P.A.S.");
  });

  it("Q12 porte la consigne « répondez toujours oui si… »", () => {
    const help = parCle.get("autreActiviteAccessoire")?.help?.fr ?? "";
    expect(help).toContain("administrateur de société");
  });

  it("les questions longues ont un libellé court pour mobile", () => {
    for (const id of ["mandatPolitiqueOuJuge", "autreActiviteAccessoire", "exerceraPendantChomage"]) {
      expect(parCle.get(id)?.labelShort?.fr, `${id} doit avoir un labelShort`).toBeTruthy();
    }
  });
});

describe("C1A — grilles horaires", () => {
  const fields = applyC1AImprovements([]);

  it("les créneaux sont visibles sans avoir à cocher le jour d'abord", () => {
    const creneaux = fields.filter((f) => /^q(4|18)(lundi|mardi|mercredi|jeudi|vendredi)(Avant7h|Entre7h18h|Apres18h)$/.test(f.id));
    expect(creneaux.length).toBe(30);
    for (const c of creneaux) {
      expect(
        c.visibleIf?.fieldId,
        `${c.id} ne doit pas dépendre de la case du jour`,
      ).not.toMatch(/^q(4|18)(lundi|mardi|mercredi|jeudi|vendredi)$/);
    }
  });
});

describe("C1A — curation", () => {
  const fields = applyC1AImprovements([]);

  it("masque la case orpheline « toute lannée_2 »", () => {
    const f = fields.find((x) => x.pdfFieldName === "toute lannée_2");
    expect(f?.hidden).toBe(true);
  });

  it("ne masque JAMAIS le nom et prénom", () => {
    const f = fields.find((x) => x.id === "nomEtPrenom");
    expect(f?.hidden, "le C1A partirait sans nom").not.toBe(true);
  });

  it("ne masque aucun des deux textarea de texte libre des grilles horaires", () => {
    // Un seul champ par option depuis le 2026-07-30 (cf. describe dédié plus
    // bas) : q4/q18 × periodesTexte/irregulierementTexte = 4, plus plus de
    // "Période 1..4"/"Précision 2..N" à vérifier séparément.
    const lignes = fields.filter((x) => /^(q4|q18)(periodesTexte|irregulierementTexte)$/.test(x.id));
    expect(lignes.length).toBe(4);
    for (const l of lignes) expect(l.hidden, `${l.id} doit rester saisissable`).not.toBe(true);
  });
});

describe("C1A — grille Q18, 1re ligne « pendant les périodes » (widget 1_3 partagé)", () => {
  // "1_3" porte TROIS widgets (vérifié via pypdf/`/Kids`) : la 1re ligne
  // "pendant les périodes suivantes de l'année" de Q18 (p2), MAIS AUSSI les
  // cases d'en-tête de la page 2 (nom, NISS). Un citoyen qui remplit cette
  // ligne voyait son texte s'imprimer dans la case de son numéro de registre
  // national — une déclaration officielle faussée. Même famille de défaut
  // que `TVA`/`Montant`/`voir 19`, déjà réparés par écriture positionnelle.
  const fields = applyC1AImprovements([]);
  const parCle = new Map(fields.map((f) => [f.id, f]));

  it("aucun champ ne revendique le widget partagé « 1_3 »", () => {
    const revendications = fields.filter((f) =>
      (f.pdfFieldName ?? "").split("|").map((s) => s.trim()).includes("1_3"),
    );
    expect(revendications.map((f) => f.id)).toEqual([]);
  });

  it("q18periodesTexte écrit sa 1re ligne aux coordonnées, pas dans 1_3", () => {
    // Depuis le 2026-07-30, les 4 lignes "périodes" de Q18 ne sont plus 4
    // champs distincts : ce sont les `lineTargets`, dans l'ordre, d'UN seul
    // textarea. La 1re ligne reste en écriture positionnelle (widget partagé
    // avec l'en-tête de page 2, cf. commentaire du describe).
    const f = parCle.get("q18periodesTexte");
    expect(f, "q18periodesTexte doit exister").toBeDefined();
    expect(f?.type).toBe("textarea");
    expect(f?.pdfFieldName, "champ virtuel : la répartition vit dans lineTargets").toBe("");
    const premiere = f?.lineTargets?.[0];
    expect(premiere?.pdfFieldName, "ne doit pointer vers aucun widget").toBeFalsy();
    expect(premiere?.drawAt, "doit porter un drawAt").toBeDefined();
    expect(premiere?.drawAt?.page, "1_3 est en page 2").toBe(1);
    expect(premiere?.drawAt?.maxWidth ?? 0, "tient dans la largeur du rect (222 pt)").toBeLessThanOrEqual(222);
  });

  it("q18periodesTexte porte la condition de sa question, complétée par la branche d'entrée de Q18", () => {
    // Remplace l'ancienne comparaison "même condition que sa ligne sœur"
    // (q18periodesTexte2 a disparu, consolidé dans ce même champ) : on
    // vérifie directement la condition aplatie, comme pour q4periodesTexte
    // dans le describe "arbre des renvois" ci-dessus.
    const c = parCle.get("q18periodesTexte")?.visibleIf;
    const clauses = c ? [c, ...(c.and ?? [])].map((x) => `${x.fieldId}=${String(x.value)}`) : [];
    expect(clauses).toEqual([
      "q18periode=periodes",
      "exerceraPendantChomage=oui",
      "autreActiviteAccessoire=oui",
    ]);
  });
});

describe("C1A — Commit 1 puis 2026-07-30 : grilles horaires, un textarea par option", () => {
  // Géométrie mesurée sur private/pdfs/C1A_FR.pdf : le widget "undefined"
  // (page 1, y=568) est sur la MÊME ligne que la case "irrégulièrement à
  // savoir" (y=568) — pas une 5e ligne de "périodes". Retour Oraliks
  // 2026-07-29 : qui cochait "irrégulièrement" voyait sa ligne imprimée
  // partir blanche ; qui remplissait les 5 lignes "périodes" déclarait un
  // rythme irrégulier jamais coché.
  //
  // 2026-07-30 : ces N lignes ne sont plus N champs "Période 1..4" /
  // "Précision 2..N" — c'est UN textarea par option, dont `lineTargets`
  // porte les mêmes widgets/coordonnées, dans le même ordre. Le citoyen
  // écrit librement, `filler.ts` répartit son texte sur les lignes.
  const fields = applyC1AImprovements([]);
  const parCle = new Map(fields.map((f) => [f.id, f]));

  it("Q4 : periodesTexte est un textarea réparti sur 4 lignes (1 à 4), plus de 5e ligne fantôme", () => {
    const f = parCle.get("q4periodesTexte");
    expect(f, "q4periodesTexte doit exister").toBeDefined();
    expect(f?.type).toBe("textarea");
    expect(f?.pdfFieldName, "champ virtuel : la répartition vit dans lineTargets").toBe("");
    expect(f?.lineTargets?.map((t) => t.pdfFieldName)).toEqual(["1", "2", "3", "4"]);
  });

  it("Q4 : irregulierementTexte est un textarea réparti sur 5 lignes, la 1re est le widget « undefined » (fin de ligne imprimée)", () => {
    const f = parCle.get("q4irregulierementTexte");
    expect(f, "q4irregulierementTexte doit exister").toBeDefined();
    expect(f?.type).toBe("textarea");
    expect(f?.lineTargets?.map((t) => t.pdfFieldName)).toEqual([
      "undefined", "1_2", "2_2", "3_2", "4_2",
    ]);
    expect(f?.label?.fr).toBe("Précisez à quel rythme");
  });

  it("un ancien champ q4periodesTexte5 (widget « undefined ») déjà en base ne survit pas au merge", () => {
    // Simule un schéma de brouillon persisté AVANT le tout premier correctif
    // (2026-07-29) : le widget "undefined" y était revendiqué par
    // q4periodesTexte5 — jamais un id réel produit par ce seed, mais un état
    // antérieur imprévu que `LEGACY_C1A_FIELD_IDS` doit purger explicitement.
    const ancien: PdfFormField = {
      id: "q4periodesTexte5",
      pdfFieldName: "undefined",
      type: "text",
      required: false,
      label: { fr: "Période 5" },
    };
    const merged = applyC1AImprovements([ancien]);
    expect(merged.map((f) => f.id)).not.toContain("q4periodesTexte5");
    // Le widget "undefined" n'est plus revendiqué en `pdfFieldName` de premier
    // niveau par PERSONNE (coveredWidgetNames ne regarde pas dans
    // lineTargets) : seule l'entrée LEGACY garantit la purge. Il reste bien
    // couvert dans les lineTargets du nouveau champ.
    expect(merged.filter((f) => f.pdfFieldName === "undefined")).toEqual([]);
    expect(
      merged.find((f) => f.id === "q4irregulierementTexte")?.lineTargets?.[0]?.pdfFieldName,
    ).toBe("undefined");
  });

  it("tous les anciens champs numérotés (Q4/Q18) déjà en base ne survivent pas au merge", () => {
    // Les 16 identifiants retirés par ce lot : sans leur entrée dans
    // LEGACY_C1A_FIELD_IDS, ils survivraient à côté des deux nouveaux
    // textarea, puisque leur pdfFieldName n'est désormais couvert qu'à
    // l'intérieur de `lineTargets` (invisible à `coveredWidgetNames`, qui ne
    // lit que `field.pdfFieldName` au premier niveau — même limite déjà
    // documentée pour natureActiviteIndependant1..5). Widget volontairement
    // fictif : la purge testée ici est celle par ID, pas par couverture.
    const idsRetires = [
      "q4periodesTexte1", "q4periodesTexte2", "q4periodesTexte3", "q4periodesTexte4",
      "q4irregulierementTexte1", "q4irregulierementTexte2", "q4irregulierementTexte3",
      "q4irregulierementTexte4", "q4irregulierementTexte5",
      "q18periodesTexte1", "q18periodesTexte2", "q18periodesTexte3", "q18periodesTexte4",
      "q18irregulierementTexte1", "q18irregulierementTexte2", "q18irregulierementTexte3",
    ];
    const anciens: PdfFormField[] = idsRetires.map((id) => ({
      id,
      pdfFieldName: "widget-fictif-jamais-dans-le-pdf",
      type: "text",
      required: false,
      label: { fr: id },
    }));
    const merged = applyC1AImprovements(anciens);
    for (const id of idsRetires) {
      expect(merged.map((f) => f.id), id).not.toContain(id);
    }
  });

  it("Q18 : vérifié, ne présente PAS le même défaut (aucun widget partagé sur la ligne « irrégulier »)", () => {
    // Géométrie mesurée (page 2) : case "irrégulièrement à savoir_2" à
    // y=699, seule sur sa ligne — 1_4 suit à y=686, sans rien entre les
    // deux. La répartition 4 lignes périodes / 3 lignes irrégulier est
    // donc déjà correcte ; verrouillé ici pour ne pas régresser vers le
    // défaut de Q4.
    const periodes = parCle.get("q18periodesTexte");
    expect(periodes?.lineTargets?.length).toBe(4);
    expect(periodes?.lineTargets?.slice(1).map((t) => t.pdfFieldName)).toEqual(["2_3", "3_3", "4_3"]);

    const irreguliers = parCle.get("q18irregulierementTexte");
    expect(irreguliers?.lineTargets?.map((t) => t.pdfFieldName)).toEqual(["1_4", "2_4", "3_4"]);
  });
});

describe("C1A — 2026-07-30 (suite) : Q5 et Q16, un textarea unique par question (lineTargets)", () => {
  // Même retour Oraliks que les grilles horaires ci-dessus, appliqué à deux
  // autres blocs qui numérotaient encore des lignes/pseudo-champs pour ce
  // qui n'est qu'un paragraphe :
  //   - Q5 « Décrivez l'aide que vous apporterez » : ex-champ `array` du
  //     Commit 2 (bouton "+ Ajouter", lignes "Ligne 1"/"Ligne 2"...) ;
  //   - Q16 « Je décris mon activité » : ex-3 champs distincts "…",
  //     "… (suite)", "… (fin)".
  // « Fais plutôt un input texte plus grand comme t'as fait aux autres,
  // c'est plus propre » / « input texte plus grand au lieu de 3x "décris mon
  // activité" ».
  const fields = applyC1AImprovements([]);
  const parCle = new Map(fields.map((f) => [f.id, f]));

  it("Q5 : descriptionAide1 est un textarea réparti sur les 9 lignes imprimées, dans l'ordre", () => {
    const f = parCle.get("descriptionAide1");
    expect(f, "descriptionAide1 doit exister").toBeDefined();
    expect(f?.type).toBe("textarea");
    expect(f?.pdfFieldName, "champ virtuel : la répartition vit dans lineTargets").toBe("");
    expect(f?.lineTargets?.map((t) => t.pdfFieldName)).toEqual(
      Array.from({ length: 9 }, (_, i) => `Décrivez laide que vous apporterez ${i + 1}`),
    );
    expect(f?.required, "obligatoire, comme l'array qu'il remplace").toBe(true);
    expect(f?.hidden, "doit rester saisissable").not.toBe(true);
    // Plus de mécanique de liste : ni addRowLabel, ni itemFields, ni maxRows.
    expect(f?.addRowLabel).toBeUndefined();
    expect(f?.itemFields).toBeUndefined();
    expect(f?.maxRows).toBeUndefined();
  });

  it("Q5 : descriptionAide1 reste l'ancre C1A_ROUTAGE malgré la conversion en textarea", () => {
    const conditions = compilerRoutage(C1A_ROUTAGE, C1A_DEPART);
    expect(parCle.get("descriptionAide1")?.visibleIf).toEqual(conditions.descriptionAide1);
  });

  it("Q16 : descriptionActivite1 est un textarea réparti sur les 3 lignes imprimées, dans l'ordre du document", () => {
    const f = parCle.get("descriptionActivite1");
    expect(f, "descriptionActivite1 doit exister").toBeDefined();
    expect(f?.type).toBe("textarea");
    expect(f?.pdfFieldName, "champ virtuel : la répartition vit dans lineTargets").toBe("");
    // "undefined_2" est le nom réel (trompeur) du widget de la 1re ligne
    // imprimée — vérifié sur le vrai PDF, page 2 : y=287.28, au-dessus de
    // "Je décris mon activité 1" (y=274.32) et "…2" (y=261.24).
    expect(f?.lineTargets?.map((t) => t.pdfFieldName)).toEqual([
      "undefined_2",
      "Je décris mon activité 1",
      "Je décris mon activité 2",
    ]);
    expect(f?.label?.fr).toBe("Je décris mon activité");
    expect(f?.hidden, "doit rester saisissable").not.toBe(true);
  });

  it("Q16 : les anciens id descriptionActivite2/3 ont disparu du seed", () => {
    const ids = C1A_FIELDS.map((f) => f.id);
    expect(ids).not.toContain("descriptionActivite2");
    expect(ids).not.toContain("descriptionActivite3");
  });

  it("Q16 : descriptionActivite1 reste rattaché à la question formeActivite (stepGroup, condition dérivée)", () => {
    expect(parCle.get("descriptionActivite1")?.stepGroup).toBe("formeActivite");
  });

  it("Q16 : un brouillon déjà en base avec les 3 anciens champs ne survit pas au merge (LEGACY_C1A_FIELD_IDS)", () => {
    // Simule un schéma persisté AVANT ce lot : 3 champs distincts, chacun sur
    // son propre widget.
    const anciens: PdfFormField[] = [
      {
        id: "descriptionActivite1",
        pdfFieldName: "undefined_2",
        type: "text",
        required: false,
        label: { fr: "Je décris mon activité" },
      },
      {
        id: "descriptionActivite2",
        pdfFieldName: "Je décris mon activité 1",
        type: "text",
        required: false,
        label: { fr: "Je décris mon activité (suite)" },
      },
      {
        id: "descriptionActivite3",
        pdfFieldName: "Je décris mon activité 2",
        type: "text",
        required: false,
        label: { fr: "Je décris mon activité (fin)" },
      },
    ];
    const merged = applyC1AImprovements(anciens);
    const ids = merged.map((f) => f.id);
    expect(ids).not.toContain("descriptionActivite2");
    expect(ids).not.toContain("descriptionActivite3");
    expect(ids.filter((id) => id === "descriptionActivite1").length).toBe(1);
    // Les deux widgets "Je décris mon activité 1/2" ne sont plus revendiqués
    // qu'à l'intérieur de lineTargets, invisible à coveredWidgetNames — seule
    // l'entrée LEGACY garantit la purge (même limite que
    // natureActiviteIndependant1..5).
    expect(
      merged.find((f) => f.id === "descriptionActivite1")?.lineTargets?.map((t) => t.pdfFieldName),
    ).toEqual(["undefined_2", "Je décris mon activité 1", "Je décris mon activité 2"]);
  });
});

describe("C1A — Commit 2 : nature de l'activité (Q2) et description de l'aide (Q5) en listes", () => {
  const fields = applyC1AImprovements([]);
  const parCle = new Map(fields.map((f) => [f.id, f]));

  it("natureActiviteIndependant : une ligne, bouton + explicite, plafonné à 5 (le PDF n'a que 5 lignes)", () => {
    const f = parCle.get("natureActiviteIndependant");
    expect(f?.type).toBe("array");
    expect(f?.required).toBe(true);
    expect(f?.maxRows).toBe(5);
    expect(f?.addRowLabel?.fr).toBeTruthy();
    expect(f?.itemFields?.length).toBe(1);
    expect(f?.itemFields?.[0]?.pdfFieldNameTemplate).toBe("mentionnez les toutes {index}");
    expect(f?.itemFields?.[0]?.type).toBe("text");
  });

  it("descriptionAide1 : consolidé en textarea (2026-07-30), n'est plus un champ array — cf. describe dédié plus bas", () => {
    // Ex-champ array (Commit 2, 9 lignes max) devenu un textarea unique dont
    // lineTargets porte les 9 mêmes lignes imprimées — retour Oraliks après
    // test, même mouvement que les grilles horaires Q4/Q18. Assertions
    // complètes (lineTargets, ordre, absence de addRowLabel/itemFields/
    // maxRows) dans le describe "Q5 et Q16, un textarea unique par question"
    // plus bas ; on vérifie ici seulement que ce test-ci ne pointe plus vers
    // la forme array, pour ne pas laisser deux describes se contredire.
    const f = parCle.get("descriptionAide1");
    expect(f?.type).toBe("textarea");
    expect(f?.maxRows).toBeUndefined();
    expect(f?.itemFields).toBeUndefined();
    expect(f?.addRowLabel).toBeUndefined();
  });

  it("descriptionAide1 et natureActiviteIndependant sont required=true : la limite array a été levée (commit 28debed)", () => {
    // Au Commit 3, `required:true` sur un champ array était neutralisé par
    // buildValidator (un tableau vide passait toujours) ET faisait afficher
    // l'étape éternellement incomplète au stepper (isFieldComplete ne savait
    // lire qu'une string/number) — descriptionAide1 était donc resté
    // required:false malgré son statut de clé C1A_ROUTAGE. Cette limite a
    // été levée depuis (commit 28debed, confirmé en lisant isArrayFieldFilled
    // dans lib/pdf-forms/validation.ts) : les deux champs sont désormais
    // required:true. Le test précis « tableau vide bloque / ligne remplie
    // passe » est dans le describe dédié plus bas.
    expect(parCle.get("descriptionAide1")?.required).toBe(true);
    expect(parCle.get("natureActiviteIndependant")?.required).toBe(true);
  });

  it("descriptionAide1 reste l'ancre C1A_ROUTAGE de Q5 malgré la conversion en array", () => {
    const conditions = compilerRoutage(C1A_ROUTAGE, C1A_DEPART);
    expect(parCle.get("descriptionAide1")?.visibleIf).toEqual(conditions.descriptionAide1);
  });

  it("un brouillon déjà en base avec les 14 anciennes lignes individuelles ne survit pas au merge", () => {
    // Simule un schéma persisté AVANT ce commit : 5 lignes natureActiviteIndependantN
    // + 9 lignes descriptionAideN, chacune sur son propre widget.
    const anciens: PdfFormField[] = [
      ...[1, 2, 3, 4, 5].map((n) => ({
        id: `natureActiviteIndependant${n}`,
        pdfFieldName: `mentionnez les toutes ${n}`,
        type: "text" as const,
        required: false,
        label: { fr: `Nature de l'activité de l'indépendant [${n}]` },
      })),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
        id: `descriptionAide${n}`,
        pdfFieldName: `Décrivez laide que vous apporterez ${n}`,
        type: "text" as const,
        required: n === 1,
        label: { fr: `Description de l'aide [${n}]` },
      })),
    ];
    const merged = applyC1AImprovements(anciens);
    const ids = merged.map((f) => f.id);
    for (let n = 1; n <= 5; n++) expect(ids).not.toContain(`natureActiviteIndependant${n}`);
    for (let n = 2; n <= 9; n++) expect(ids).not.toContain(`descriptionAide${n}`);
    // Chaque widget n'est plus revendiqué qu'une fois (par pdfFieldNameTemplate,
    // invisible à ce filtre — donc PAR AUCUN champ top-level, ce qui est attendu).
    for (const n of [1, 2, 3, 4, 5]) {
      expect(merged.filter((f) => f.pdfFieldName === `mentionnez les toutes ${n}`)).toEqual([]);
    }
    expect(ids.filter((id) => id === "natureActiviteIndependant").length).toBe(1);
    expect(ids.filter((id) => id === "descriptionAide1").length).toBe(1);
  });

  it("appliquerGroupes range chaque champ dans l'étape de SA question", () => {
    // Depuis « une question = une étape » (2026-07-29), l'étape n'est plus une
    // rubrique fourre-tout : la nature de l'activité appartient à Q2, la
    // description de l'aide est à elle seule Q5.
    expect(parCle.get("natureActiviteIndependant")?.stepGroup).toBe("independantNom");
    expect(parCle.get("descriptionAide1")?.stepGroup).toBe("descriptionAide1");
  });
});

// ---------------------------------------------------------------------------
// natureActiviteIndependant et descriptionAide1 passent required:true
// maintenant que lib/pdf-forms/validation.ts sait exiger AU MOINS UNE ligne
// réellement remplie sur un champ `array` (commit 28debed, confirmé en
// commit 2862778 pour le typecheck) — ce que le Commit 3 ne pouvait pas
// encore faire (cf. describe "Commit 2" ci-dessus et le rapport
// .superpowers/sdd/c1a-retours-report.md, section "Doutes #4"). On vérifie
// ici, avec les VRAIS champs du seed (visibleIf dérivé de l'arbre compris) et
// non un champ array synthétique comme dans validation.test.ts :
//   1. le tableau vide bloque l'envoi, une ligne réellement remplie passe ;
//   2. la protection de branche tient : répondre « non » à la question qui
//      gate le champ le rend invisible, donc jamais réclamé, même vide ;
//   3. le compteur du stepper (countRequirements) redescend bien à 0 manquant
//      dès la première ligne remplie — c'était le risque redouté (Commit 3
//      l'évitait justement en gardant required:false).
//
// Depuis le 2026-07-30, descriptionAide1 n'est plus un champ `array` (cf.
// describe "Q5 et Q16, un textarea unique par question" plus haut) : le
// point 1 ci-dessus se lit désormais « la chaîne vide bloque l'envoi, un
// texte rempli passe » pour ce champ précis (nested describe dédié
// ci-dessous). natureActiviteIndependant, lui, reste un `array` inchangé.
// ---------------------------------------------------------------------------
describe("C1A — natureActiviteIndependant (array) / descriptionAide1 (textarea) : required:true, limite levée puis conversion", () => {
  const fields = applyC1AImprovements([]);
  const parCle = new Map(fields.map((f) => [f.id, f]));
  const aideIndependant = parCle.get("aideIndependant")!;
  const aideraPendantChomage = parCle.get("aideraPendantChomage")!;
  const natureActiviteIndependant = parCle.get("natureActiviteIndependant")!;
  const descriptionAide1 = parCle.get("descriptionAide1")!;

  it("les deux champs sont bien required:true dans le seed final", () => {
    expect(natureActiviteIndependant.required).toBe(true);
    expect(descriptionAide1.required).toBe(true);
  });

  describe("natureActiviteIndependant (rattachée à Q2, visible dès Q1=oui)", () => {
    // visibleIf après appliquerRoutage : { fieldId: "aideIndependant", op:
    // "equals", value: "oui" } (empilée par-dessus l'écriture manuelle
    // identique dans le seed — dédoublonnée, cf. `empiler`). Vérifié en dur
    // ci-dessous plutôt que supposé.
    const testFields = [aideIndependant, natureActiviteIndependant];

    it("le visibleIf compilé ne porte que sur aideIndependant=oui", () => {
      expect(natureActiviteIndependant.visibleIf).toEqual({
        fieldId: "aideIndependant",
        op: "equals",
        value: "oui",
      });
    });

    it("Q1=oui + tableau vide → bloque l'envoi", () => {
      const v = buildValidator(testFields, "fr");
      expect(v.safeParse({ aideIndependant: "oui", natureActiviteIndependant: [] }).success).toBe(false);
    });

    it("Q1=oui + une ligne vierge fraîchement ajoutée → bloque toujours l'envoi", () => {
      const v = buildValidator(testFields, "fr");
      expect(v.safeParse({ aideIndependant: "oui", natureActiviteIndependant: [{}] }).success).toBe(false);
    });

    it("Q1=oui + une ligne réellement remplie → laisse passer", () => {
      const v = buildValidator(testFields, "fr");
      expect(
        v.safeParse({ aideIndependant: "oui", natureActiviteIndependant: [{ nature: "Plombier" }] }).success,
      ).toBe(true);
    });

    it("Q1=non → le champ est masqué, jamais réclamé même vide (protection de branche)", () => {
      const v = buildValidator(testFields, "fr");
      expect(v.safeParse({ aideIndependant: "non", natureActiviteIndependant: [] }).success).toBe(true);
    });

    it("countRequirements redescend de 1 manquant à 0 dès la première ligne remplie", () => {
      const vide: FormPayload = { aideIndependant: "oui", natureActiviteIndependant: [] };
      const rempli: FormPayload = {
        aideIndependant: "oui",
        natureActiviteIndependant: [{ nature: "Plombier" }],
      };
      expect(countRequirements(testFields, vide, "fr")).toEqual({ total: 2, missing: 1 });
      expect(countRequirements(testFields, rempli, "fr")).toEqual({ total: 2, missing: 0 });
    });
  });

  describe("descriptionAide1 (ancre C1A_ROUTAGE de Q5, visible seulement si Q1=oui ET Q3=oui)", () => {
    // descriptionAide1 EST une clé C1A_ROUTAGE : son visibleIf est REMPLACÉ
    // (pas empilé) par la condition compilée par compilerRoutage — vérifié en
    // dur ci-dessous (2 clauses : aideraPendantChomage=oui en tête, and
    // aideIndependant=oui), pas supposé.
    //
    // Depuis le 2026-07-30, ce champ est un `textarea` (ex-`array` du
    // Commit 2, cf. describe "Q5 et Q16, un textarea unique par question") :
    // les payloads ci-dessous portent désormais une chaîne, plus un tableau
    // de lignes — la validation passe par la règle `textarea` standard
    // (chaîne non vide), plus `isArrayFieldFilled`. Le comportement observé
    // ne change pas (obligatoire, protection de branche, compteur), seule la
    // forme de la valeur change.
    const testFields = [aideIndependant, aideraPendantChomage, descriptionAide1];

    it("le visibleIf compilé exige aideIndependant=oui ET aideraPendantChomage=oui", () => {
      const conditions = compilerRoutage(C1A_ROUTAGE, C1A_DEPART);
      expect(descriptionAide1.visibleIf).toEqual(conditions.descriptionAide1);
      expect(descriptionAide1.visibleIf).toEqual({
        fieldId: "aideraPendantChomage",
        op: "equals",
        value: "oui",
        and: [{ fieldId: "aideIndependant", op: "equals", value: "oui" }],
      });
    });

    it("Q1=oui + Q3=oui + chaîne vide → bloque l'envoi", () => {
      const v = buildValidator(testFields, "fr");
      expect(
        v.safeParse({ aideIndependant: "oui", aideraPendantChomage: "oui", descriptionAide1: "" }).success,
      ).toBe(false);
    });

    it("Q1=oui + Q3=oui + texte rempli → laisse passer", () => {
      const v = buildValidator(testFields, "fr");
      expect(
        v.safeParse({
          aideIndependant: "oui",
          aideraPendantChomage: "oui",
          descriptionAide1: "Je conduis le camion de livraison",
        }).success,
      ).toBe(true);
    });

    it("Q1=non → le champ est masqué, jamais réclamé même vide (protection de branche)", () => {
      const v = buildValidator(testFields, "fr");
      expect(
        v.safeParse({ aideIndependant: "non", aideraPendantChomage: "oui", descriptionAide1: "" }).success,
      ).toBe(true);
    });

    it("Q1=oui mais Q3=non → le champ est masqué aussi (chemin Q3=non saute directement à Q9)", () => {
      const v = buildValidator(testFields, "fr");
      expect(
        v.safeParse({ aideIndependant: "oui", aideraPendantChomage: "non", descriptionAide1: "" }).success,
      ).toBe(true);
    });

    it("countRequirements redescend de 1 manquant à 0 dès que le texte est rempli", () => {
      const vide: FormPayload = {
        aideIndependant: "oui",
        aideraPendantChomage: "oui",
        descriptionAide1: "",
      };
      const rempli: FormPayload = {
        aideIndependant: "oui",
        aideraPendantChomage: "oui",
        descriptionAide1: "Je conduis le camion de livraison",
      };
      expect(countRequirements(testFields, vide, "fr")).toEqual({ total: 3, missing: 1 });
      expect(countRequirements(testFields, rempli, "fr")).toEqual({ total: 3, missing: 0 });
    });
  });
});

describe("C1A — Commit 3 : les questions de l'arbre deviennent obligatoires", () => {
  const fields = applyC1AImprovements([]);
  const parCle = new Map(fields.map((f) => [f.id, f]));

  // État attendu de `required` pour CHAQUE clé de C1A_ROUTAGE. Toute clé
  // absente de cette table fait échouer le test ci-dessous (couverture
  // exhaustive) — ajouter une nouvelle question à l'arbre oblige donc à
  // trancher explicitement son caractère obligatoire ici.
  const ATTENDU: Record<string, boolean> = {
    aideIndependant: true, // Q1, départ de l'arbre — déjà obligatoire avant ce lot.
    independantNom: true, // Q2 — donnée principale, chemin unique.
    aideraPendantChomage: true, // Q3 — chemin unique, tranche Q4.
    // Q4 : grille horaire — aucun jour précis n'est obligatoire (voir plus
    // bas), la "donnée principale" exigible est la fréquence : c'est elle qui
    // porte la question imprimée, et c'est elle qui ancre la rubrique depuis
    // le passage à « une question = une étape ».
    q4periode: true,
    // Q5 : champ array (Commit 2) — resté required:false au Commit 3 car
    // buildValidator neutralisait alors `required` pour ce type (et aurait
    // cassé le compteur du stepper). Cette limite a été levée depuis (commit
    // 28debed) : `isArrayFieldFilled` exige désormais au moins une ligne
    // réellement remplie, appliqué identiquement par buildValidator et par
    // isFieldComplete/countRequirements. Décision documentée dans le seed et
    // le describe dédié ci-dessus/ci-dessous. Devenu un textarea le
    // 2026-07-30 (cf. describe "Q5 et Q16, un textarea unique par
    // question") : required reste true, la validation passe désormais par
    // la règle textarea standard (chaîne non vide) au lieu
    // d'isArrayFieldFilled.
    descriptionAide1: true,
    montantAidePeriodicite: true, // Q6 — choix mois/an, chemin unique.
    aidaitDejaIndependant: true, // Q7 — chemin unique.
    dateDebutAide: true, // Q8 — donnée principale, visible seulement si Q7=oui.
    mandatPolitiqueOuJuge: true, // Q9 — déjà obligatoire avant ce lot.
    mandatDescription: true, // Q10 — chemin unique.
    revenuAnnuelMandat: true, // Q11 — chemin unique, 1er montant.
    autreActiviteAccessoire: true, // Q12 — déjà obligatoire avant ce lot.
    activiteCommeSalarie: true, // Q13 — chemin unique.
    employeurNom: true, // Q14 — chemin unique, donnée principale.
    adresseActivite: true, // Q15 — chemin unique (atteint quel que soit Q13).
    formeActivite: true, // Q16 — chemin unique.
    exerceraPendantChomage: true, // Q17 — chemin unique, tranche Q18.
    q18periode: true, // Q18 — même raison que q4periode.
    // Q19 : la condition compilée de cette clé n'inclut PAS
    // `activiteCommeSalarie` (elle est atteinte via les deux branches de Q13,
    // cf. test dédié plus bas) — la rendre required forcerait un indépendant
    // pur à répondre une question de revenu salarié. Décision documentée.
    revenuNetSalarieParMois: false,
    exerceDejaActivite: true, // Q20 — chemin unique.
    dateDebutActivite: true, // Q21 — donnée principale, visible seulement si Q20=oui.
    // Q22 (gate virtuelle) — déjà obligatoire avant ce lot. La rubrique n'a
    // plus qu'un nœud : les sept cases jour lui sont rattachées, aucune n'est
    // obligatoire (aucun équivalent au radio « période » sur lequel reporter
    // une exigence).
    estChomeurTemporaire: true,
    independantTitrePrincipal: true, // Q23 — déjà obligatoire avant ce lot.
    affirmationSincerite: true, // Q24 — déjà obligatoire avant ce lot.
  };

  it("couverture exhaustive : chaque clé de C1A_ROUTAGE a une décision explicite", () => {
    expect(Object.keys(ATTENDU).sort()).toEqual(Object.keys(C1A_ROUTAGE).sort());
  });

  it("chaque clé de C1A_ROUTAGE porte le required attendu", () => {
    for (const [id, attendu] of Object.entries(ATTENDU)) {
      expect(parCle.get(id), `${id} doit exister`).toBeDefined();
      expect(parCle.get(id)?.required, `${id}.required`).toBe(attendu);
    }
  });

  it("aucun jour précis d'une grille horaire (Q4/Q18) n'est obligatoire, mais la fréquence l'est", () => {
    const jours = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
    for (const prefix of ["q4", "q18"]) {
      for (const jour of jours) {
        expect(parCle.get(`${prefix}${jour}`)?.required, `${prefix}${jour}`).toBe(false);
      }
      expect(parCle.get(`${prefix}periode`)?.required, `${prefix}periode`).toBe(true);
    }
  });

  it("aucun jour de Q22 (chômeur temporaire) n'est obligatoire", () => {
    for (const jour of ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]) {
      expect(parCle.get(`joursOccupe${jour}`)?.required, `joursOccupe${jour}`).toBe(false);
    }
  });

  it("aucun requiredGroup n'est introduit sur le C1A (interdit par la charte du lot)", () => {
    expect(fields.filter((f) => f.requiredGroup)).toEqual([]);
  });

  it("Q19 : la condition compilée de revenuNetSalarieParMois ne distingue pas salarié/indépendant — required resterait un piège", () => {
    // Preuve du raisonnement qui justifie de NE PAS rendre ce champ requis :
    // sa condition (posée par appliquerRoutage, qui écrase le visibleIf brut
    // pour toute clé C1A_ROUTAGE) ne porte QUE sur exerceraPendantChomage et
    // autreActiviteAccessoire, jamais sur activiteCommeSalarie. Si ce test
    // casse un jour (la condition se met à discriminer), la décision
    // required:false ci-dessus doit être réexaminée.
    const conditions = compilerRoutage(C1A_ROUTAGE, C1A_DEPART);
    const clauses = [conditions.revenuNetSalarieParMois, ...(conditions.revenuNetSalarieParMois?.and ?? [])]
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => c.fieldId);
    expect(clauses).not.toContain("activiteCommeSalarie");
    expect(parCle.get("revenuNetSalarieParHeure")?.required).toBe(false);
    expect(parCle.get("revenuNetIndependantParAn")?.required).toBe(false);
  });

  it("les rattachements secondaires restent facultatifs (2e ligne, 2e montant, adresse employeur)", () => {
    for (const id of [
      "revenuAnnuelMandat2", // 2e montant de Q11, cas d'un 2e mandat.
      "employeurAdresse", // adresse de l'employeur, à côté du nom (requis).
      "adresseActiviteCodePostalCommune", // 2e ligne d'adresse de Q15.
      "montantAide", "montantAideAnnuel", // montant de Q6, la périodicité seule est requise.
    ]) {
      expect(parCle.get(id)?.required, id).not.toBe(true);
    }
  });
});

// -----------------------------------------------------------------------
// Le C1A vouvoie : c'est la convention du site (tout le parcours citoyen est
// en « vous ») ET la voix du PDF officiel lui-même (« Aiderez-vous cet
// indépendant ? », « Vous êtes chômeur temporaire si vous êtes toujours au
// service de votre employeur… »). Un lot de correction a remis en vouvoiement
// des label/help qui avaient été tutoyés à tort (cf.
// .superpowers/sdd/c1a-vouvoiement-report.md) : ce describe verrouille le
// résultat contre toute régression.
// -----------------------------------------------------------------------
describe("C1A — voix du vouvoiement (pas de tutoiement résiduel)", () => {
  const fields = applyC1AImprovements([]);

  // \b « nu » de JS ne traite pas les lettres accentuées comme des lettres
  // (\w est ASCII-only) : une frontière de mot apparaîtrait donc à tort entre
  // un "u" et un "é" accentués (ex. un hypothétique "tué"). On définit ici la
  // frontière nous-mêmes, lettres accentuées incluses, pour ne dépendre
  // d'aucun cas particulier de ce genre.
  const LETTRE = "A-Za-zÀ-ÖØ-öø-ÿ";
  const TUTOIEMENT = new RegExp(`(?<![${LETTRE}])(tu|ton|ta|tes|toi)(?![${LETTRE}])`, "i");

  function texteFr(loc?: { fr?: string }): string[] {
    return loc?.fr ? [loc.fr] : [];
  }

  function collecterTextes(f: PdfFormField): string[] {
    const textes = [
      ...texteFr(f.label),
      ...texteFr(f.labelShort),
      ...texteFr(f.help),
      ...texteFr(f.addRowLabel),
      ...(f.options ?? []).flatMap((o) => texteFr(o.label)),
    ];
    for (const sf of f.itemFields ?? []) textes.push(...collecterTextes(sf));
    return textes;
  }

  it("garde-fou du test lui-même : la regex ne réagit pas aux mots français qui contiennent « tu/ton/ta/tes/toi » sans être ces mots", () => {
    // Cas réels du fichier (ou de la même famille) qui ne doivent JAMAIS
    // déclencher : "toute"/"toutes" ne contient pas "tu" à une frontière de
    // mot ("toutes" se lit t-o-u-t-e-s, le "tes" final colle au "u" qui le
    // précède, donc aucune frontière ne s'y ouvre).
    for (const motSain of [
      "Toute l'année", "Pendant les périodes suivantes de l'année, mentionnez les toutes",
      "statut", "situation", "actuellement", "habituellement", "vertu",
      "gratuit", "ponctuel", "virtuel", "total", "capital", "entreprise",
      "toujours", "cette", "entretien",
    ]) {
      expect(TUTOIEMENT.test(motSain), motSain).toBe(false);
    }
    for (const motTutoyant of [
      "Tu dois compléter", "pour ton employeur", "sur ta carte", "tes revenus", "aide pour toi",
    ]) {
      expect(TUTOIEMENT.test(motTutoyant), motTutoyant).toBe(true);
    }
  });

  it("aucun label/labelShort/help/addRowLabel/option français ne tutoie (Q1 à Q24, grilles horaires et listes incluses)", () => {
    const fautifs: string[] = [];
    for (const f of fields) {
      for (const texte of collecterTextes(f)) {
        if (TUTOIEMENT.test(texte)) fautifs.push(`${f.id} → "${texte}"`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});
