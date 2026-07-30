import { describe, expect, it } from "vitest";
import {
  C1C_FIELDS,
  C1C_GROUPE_IDENTITE,
  C1C_QUESTIONS,
  applyC1CImprovements,
} from "../c1c-fields";

describe("C1C_FIELDS", () => {
  it("couvre l'identité, la description d'activité, le lieu d'exercice et la forme d'exercice", () => {
    const ids = C1C_FIELDS.map((f) => f.id);
    expect(ids).toContain("pr_nom_et_nom");
    expect(ids).toContain("niss");
    expect(ids).toContain("dateDebutActivite");
    expect(ids).toContain("descriptionActivite1");
    expect(ids).toContain("possedeSiteInternet");
    expect(ids).toContain("lieuExerciceActivite");
    expect(ids).toContain("formeExerciceActivite");
    expect(ids).toContain("numeroBcePersonnePhysique");
    expect(ids).toContain("numeroBceEntreprise");
    expect(ids).toContain("activiteExerceeParTiers");
    expect(ids).toContain("competencesProfessionnellesSpecifiques");
  });

  it("couvre les revenus, les activités antérieures, les affirmations, annexes et signature", () => {
    const ids = C1C_FIELDS.map((f) => f.id);
    expect(ids).toContain("revenuBrutAnnuel");
    expect(ids).toContain("revenuNetImposableAnnuel");
    expect(ids).toContain("activiteIndependanteAnterieure");
    expect(ids).toContain("descriptionActivitesAnterieures1");
    expect(ids).toContain("affirmationSincereEtComplete");
    expect(ids).toContain("annexes");
    expect(ids).toContain("dateSignature");
    expect(ids).toContain("signature");
  });

  it("les champs clés portent la bonne section", () => {
    const byId = new Map(C1C_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("pr_nom_et_nom")?.section).toBe("identite");
    expect(byId.get("niss")?.section).toBe("identite");
    expect(byId.get("descriptionActivite1")?.section).toBe("mes-activites");
    expect(byId.get("formeExerciceActivite")?.section).toBe("mes-activites");
    expect(byId.get("revenuBrutAnnuel")?.section).toBe("mes-revenus");
    expect(byId.get("revenuNetImposableAnnuel")?.section).toBe("mes-revenus");
    expect(byId.get("activiteIndependanteAnterieure")?.section).toBe("activites-anterieures");
    expect(byId.get("affirmationSincereEtComplete")?.section).toBe("affirmations");
    expect(byId.get("annexes")?.section).toBe("annexes");
    expect(byId.get("signature")?.section).toBe("signature");
  });

  it("les pdfFieldName des champs fusionnés (radio) pointent vers les vrais noms de widgets du dump", () => {
    const byId = new Map(C1C_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("possedeSiteInternet")?.pdfFieldName).toBe("non|oui www");
    expect(byId.get("lieuExerciceActivite")?.pdfFieldName).toBe("à ladresse de mon domicile|à une autre adresse");
    expect(byId.get("formeExerciceActivite")?.pdfFieldName).toBe(
      "toggle_5|société mandataire administrateur gérant ou associé actif"
    );
    expect(byId.get("activiteExerceeParTiers")?.pdfFieldName).toBe("non_2|oui");
    expect(byId.get("competencesProfessionnellesSpecifiques")?.pdfFieldName).toBe(
      "oui_2|non jai besoin dun tiers conjoint aidantfamilial mandataire pour me"
    );
    expect(byId.get("activiteIndependanteAnterieure")?.pdfFieldName).toBe("non_3|oui_3");
  });

  // -------------------------------------------------------------------------
  // Le défaut qui motivait le réalignement du 2026-07-30.
  // -------------------------------------------------------------------------
  it("chaque option d'un radio pipe est alignée sur SA case PDF (options[i] ↔ split('|')[i])", () => {
    // `stampPipeRadio` (filler.ts) apparie positionnellement. Trois radios du
    // C1C avaient des options rangées « oui, non » sur des cases imprimées
    // « non, oui » : répondre « oui » cochait « non » sur une déclaration
    // officielle. Le nom du widget de ces paires EST la réponse qu'il porte
    // (`non`, `oui_3`, `oui www`…) — c'est ce que ce test exploite.
    const normalise = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();

    const pipes = C1C_FIELDS.filter((f) => f.pdfFieldName?.includes("|"));
    expect(pipes.length, "le C1C compte 6 radios sur cases séparées").toBe(6);

    for (const f of pipes) {
      const noms = f.pdfFieldName!.split("|").map((s) => s.trim());
      expect(noms.length, `${f.id} : autant de cases que d'options`).toBe(f.options?.length);

      noms.forEach((nom, i) => {
        const valeur = f.options![i].value;
        // Le nom du widget COMMENCE par la réponse qu'il coche quand il la
        // nomme (« non_2 », « oui www », « non jai besoin dun tiers… »).
        // Les widgets nommés autrement (« toggle_5 », « à ladresse de mon
        // domicile ») ne portent aucune contradiction : rien à vérifier.
        const n = normalise(nom);
        const autre = f.options!.find((o) => o.value !== valeur)?.value;
        if (autre && (n === autre || n.startsWith(`${autre}_`) || n.startsWith(`${autre} `))) {
          throw new Error(
            `${f.id} : l'option « ${valeur} » (position ${i}) coche la case « ${nom} » — inversion.`
          );
        }
      });
    }
  });

  it("les trois questions binaires suivent l'ordre imprimé des cases : non, puis oui", () => {
    const byId = new Map(C1C_FIELDS.map((f) => [f.id, f]));
    for (const id of ["possedeSiteInternet", "activiteExerceeParTiers", "activiteIndependanteAnterieure"]) {
      expect(byId.get(id)?.options?.map((o) => o.value), `options de ${id}`).toEqual(["non", "oui"]);
    }
  });

  // -------------------------------------------------------------------------
  // Champ AcroForm `Nom de lentreprise` = TROIS widgets pour une seule valeur.
  // -------------------------------------------------------------------------
  it("le nom d'entreprise et les deux n° BCE sont écrits positionnellement, jamais par le nom du widget partagé", () => {
    const byId = new Map(C1C_FIELDS.map((f) => [f.id, f]));
    for (const id of ["nomEntreprise", "numeroBcePersonnePhysique", "numeroBceEntreprise"]) {
      const f = byId.get(id);
      expect(f?.pdfFieldName, `${id} ne doit revendiquer aucun widget`).toBe("");
      expect(f?.drawAt, `${id} doit être dessiné positionnellement`).toBeDefined();
      expect(f?.drawAt?.page).toBe(0);
    }
    // Aucun champ ne revendique le champ AcroForm partagé.
    expect(C1C_FIELDS.some((f) => f.pdfFieldName?.includes("Nom de lentreprise"))).toBe(false);
    // Les deux guides BCE sont des peignes de dix cases groupées 4-3-3.
    for (const id of ["numeroBcePersonnePhysique", "numeroBceEntreprise"]) {
      expect(byId.get(id)?.printAsComb?.groups).toEqual([4, 3, 3]);
      expect(byId.get(id)?.printAsComb?.slotWidth).toBeGreaterThan(0);
    }
    // Ordre de lecture du papier : BCE personne physique (y=265), nom de
    // l'entreprise (y=233,5), BCE de l'entreprise (y=217).
    expect(byId.get("numeroBcePersonnePhysique")!.drawAt!.y).toBeGreaterThan(
      byId.get("nomEntreprise")!.drawAt!.y
    );
    expect(byId.get("nomEntreprise")!.drawAt!.y).toBeGreaterThan(
      byId.get("numeroBceEntreprise")!.drawAt!.y
    );
  });

  it("les champs BCE ne s'affichent que pour la forme d'exercice qui les imprime", () => {
    const byId = new Map(C1C_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("numeroBcePersonnePhysique")?.visibleIf).toEqual({
      fieldId: "formeExerciceActivite",
      op: "equals",
      value: "personne-physique",
    });
    for (const id of ["nomEntreprise", "numeroBceEntreprise"]) {
      expect(byId.get(id)?.visibleIf).toEqual({
        fieldId: "formeExerciceActivite",
        op: "equals",
        value: "societe",
      });
    }
  });

  // -------------------------------------------------------------------------
  // Widgets dont le nom désigne le texte imprimé au-dessus, pas leur contenu.
  // -------------------------------------------------------------------------
  it("« Autre » vise fill_10, et la précision « tiers » vise le widget mal nommé de sa propre ligne", () => {
    const byId = new Map(C1C_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("formeExerciceAutre")?.pdfFieldName).toBe("fill_10");
    expect(byId.get("tiersPrecision")?.pdfFieldName).toBe(
      "Je dispose des compétences professionnelles spécifiques pour exercer mon activité"
    );
    expect(byId.get("tiersPrecision")?.visibleIf).toEqual({
      fieldId: "activiteExerceeParTiers",
      op: "equals",
      value: "oui",
    });
    // La question « compétences » reste une paire de cases, pas ce widget texte.
    expect(byId.get("competencesProfessionnellesSpecifiques")?.type).toBe("radio");
  });

  it("l'affirmation sur l'honneur est virtuelle : le papier n'imprime aucune case à cocher", () => {
    const f = C1C_FIELDS.find((x) => x.id === "affirmationSincereEtComplete");
    expect(f?.pdfFieldName).toBe("");
    expect(f?.type).toBe("checkbox");
    expect(f?.required).toBe(true);
    // Le widget qui portait ce nom appartient aux annexes.
    const annexes = C1C_FIELDS.find((x) => x.id === "annexes");
    expect(annexes?.lineTargets?.[0]?.pdfFieldName).toBe(
      "je communiquerai toute modification à mon organisme de paiement"
    );
  });

  // -------------------------------------------------------------------------
  // Une question imprimée = un champ, quel que soit le nombre de lignes.
  // -------------------------------------------------------------------------
  it("une question imprimée = UN champ, replié sur ses lignes physiques", () => {
    const byId = new Map(C1C_FIELDS.map((f) => [f.id, f]));
    // `type` attendu à l'écran. Les zones de RÉDACTION sont des textarea ;
    // « Je joins en annexe(s) » est un simple input texte (Oraliks
    // 2026-07-30, après vérification : on y liste des pièces, on n'y rédige
    // pas). Le repli sur les lignes imprimées ne dépend pas du type.
    const attendu: Record<string, { type: string; cibles: string[] }> = {
      descriptionActivite1: {
        type: "textarea",
        cibles: [
          "Je décris cidessous lactivité accessoire exercée 1",
          "Je décris cidessous lactivité accessoire exercée 2",
          "Je décris cidessous lactivité accessoire exercée 3",
        ],
      },
      adresseActiviteLigne1: { type: "textarea", cibles: ["undefined", "undefined_2"] },
      descriptionActivitesAnterieures1: {
        type: "textarea",
        cibles: [
          "Je décris précisément cidessous chaque activité exercée 1",
          "Je décris précisément cidessous chaque activité exercée 2",
        ],
      },
      annexes: {
        type: "text",
        cibles: [
          "je communiquerai toute modification à mon organisme de paiement",
          "Je joins en annexes 1",
          "Je joins en annexes 2",
        ],
      },
    };
    for (const [id, { type, cibles }] of Object.entries(attendu)) {
      const f = byId.get(id);
      expect(f?.type, `type de ${id}`).toBe(type);
      expect(f?.pdfFieldName, `${id} n'écrit que par ses lineTargets`).toBe("");
      expect(f?.lineTargets?.map((c) => c.pdfFieldName), `lignes de ${id}`).toEqual(cibles);
    }
  });

  it("les textes posés sur une ligne pointillée demandent l'abaissement sur le guide", () => {
    const byId = new Map(C1C_FIELDS.map((f) => [f.id, f]));
    for (const id of [
      "descriptionActivite1",
      "adresseActiviteLigne1",
      "tiersPrecision",
      "formeExerciceAutre",
      "descriptionActivitesAnterieures1",
      "annexes",
    ]) {
      expect(byId.get(id)?.alignTextToGuide, `${id} doit tomber sur les pointillés`).toBe(true);
    }
    // Le site internet est écrit par une RÈGLE serveur : son widget est nommé.
    expect(byId.get("siteInternetUrl")?.alignTextToGuide).toEqual([
      "Je dispose dun site internet pour mon activité",
    ]);
    // Les champs déjà POSITIONNELS placent leur ligne de base eux-mêmes.
    expect(byId.get("nomEntreprise")?.alignTextToGuide).toBeUndefined();
    expect(byId.get("numeroBcePersonnePhysique")?.alignTextToGuide).toBeUndefined();
  });

  it("les deux revenus sont formatés en montants (séparateur de milliers, deux décimales)", () => {
    const byId = new Map(C1C_FIELDS.map((f) => [f.id, f]));
    for (const id of ["revenuBrutAnnuel", "revenuNetImposableAnnuel"]) {
      expect(byId.get(id)?.type).toBe("number");
      expect(byId.get(id)?.numberFormat).toBe("money");
    }
  });

  it("applyC1CImprovements() est idempotent (pas de doublon si ré-appliqué)", () => {
    const once = applyC1CImprovements([]);
    const twice = applyC1CImprovements(once);
    expect(twice.length).toBe(once.length);
    expect(twice.length).toBe(C1C_FIELDS.length);
  });

  it("applyC1CImprovements() retire les anciens champs checkbox individuels désormais couverts par les radios fusionnés", () => {
    const rawInferred = [
      { id: "non", pdfFieldName: "non", type: "checkbox" as const, required: false, label: { fr: "non" } },
      { id: "oui_www", pdfFieldName: "oui www", type: "checkbox" as const, required: false, label: { fr: "oui: www" } },
      {
        id: "toggle_5",
        pdfFieldName: "toggle_5",
        type: "checkbox" as const,
        required: false,
        label: { fr: "personne physique" },
      },
      {
        id: "un_champ_non_touche",
        pdfFieldName: "un widget hors périmètre",
        type: "text" as const,
        required: false,
        label: { fr: "Non couvert par ce schéma" },
      },
    ];
    const result = applyC1CImprovements(rawInferred);
    const ids = result.map((f) => f.id);
    expect(ids).not.toContain("non");
    expect(ids).not.toContain("oui_www");
    expect(ids).not.toContain("toggle_5");
    // Un champ hors périmètre de ce schéma doit être préservé tel quel.
    expect(ids).toContain("un_champ_non_touche");
  });

  it("un schéma déjà en base issu de la version précédente ne laisse survivre aucun champ ligne-par-ligne", () => {
    // Les widgets de ces champs sont désormais atteints par `lineTargets` ou
    // par une écriture positionnelle : sans purge, ils se battraient avec les
    // nouveaux champs pour la même case du PDF officiel.
    const ancien = [
      "descriptionActivite2",
      "descriptionActivite3",
      "adresseActiviteLigne2",
      "descriptionActivitesAnterieures2",
      "annexesSuite",
      "numeroBce",
    ].map((id) => ({
      id,
      pdfFieldName: "peu importe",
      type: "text" as const,
      required: false,
      label: { fr: id },
    }));
    const ids = applyC1CImprovements(ancien).map((f) => f.id);
    for (const id of ancien.map((f) => f.id)) expect(ids, `${id} doit être purgé`).not.toContain(id);
    expect(ids.length).toBe(C1C_FIELDS.length);
  });

  it("le nombre total de champs après application correspond au nombre de champs enrichis définis", () => {
    const fields = applyC1CImprovements([]);
    expect(fields.length).toBe(C1C_FIELDS.length);
    expect(fields.length).toBe(24);
  });
});

