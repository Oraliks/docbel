import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PdfFormField } from "../types";
import inventaire from "./fixtures/comb-guides.json";

import { applyC1Improvements } from "../seed/c1-fields-improvements";
import { applyC1RegisImprovements } from "../seed/c1-regis-fields";
import { applyC1PartenaireImprovements } from "../seed/c1-partenaire-fields";
import { applyC1AImprovements } from "../seed/c1a-fields";
import { applyC1BImprovements } from "../seed/c1b-fields";
import { applyC1CImprovements } from "../seed/c1c-fields";
import { applyC46Improvements } from "../seed/c46-fields";
import { applyC47Improvements } from "../seed/c47-fields";
import { parsePdf } from "../acroform-parser";
import { fillForm } from "../filler";
import { resolveStamps } from "../bindings/engine";
import { getRulesForSlug } from "../bindings/registry";
import { getCombWidgetsForSlug } from "../bindings/comb-widgets";
import { visiblePayload } from "../validation";

/// UN GUIDE EN PEIGNE RÉCLAME UN PEIGNE.
///
/// Les formulaires ONEM impriment souvent, sous une case à remplir, une suite
/// de petites cases : « __ __ / __ __ / __ __ __ __ » pour une date, onze pour
/// un NISS. Y écrire la valeur d'un bloc superpose le texte au guide et laisse
/// les dernières cases vides à droite — le citoyen envoie à l'ONEM une
/// déclaration où sa date de naissance chevauche les barres obliques imprimées.
///
/// Ce défaut est apparu CINQ fois entre le 2026-07-27 et le 2026-08-02, sur
/// cinq champs de trois documents, et à chaque fois il a fallu qu'un humain
/// ouvre un PDF généré pour le voir. Les trois garde-fous existants sont
/// aveugles par construction :
///
///   • `seeds-vs-pdf`      vérifie qu'un nom de widget EXISTE ;
///   • `widget-geometry`   que l'ordre déclaré suit l'ordre de lecture ;
///   • la recette          qu'une case est SERVIE, pas comment.
///
/// Aucun ne regarde ce qui est IMPRIMÉ sous la case. Celui-ci le fait, à partir
/// de l'inventaire relevé sur les PDF réels par
/// `scripts/detect-comb-guides.py` (ré-exécutable : les PDF sont versionnés).
const FIXTURE = "scripts/detect-comb-guides.py";

interface Cible {
  slug: string;
  pdf: string;
  improve: (fields: PdfFormField[], ctx?: { technicalSchema: never[] }) => PdfFormField[];
}

const CIBLES: Cible[] = [
  {
    slug: "c1-changement-situation",
    pdf: "C1_FR.pdf",
    improve: (f) => applyC1Improvements(f, { defaultMotif: "modification", restrictMotifTo5Situations: true }),
  },
  { slug: "c1-regis", pdf: "Annexe_Regis_FR.pdf", improve: applyC1RegisImprovements },
  { slug: "c1-partenaire", pdf: "C1-Partenaire_FR.pdf", improve: applyC1PartenaireImprovements },
  { slug: "c1a", pdf: "C1A_FR.pdf", improve: applyC1AImprovements },
  { slug: "c1b", pdf: "C1B_FR.pdf", improve: applyC1BImprovements },
  { slug: "c1c", pdf: "C1C_FR.pdf", improve: applyC1CImprovements },
  { slug: "c46", pdf: "C46_FR.pdf", improve: applyC46Improvements },
  { slug: "c47", pdf: "C47_FR.pdf", improve: applyC47Improvements },
];

/// Types qui écrivent du TEXTE dans la case. Une case à cocher posée au-dessus
/// d'une ligne pointillée n'a évidemment pas besoin d'un peigne.
const TYPES_TEXTE = new Set([
  "text",
  "textarea",
  "date",
  "niss",
  "bce",
  "iban",
  "number",
  "email",
  "phone_be",
  "postal_be",
  "fullname",
]);

/// Guides SANS peigne, assumés. Chaque entrée dit pourquoi — sinon ce test
/// devient une liste d'exemptions que plus personne ne relit.
const SANS_PEIGNE_ASSUME: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "c1-partenaire": {
    niss_partenaire:
      "la case accepte « NISS OU date de naissance » : un peigne 6-3-2 " +
      "éparpillerait « 01/01/2005 » sur une grille de registre national.",
  },
};

function nomsDeWidgets(f: PdfFormField): string[] {
  const noms = (f.pdfFieldName ?? "").split("|").map((n) => n.trim()).filter(Boolean);
  for (const cible of f.lineTargets ?? []) {
    if (cible.pdfFieldName) noms.push(cible.pdfFieldName);
  }
  return noms;
}

