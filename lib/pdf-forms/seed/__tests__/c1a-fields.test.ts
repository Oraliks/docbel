import { describe, expect, it } from "vitest";
import { C1A_FIELDS, applyC1AImprovements } from "../c1a-fields";
import { compilerRoutage } from "../../routing";
import { C1A_ROUTAGE, C1A_DEPART } from "../c1a-routing";
import type { PdfFormField } from "../../types";

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

  it("Q5 : description de l'aide est un champ array de 9 lignes max (Commit 2)", () => {
    const byId = new Map(C1A_FIELDS.map((f) => [f.id, f]));
    const f = byId.get("descriptionAide1");
    expect(f, "descriptionAide1 doit exister").toBeDefined();
    expect(f?.type).toBe("array");
    expect(f?.maxRows).toBe(9);
    expect(f?.addRowLabel?.fr).toBeTruthy();
    expect(f?.itemFields?.map((sf) => sf.pdfFieldNameTemplate)).toEqual([
      "Décrivez laide que vous apporterez {index}",
    ]);
    // Les anciennes lignes 2 à 9 ont disparu (descriptionAide1 reste, seul,
    // comme ancre C1A_ROUTAGE de Q5).
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
    // vivent désormais dans `itemFields`, pas dans C1A_FIELDS — d'où un total
    // top-level plus bas qu'avant (117 au moment d'écrire ce test).
    expect(C1A_FIELDS.length).toBeGreaterThan(110);
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
    expect(conditions.q4lundi).toEqual({
      fieldId: "aideraPendantChomage",
      op: "equals",
      value: "oui",
      and: [{ fieldId: "aideIndependant", op: "equals", value: "oui" }],
    });
  });

  it("le schéma porte les conditions compilées", () => {
    expect(parCle.get("q4lundi")?.visibleIf).toEqual(conditions.q4lundi);
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
    // (Q16) : le dédoublonnage ne doit rien empiler.
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
    expect(clauses("q4periodesTexte1")).toEqual([
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

  it("ne masque aucune ligne de texte libre des grilles horaires", () => {
    const lignes = fields.filter((x) => /^(q4|q18)(periodesTexte|irregulierementTexte)/.test(x.id));
    expect(lignes.length).toBeGreaterThan(10);
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

  it("q18periodesTexte1 est écrit aux coordonnées de sa ligne, pas dans 1_3", () => {
    const f = parCle.get("q18periodesTexte1");
    expect(f, "q18periodesTexte1 doit exister").toBeDefined();
    expect(f?.pdfFieldName, "ne doit pointer vers aucun widget").toBe("");
    expect(f?.drawAt, "doit porter un drawAt").toBeDefined();
    expect(f?.drawAt?.page, "1_3 est en page 2").toBe(1);
    expect(f?.drawAt?.maxWidth ?? 0, "tient dans la largeur du rect (222 pt)").toBeLessThanOrEqual(222);
  });

  it("q18periodesTexte1 garde la même condition d'affichage que ses lignes sœurs", () => {
    // Le passage en drawAt ne doit pas casser le rattachement à l'arbre :
    // toujours conditionné par le choix "periodes" de la grille Q18, comme
    // q18periodesTexte2/3/4 restées sur widget.
    expect(parCle.get("q18periodesTexte1")?.visibleIf).toEqual(
      parCle.get("q18periodesTexte2")?.visibleIf,
    );
  });
});

describe("C1A — Commit 1 : coupure périodes / irrégulier de la grille horaire", () => {
  // Géométrie mesurée sur private/pdfs/C1A_FR.pdf : le widget "undefined"
  // (page 1, y=568) est sur la MÊME ligne que la case "irrégulièrement à
  // savoir" (y=568) — pas une 5e ligne de "périodes". Retour Oraliks
  // 2026-07-29 : qui cochait "irrégulièrement" voyait sa ligne imprimée
  // partir blanche ; qui remplissait les 5 lignes "périodes" déclarait un
  // rythme irrégulier jamais coché.
  const fields = applyC1AImprovements([]);
  const parCle = new Map(fields.map((f) => [f.id, f]));

  it("Q4 : 4 lignes « périodes » (1 à 4), plus de 5e ligne fantôme", () => {
    const ids = ["q4periodesTexte1", "q4periodesTexte2", "q4periodesTexte3", "q4periodesTexte4"];
    for (const id of ids) expect(parCle.get(id), id).toBeDefined();
    expect(parCle.has("q4periodesTexte5")).toBe(false);
    expect(ids.map((id) => parCle.get(id)?.pdfFieldName)).toEqual(["1", "2", "3", "4"]);
  });

  it("Q4 : 5 lignes « irrégulièrement », la 1re est le widget « undefined » (fin de ligne imprimée)", () => {
    const ids = [
      "q4irregulierementTexte1", "q4irregulierementTexte2", "q4irregulierementTexte3",
      "q4irregulierementTexte4", "q4irregulierementTexte5",
    ];
    for (const id of ids) expect(parCle.get(id), id).toBeDefined();
    expect(ids.map((id) => parCle.get(id)?.pdfFieldName)).toEqual([
      "undefined", "1_2", "2_2", "3_2", "4_2",
    ]);
    expect(parCle.get("q4irregulierementTexte1")?.label?.fr).toBe("Précise à quel rythme");
  });

  it("un ancien champ q4periodesTexte5 (widget « undefined ») déjà en base ne survit pas au merge", () => {
    // Simule un schéma de brouillon persisté AVANT ce correctif : le widget
    // "undefined" y était revendiqué par q4periodesTexte5.
    const ancien: PdfFormField = {
      id: "q4periodesTexte5",
      pdfFieldName: "undefined",
      type: "text",
      required: false,
      label: { fr: "Période 5" },
    };
    const merged = applyC1AImprovements([ancien]);
    expect(merged.map((f) => f.id)).not.toContain("q4periodesTexte5");
    // Le widget "undefined" n'est plus revendiqué qu'une fois, par le champ désormais correct.
    const revendications = merged.filter((f) => f.pdfFieldName === "undefined");
    expect(revendications.map((f) => f.id)).toEqual(["q4irregulierementTexte1"]);
  });

  it("Q18 : vérifié, ne présente PAS le même défaut (aucun widget partagé sur la ligne « irrégulier »)", () => {
    // Géométrie mesurée (page 2) : case "irrégulièrement à savoir_2" à
    // y=699, seule sur sa ligne — 1_4 suit à y=686, sans rien entre les
    // deux. La répartition 4 lignes périodes / 3 lignes irrégulier est
    // donc déjà correcte ; verrouillé ici pour ne pas régresser vers le
    // défaut de Q4.
    const periodes = ["q18periodesTexte1", "q18periodesTexte2", "q18periodesTexte3", "q18periodesTexte4"];
    for (const id of periodes) expect(parCle.get(id), id).toBeDefined();
    expect(parCle.has("q18periodesTexte5")).toBe(false);
    expect(periodes.slice(1).map((id) => parCle.get(id)?.pdfFieldName)).toEqual(["2_3", "3_3", "4_3"]);

    const irreguliers = ["q18irregulierementTexte1", "q18irregulierementTexte2", "q18irregulierementTexte3"];
    for (const id of irreguliers) expect(parCle.get(id), id).toBeDefined();
    expect(parCle.has("q18irregulierementTexte4")).toBe(false);
    expect(irreguliers.map((id) => parCle.get(id)?.pdfFieldName)).toEqual(["1_4", "2_4", "3_4"]);
  });
});

describe("C1A — Commit 2 : nature de l'activité (Q2) et description de l'aide (Q5) en listes", () => {
  const fields = applyC1AImprovements([]);
  const parCle = new Map(fields.map((f) => [f.id, f]));

  it("natureActiviteIndependant : une ligne, bouton + explicite, plafonné à 5 (le PDF n'a que 5 lignes)", () => {
    const f = parCle.get("natureActiviteIndependant");
    expect(f?.type).toBe("array");
    expect(f?.required).toBe(false);
    expect(f?.maxRows).toBe(5);
    expect(f?.addRowLabel?.fr).toBeTruthy();
    expect(f?.itemFields?.length).toBe(1);
    expect(f?.itemFields?.[0]?.pdfFieldNameTemplate).toBe("mentionnez les toutes {index}");
    expect(f?.itemFields?.[0]?.type).toBe("text");
  });

  it("descriptionAide1 : une ligne, bouton + explicite, plafonné à 9 (le PDF n'a que 9 lignes)", () => {
    const f = parCle.get("descriptionAide1");
    expect(f?.type).toBe("array");
    expect(f?.maxRows).toBe(9);
    expect(f?.addRowLabel?.fr).toBeTruthy();
    expect(f?.itemFields?.length).toBe(1);
    expect(f?.itemFields?.[0]?.pdfFieldNameTemplate).toBe("Décrivez laide que vous apporterez {index}");
  });

  it("descriptionAide1 reste required=false : type array neutralisé par buildValidator/isFieldComplete", () => {
    // required:true sur un champ array ne bloque pas l'avancée (buildValidator
    // le neutralise volontairement) ET ferait afficher l'étape éternellement
    // incomplète au stepper (isFieldComplete ne sait lire qu'une string/number).
    // Décision documentée dans le seed ; pas de changement à validation.ts.
    expect(parCle.get("descriptionAide1")?.required).toBe(false);
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

  it("appliquerGroupes range toujours les deux champs dans l'étape aide-independant", () => {
    expect(parCle.get("natureActiviteIndependant")?.stepGroup).toBe("aide-independant");
    expect(parCle.get("descriptionAide1")?.stepGroup).toBe("aide-independant");
  });
});