describe("C1C — parcours à l'écran (une question = une étape)", () => {
  const groupes = () => new Map(applyC1CImprovements([]).map((f) => [f.id, f.stepGroup]));

  it("chaque question porte son PROPRE identifiant comme groupe — c'est ce qui en fait l'ancre de son étape", () => {
    const parChamp = groupes();
    for (const question of C1C_QUESTIONS) {
      expect(parChamp.get(question), `${question} doit ancrer son étape`).toBe(question);
    }
  });

  it("aucun champ ne reste sans groupe : rien ne tombe dans « Autres informations »", () => {
    const orphelins = applyC1CImprovements([])
      .filter((f) => !f.stepGroup)
      .map((f) => f.id);
    expect(orphelins).toEqual([]);
  });

  it("les précisions conditionnelles restent sur l'étape de LEUR question", () => {
    const parChamp = groupes();
    expect(parChamp.get("siteInternetUrl")).toBe("possedeSiteInternet");
    expect(parChamp.get("adresseActiviteLigne1")).toBe("lieuExerciceActivite");
    expect(parChamp.get("nomEntreprise")).toBe("formeExerciceActivite");
    expect(parChamp.get("numeroBcePersonnePhysique")).toBe("formeExerciceActivite");
    expect(parChamp.get("numeroBceEntreprise")).toBe("formeExerciceActivite");
    expect(parChamp.get("formeExerciceAutre")).toBe("formeExerciceActivite");
    expect(parChamp.get("tiersPrecision")).toBe("activiteExerceeParTiers");
    expect(parChamp.get("descriptionActivitesAnterieures1")).toBe("activiteIndependanteAnterieure");
    // Le papier pose UNE question et ouvre deux lignes de revenus.
    expect(parChamp.get("revenuNetImposableAnnuel")).toBe("revenuBrutAnnuel");
    // Bas du formulaire d'un seul tenant : affirmation, annexes, date, signature.
    expect(parChamp.get("annexes")).toBe("affirmationSincereEtComplete");
    expect(parChamp.get("dateSignature")).toBe("affirmationSincereEtComplete");
    expect(parChamp.get("signature")).toBe("affirmationSincereEtComplete");
  });

  it("l'identité forme son propre groupe d'en-tête, hors des questions", () => {
    const parChamp = groupes();
    expect(parChamp.get("pr_nom_et_nom")).toBe(C1C_GROUPE_IDENTITE);
    expect(parChamp.get("niss")).toBe(C1C_GROUPE_IDENTITE);
    expect(C1C_QUESTIONS).not.toContain(C1C_GROUPE_IDENTITE);
  });

  it("l'identité est héritée du dossier : dans un dossier, l'étape disparaît au lieu d'être redemandée", () => {
    const byId = new Map(applyC1CImprovements([]).map((f) => [f.id, f]));
    expect(byId.get("pr_nom_et_nom")?.inheritedFromDossier).toBe(true);
    expect(byId.get("niss")?.inheritedFromDossier).toBe(true);
    // `hidden`/`autoAnswered` posés EN DUR sont exclus : sur l'URL publique du
    // C1C il n'y a aucun C1 dont hériter, et la déclaration partirait sans nom
    // (cf. dossier-inheritance.ts).
    expect(byId.get("pr_nom_et_nom")?.hidden).toBeFalsy();
    expect(byId.get("pr_nom_et_nom")?.autoAnswered).toBeFalsy();
    expect(byId.get("niss")?.autoAnswered).toBeFalsy();
    // Et ils restent obligatoires dans le schéma STOCKÉ : une soumission sans
    // identité est refusée côté serveur plutôt que produire un PDF anonyme.
    expect(byId.get("pr_nom_et_nom")?.required).toBe(true);
    expect(byId.get("niss")?.required).toBe(true);
  });

  it("l'ordre des questions est celui du document (contrôlé par les `order` du schéma)", () => {
    const parOrdre = applyC1CImprovements([])
      .filter((f) => C1C_QUESTIONS.includes(f.id))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((f) => f.id);
    expect(parOrdre).toEqual([...C1C_QUESTIONS]);
  });
});