describe("guides imprimés en peigne ↔ champs du seed", () => {
  for (const cible of CIBLES) {
    it(`${cible.slug} : tout champ posé sur un guide en peigne en déclare un`, async ({ skip }) => {
      const chemin = join(process.cwd(), "private", "pdfs", cible.pdf);
      if (!existsSync(chemin)) skip();

      const peignes = (inventaire as Record<string, Record<string, unknown[]>>)[cible.pdf] ?? {};
      const parsed = await parsePdf(readFileSync(chemin));
      const fields = cible.improve([], { technicalSchema: parsed.fields as never[] });

      // On compare des IDENTIFIANTS de champs — la géométrie relevée ne sert
      // qu'au message d'erreur, pour que le lecteur ait le guide sous les yeux
      // sans rouvrir la fixture.
      const manquants: string[] = [];
      const details: string[] = [];
      for (const f of fields) {
        if (f.hidden || !TYPES_TEXTE.has(f.type)) continue;
        if (f.printAsComb?.slotWidth) continue;
        for (const nom of nomsDeWidgets(f)) {
          if (!(nom in peignes)) continue;
          const [infos] = peignes[nom] as { cases: number; groupes: number[] }[];
          manquants.push(f.id);
          details.push(
            `${f.id} → « ${nom} » (${infos.cases} cases, groupes ${infos.groupes.join("-")})`,
          );
        }
      }

      expect(
        [...new Set(manquants)].sort(),
        `${cible.slug} : ces champs écrivent leur valeur d'un bloc PAR-DESSUS un guide en ` +
          `cases imprimé —\n  ${details.join("\n  ")}\n` +
          `Mesurer le guide (cf. ${FIXTURE}) et poser un \`printAsComb\`, ` +
          `ou inscrire le champ dans SANS_PEIGNE_ASSUME avec sa raison.`,
      ).toEqual(Object.keys(SANS_PEIGNE_ASSUME[cible.slug] ?? {}).sort());
    });
  }

  // ── LES DEUX OCCURRENCES DU NISS ────────────────────────────────────────
  //
  // Trois documents impriment le NISS deux fois (en-tête d'identité + bandeau
  // « suite » de l'autre page) avec UN champ AcroForm à deux widgets. Passer ce
  // champ en peigne ne dessine qu'à UN rectangle — celui que `parsePdf`
  // retient — et vide le champ : l'autre bandeau partirait BLANC. Une règle
  // serveur couvre donc l'occurrence restante, et ce test vérifie que les DEUX
  // portent bien les onze chiffres.
  //
  // Il ne suppose pas quel widget `parsePdf` retient : c'est une propriété de
  // l'ordre interne du PDF (page 1 pour le C1 et le C1C, page 2 pour le C1B),
  // et si une mise à jour de dépendance l'inversait, ce test le dirait au lieu
  // de laisser un bandeau vide partir à l'ONEM.
  const DEUX_PAGES = [
    { slug: "c1-changement-situation", pdf: "C1_FR.pdf", improve: CIBLES[0].improve },
    { slug: "c1b", pdf: "C1B_FR.pdf", improve: applyC1BImprovements },
    { slug: "c1c", pdf: "C1C_FR.pdf", improve: applyC1CImprovements },
  ];
  const NISS = "85073003328";

  for (const cible of DEUX_PAGES) {
    it(`${cible.slug} : le NISS s'imprime sur les DEUX pages, jamais un bandeau vide`, async ({
      skip,
    }) => {
      const chemin = join(process.cwd(), "private", "pdfs", cible.pdf);
      if (!existsSync(chemin)) skip();
      const source = readFileSync(chemin);
      const parsed = await parsePdf(source);
      const fields = cible.improve([], { technicalSchema: parsed.fields as never[] });

      const { PDFPage } = await import("pdf-lib");
      type Opts = { x?: number; y?: number };
      const chiffres: { c: string; y: number }[] = [];
      const original = PDFPage.prototype.drawText;
      const spy = vi
        .spyOn(PDFPage.prototype, "drawText")
        .mockImplementation(function (this: typeof PDFPage.prototype, t: string, o?: Opts) {
          if (/^\d$/.test(t)) chiffres.push({ c: t, y: o?.y ?? NaN });
          return original.call(this, t, o as never);
        });
      try {
        const payload = { niss: NISS };
        await fillForm(source, fields, payload, {
          flatten: false,
          technicalSchema: parsed.fields,
          extraStamps: resolveStamps(visiblePayload(fields, payload), getRulesForSlug(cible.slug)),
          combWidgets: getCombWidgetsForSlug(cible.slug),
        });
      } finally {
        spy.mockRestore();
      }

      // Deux paquets de onze chiffres, à deux ordonnées différentes.
      const parLigne = new Map<number, string>();
      for (const d of chiffres) {
        const k = Math.round(d.y);
        parLigne.set(k, (parLigne.get(k) ?? "") + d.c);
      }
      const lignesNiss = [...parLigne.values()].filter((v) => v === NISS);
      expect(
        lignesNiss.length,
        `${cible.slug} : le NISS doit être dessiné DEUX fois (identité + bandeau de ` +
          `l'autre page). Lignes de chiffres trouvées : ${JSON.stringify([...parLigne.entries()])}`,
      ).toBe(2);
    });
  }

  it("l'inventaire couvre bien les huit documents semés", () => {
    // Un PDF absent de la fixture rendrait le test ci-dessus vert pour de
    // mauvaises raisons : il ne verrait simplement aucun guide.
    const absents = CIBLES.map((c) => c.pdf).filter(
      (pdf) => !(pdf in (inventaire as Record<string, unknown>)),
    );
    expect(absents, `relancer \`python ${FIXTURE}\``).toEqual([]);
  });
});
