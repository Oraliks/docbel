import { describe, expect, it } from "vitest";
import {
  C46_FIELDS,
  C46_GROUPE_IDENTITE,
  C46_QUESTIONS,
  applyC46Improvements,
} from "../c46-fields";

describe("C46_FIELDS", () => {
  it("couvre l'identité, les trois mandats, les annexes et la signature", () => {
    const ids = C46_FIELDS.map((f) => f.id);
    expect(ids).toContain("nom_et_pr_nom");
    expect(ids).toContain("niss");
    for (const n of [1, 2, 3]) {
      expect(ids).toContain(`organisme${n}`);
      expect(ids).toContain(`moniteurBelgeDate${n}`);
    }
    expect(ids).toContain("nominations_suivantes_1");
    expect(ids).toContain("aujourd_hui");
    expect(ids).toContain("signature");
  });

  it("ne garde AUCUN champ du mapping décalé d'origine", () => {
    // Les widgets « Moniteur Belge du » sont en réalité les lignes
    // d'ORGANISME 2 et 3 (cf. l'en-tête du seed), et `date39_af_date`, libellé
    // « date de signature », portait les TROIS guides de date de la page 1.
    const ids = C46_FIELDS.map((f) => f.id);
    for (const mort of [
      "lorganismes_suivants",
      "publicationMoniteurBelge",
      "moniteur_belge_du",
      "moniteur_belge_du_2",
      "date39_af_date",
      "nominations_suivantes_2",
      "nominations_suivantes_5",
    ]) {
      expect(ids, `champ mort encore présent : ${mort}`).not.toContain(mort);
    }
  });

  it("les trois lignes d'organisme visent les widgets réels, malgré leurs noms trompeurs", () => {
    const byId = new Map(C46_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("organisme1")?.pdfFieldName).toBe("lorganismes suivants");
    // ⚠ Ces deux-là s'APPELLENT « Moniteur Belge du » et reçoivent pourtant un
    // nom d'organisme : dans les AcroForms de l'ONEM, un widget porte le nom du
    // texte imprimé AU-DESSUS de lui. C'est la géométrie qui tranche
    // (widget-geometry.test.ts), jamais le nom.
    expect(byId.get("organisme2")?.pdfFieldName).toBe("Moniteur Belge du");
    expect(byId.get("organisme3")?.pdfFieldName).toBe("Moniteur Belge du_2");
    for (const n of [1, 2, 3]) {
      expect(byId.get(`organisme${n}`)?.type).toBe("text");
    }
  });

  it("les trois dates « Moniteur belge » sont écrites en positionnel, une par ligne", () => {
    const byId = new Map(C46_FIELDS.map((f) => [f.id, f]));
    // Un seul champ AcroForm (`Date39_af_date`) porte les trois guides : le
    // revendiquer par son nom imprimerait la même date aux trois endroits.
    const ys = [1, 2, 3].map((n) => byId.get(`moniteurBelgeDate${n}`)!);
    for (const champ of ys) {
      expect(champ.pdfFieldName).toBe("");
      expect(champ.type).toBe("date");
      expect(champ.printAsComb?.groups).toEqual([2, 2, 4]);
      expect(champ.drawAt?.page).toBe(0);
    }
    // Trois ordonnées DISTINCTES et décroissantes (ordre de lecture).
    expect(ys[0].drawAt!.y).toBeGreaterThan(ys[1].drawAt!.y);
    expect(ys[1].drawAt!.y).toBeGreaterThan(ys[2].drawAt!.y);
    expect(
      C46_FIELDS.filter((f) => f.pdfFieldName === "Date39_af_date"),
      "aucun champ ne doit revendiquer le champ AcroForm partagé"
    ).toHaveLength(0);
  });

  it("les mandats 2 et 3 ne s'affichent qu'une fois le précédent renseigné", () => {
    const byId = new Map(C46_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("organisme1")?.required).toBe(true);
    expect(byId.get("organisme1")?.visibleIf).toBeUndefined();
    expect(byId.get("organisme3")?.visibleIf?.fieldId).toBe("organisme2");
    expect(byId.get("moniteurBelgeDate2")?.visibleIf?.fieldId).toBe("organisme2");
    expect(byId.get("moniteurBelgeDate3")?.visibleIf?.fieldId).toBe("organisme3");
  });

  it("les cinq lignes d'annexe sont UN textarea replié, pas cinq champs", () => {
    const annexes = C46_FIELDS.find((f) => f.id === "nominations_suivantes_1")!;
    expect(annexes.type).toBe("textarea");
    expect(annexes.pdfFieldName).toBe("");
    expect(annexes.lineTargets?.map((c) => c.pdfFieldName)).toEqual([
      "nominations suivantes 1",
      "nominations suivantes 2",
      "nominations suivantes 3",
      "nominations suivantes 4",
      "nominations suivantes 5",
    ]);
  });

  it("la date de signature est celle de la PAGE 2, et elle n'est plus masquée", () => {
    const byId = new Map(C46_FIELDS.map((f) => [f.id, f]));
    const date = byId.get("aujourd_hui");
    // Elle était `hidden`, décrite comme un « tampon de réception » : sa case
    // partait blanche sur chaque C46 généré.
    expect(date?.hidden).toBeUndefined();
    expect(date?.pdfFieldName).toBe("AUJOURD'HUI");
    expect(date?.type).toBe("date");
    expect(date?.prefillFrom).toBe("system.today");
    expect(date?.printAsComb?.groups).toEqual([2, 2, 4]);
    expect(byId.get("signature")?.required).toBe(true);
    expect(byId.get("signature")?.type).toBe("signature");
  });

  it("le NISS s'écrit un chiffre par case du peigne imprimé", () => {
    const niss = C46_FIELDS.find((f) => f.id === "niss")!;
    expect(niss.printAsComb?.groups).toEqual([6, 3, 2]);
    expect(niss.printAsComb?.slotWidth).toBeGreaterThan(0);
  });

  it("chaque champ porte un stepGroup connu de l'ordre des étapes", () => {
    const groupes = new Set([C46_GROUPE_IDENTITE, ...C46_QUESTIONS]);
    for (const f of applyC46Improvements([])) {
      expect(f.stepGroup, `champ « ${f.id} » sans étape`).toBeTruthy();
      expect(groupes, `champ « ${f.id} » dans un groupe hors ordre`).toContain(f.stepGroup);
    }
  });

  it("chaque question a pour ancre un champ de même identifiant", () => {
    const ids = new Set(C46_FIELDS.map((f) => f.id));
    for (const q of C46_QUESTIONS) expect(ids, `question « ${q} »`).toContain(q);
  });

  it("le total de champs correspond au schéma attendu (11 champs)", () => {
    // 2 identité + 3 organismes + 3 dates « Moniteur belge » + 1 textarea
    // d'annexes + 1 date de signature + 1 signature. Les 13 widgets du PDF s'y
    // ramènent : les cinq lignes d'annexe fusionnent en un seul champ, et les
    // trois guides de date, qui partagent UN champ AcroForm, en font trois.
    expect(C46_FIELDS.length).toBe(11);
  });

  it("applyC46Improvements() est idempotent (pas de doublon si ré-appliqué)", () => {
    const once = applyC46Improvements([]);
    const twice = applyC46Improvements(once);
    expect(twice.length).toBe(once.length);
    expect(twice.length).toBe(C46_FIELDS.length);
  });

  it("applyC46Improvements() purge les champs du mapping décalé restés en base", () => {
    const enBase = [
      "lorganismes_suivants",
      "publicationMoniteurBelge",
      "moniteur_belge_du",
      "moniteur_belge_du_2",
      "date39_af_date",
      "nominations_suivantes_3",
    ].map((id) => ({
      id,
      pdfFieldName: id,
      type: "text" as const,
      required: false,
      label: { fr: id },
    }));
    const ids = applyC46Improvements(enBase).map((f) => f.id);
    for (const mort of enBase.map((f) => f.id)) {
      expect(ids, `champ mort survivant : ${mort}`).not.toContain(mort);
    }
    expect(ids).toContain("organisme1");
  });

  it("applyC46Improvements() retire les anciens champs bruts couverts par un id redéfini et préserve le reste", () => {
    const bruts = [
      {
        id: "nom_et_pr_nom",
        pdfFieldName: "Nom et prénom",
        type: "text" as const,
        required: false,
        label: { fr: "undefined" },
      },
      {
        id: "champInconnu",
        pdfFieldName: "un widget non listé ici",
        type: "text" as const,
        required: false,
        label: { fr: "Champ préservé" },
      },
    ];
    const result = applyC46Improvements(bruts);
    const ids = result.map((f) => f.id);
    expect(ids).toContain("champInconnu");
    expect(ids.filter((id) => id === "nom_et_pr_nom")).toHaveLength(1);
    expect(result.length).toBe(C46_FIELDS.length + 1);
  });
});
