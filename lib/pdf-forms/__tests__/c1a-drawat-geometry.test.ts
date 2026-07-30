// Verrouillage des champs `drawAt` du C1A apres l'audit de placement du
// 2026-07-30 (rapport : .superpowers/sdd/pdf-placement-audit.md).
//
// Contexte : deux mecanismes d'ecriture coexistent dans filler.ts. Le
// remplissage de widget AcroForm (`setText`) est correct par construction --
// sa position vient du PDF lui-meme. L'ecriture positionnelle (`drawAt`) est
// codee EN DUR dans ce seed : rien ne la relie au PDF a la compilation, donc
// rien ne rougit si une future modification du seed deplace une valeur.
//
// Ce fichier fige, pour chaque champ `drawAt` du C1A, soit :
//   (a) une FORMULE verifiable sur le vrai PDF (`x = arrondi(rect.x0) + 2,
//       y = arrondi(rect.y0) - 4`, mesuree pdfplumber, cf. rapport) --
//       recalculee a partir des widgets REELS du PDF officiel a chaque run ;
//   (b) une VALEUR figee, pour les champs dont la geometrie ne suit pas cette
//       formule (parce qu'un element imprime — legende, libelle — occupe
//       precisement la position que la formule donnerait), avec un garde-fou
//       geometrique qui empeche de "corriger" la valeur vers la formule sans
//       remesurer.
//
// Aucune connaissance metier requise pour relire ce fichier : c'est de la
// geometrie, comme `widget-geometry.test.ts`.

import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFName, PDFPage } from "pdf-lib";
import type { PDFPageDrawTextOptions } from "pdf-lib";
import { applyC1AImprovements } from "../seed/c1a-fields";
import { fillForm } from "../filler";
import { parsePdf } from "../acroform-parser";
import type { FormPayload, PdfFormField } from "../types";

const C1A_PDF = join(process.cwd(), "private", "pdfs", "C1A_FR.pdf");

interface WidgetRect {
  page: number;
  x0: number;
  y0: number;
}

/// Rectangles de TOUS les widgets d'un champ AcroForm partage (page + coin
/// bas-gauche, repere PDF natif, origine bas-gauche). `parsePdf`
/// (acroform-parser.ts) ne garde que le PREMIER widget par champ (suffisant
/// pour son propre usage, le regroupement par ordre de lecture) --
/// insuffisant ici : TVA / Montant / "1_3" / "voir 19" en portent 2 a 4, avec
/// une seule valeur PARTAGEE entre tous, et c'est justement pourquoi le C1A
/// les ecrit en positionnel (`drawAt`) plutot que par `setText` (cf.
/// PDF_FORMS_RULES.md, "un champ AcroForm peut porter PLUSIEURS widgets").
async function widgetRects(source: Buffer, fieldName: string): Promise<WidgetRect[]> {
  const doc = await PDFDocument.load(source, { ignoreEncryption: true });
  const pageRefs = doc.getPages().map((p) => p.ref.toString());
  const field = doc.getForm().getField(fieldName);
  return field.acroField.getWidgets().map((w) => {
    const r = w.getRectangle();
    const pRef = w.dict.get(PDFName.of("P"));
    const page = pRef ? pageRefs.indexOf(pRef.toString()) : -1;
    return { page, x0: r.x, y0: r.y };
  });
}

function fieldById(fields: PdfFormField[], id: string): PdfFormField {
  const f = fields.find((x) => x.id === id);
  if (!f) throw new Error(`champ absent du schema C1A : ${id}`);
  return f;
}

/// Convention verifiee sur le C1A (audit placement 2026-07-30, mesure
/// pdfplumber caractere par caractere sur le PDF genere) : quand une case
/// AcroForm partagee ne peut pas etre revendiquee par `setText` (valeur
/// commune a plusieurs cases), le dessin positionnel se cale sur SON
/// rectangle avec un decalage constant : x = arrondi(rect.x0) + 2,
/// y = arrondi(rect.y0) - 4. Le texte s'imprime alors ~2 pt sous le
/// pointille imprime, jamais au-dessus ni en chevauchement.
///
/// Verifiee EXACTE (a l'unite pres) sur 3 des ~10 champs `drawAt` du
/// document : les deux montants de Q11 (widget "Montant", 2e et 3e case), et
/// la 1re ligne "periodes" de Q18 (widget "1_3"). Les cas restants (Q6, Q19)
/// suivent une geometrie differente (legende imprimee a un endroit
/// different) et sont verrouilles en valeur plus bas, avec leur propre
/// justification mesuree -- ne pas les "harmoniser" sur cette formule sans
/// remesurer, cf. les commentaires dedies.
///
/// Les deux n° d'entreprise (Q2/Q16, widget "TVA") suivaient AUSSI cette
/// formule jusqu'au 2026-07-30 (texte plein) : depuis le lot "peigne BCE"
/// (rapport .superpowers/sdd/bce-peigne-report.md), ils dessinent un peigne
/// case-par-case cale sur le guide imprime lui-meme (glyphes `SymbolMT`), pas
/// sur le widget TVA -- verrouilles par valeur dans le describe "peigne
/// positionnel des n° BCE" plus bas, avec juste un garde-fou de proximite au
/// widget TVA ci-dessous (pas la formule exacte).
function xyAttendus(r: WidgetRect): { x: number; y: number } {
  return { x: Math.round(r.x0) + 2, y: Math.round(r.y0) - 4 };
}

describe("C1A - geometrie des champs drawAt (verrouillage post-audit placement 2026-07-30)", () => {
  it("le PDF officiel expose bien les 4 champs AcroForm partages attendus (TVA / Montant / 1_3 / voir 19)", async ({ skip }) => {
    if (!existsSync(C1A_PDF)) skip();
    const source = readFileSync(C1A_PDF);
    await expect(widgetRects(source, "TVA")).resolves.toHaveLength(2);
    await expect(widgetRects(source, "Montant")).resolves.toHaveLength(3);
    await expect(widgetRects(source, "1_3")).resolves.toHaveLength(3);
    await expect(widgetRects(source, "voir 19")).resolves.toHaveLength(4);
  });

  it("independantNumeroEntreprise (Q2) et numeroEntreprise (Q16) : mode PEIGNE depuis le 2026-07-30, x proche du widget TVA reel", async ({
    skip,
  }) => {
    if (!existsSync(C1A_PDF)) skip();
    const source = readFileSync(C1A_PDF);
    const rects = await widgetRects(source, "TVA");
    const fields = applyC1AImprovements([]);
    const q2 = fieldById(fields, "independantNumeroEntreprise");
    const q16 = fieldById(fields, "numeroEntreprise");

    const q2Widget = rects.find((r) => r.page === 0);
    const q16Widget = rects.find((r) => r.page === 1);
    expect(q2Widget, "widget TVA de la page 1 (Q2) introuvable").toBeDefined();
    expect(q16Widget, "widget TVA de la page 2 (Q16) introuvable").toBeDefined();

    // Depuis le lot "peigne BCE" (2026-07-30, rapport bce-peigne-report.md),
    // ces deux champs ne suivent PLUS la formule +2/-4 ci-dessus : ils portent
    // `printAsComb` et leur `drawAt.x` vise directement la 1re case du guide
    // en dix cases mesuree sur le PDF (pas le bord du widget TVA + 2, qui
    // convenait au texte plein mais pas a un alignement case-par-case).
    // Garde-fou large ici (0 a 3 pt a droite du widget) : suffisant pour
    // detecter un widget TVA qui se deplacerait franchement (nouvelle version
    // du gabarit ONEM) sans dupliquer la mesure exacte du guide, verrouillee
    // par valeur dans le describe "peigne positionnel des n° BCE" plus bas.
    expect(q2.drawAt?.page).toBe(0);
    expect(q2.drawAt!.x).toBeGreaterThanOrEqual(q2Widget!.x0);
    expect(q2.drawAt!.x).toBeLessThanOrEqual(q2Widget!.x0 + 3);
    expect(q16.drawAt?.page).toBe(1);
    expect(q16.drawAt!.x).toBeGreaterThanOrEqual(q16Widget!.x0);
    expect(q16.drawAt!.x).toBeLessThanOrEqual(q16Widget!.x0 + 3);
  });

  it("revenuAnnuelMandat / revenuAnnuelMandat2 (Q11) se calent sur 2 des 3 widgets reels de Montant", async ({ skip }) => {
    if (!existsSync(C1A_PDF)) skip();
    const source = readFileSync(C1A_PDF);
    const rects = await widgetRects(source, "Montant");
    const fields = applyC1AImprovements([]);
    const m1 = fieldById(fields, "revenuAnnuelMandat");
    const m2 = fieldById(fields, "revenuAnnuelMandat2");

    // Les 2 lignes de Q11 sont en page 2 (index 1) ; celle de Q6 (page 1 /
    // index 0) est verrouillee separement plus bas (geometrie differente).
    const page1Rects = rects.filter((r) => r.page === 1).sort((a, b) => b.y0 - a.y0);
    expect(page1Rects, "2 widgets Montant attendus en page 2").toHaveLength(2);

    expect(m1.drawAt).toMatchObject({ page: 1, ...xyAttendus(page1Rects[0]) });
    expect(m2.drawAt).toMatchObject({ page: 1, ...xyAttendus(page1Rects[1]) });
  });

  it('la 1re ligne "periodes" de Q18 (lineTargets, dessin positionnel) se cale sur le widget partage "1_3"', async ({ skip }) => {
    if (!existsSync(C1A_PDF)) skip();
    const source = readFileSync(C1A_PDF);
    const rects = await widgetRects(source, "1_3");
    const fields = applyC1AImprovements([]);
    const q18periodes = fieldById(fields, "q18periodesTexte");
    const premiereCible = q18periodes.lineTargets?.[0];
    expect(premiereCible?.pdfFieldName, "la 1re cible doit rester en dessin positionnel (widget partage)").toBe("");

    // Le widget de la ligne "pendant les periodes..." est le plus BAS des 3
    // (les 2 autres sont les cases d'en-tete nom/NISS de la page 2, tout en
    // haut de la page — cf. commentaire du seed pres de Q18).
    const page1Rects = rects.filter((r) => r.page === 1).sort((a, b) => a.y0 - b.y0);
    expect(page1Rects.length).toBeGreaterThan(0);
    const ligne = page1Rects[0];

    expect(premiereCible?.drawAt).toMatchObject({ page: 1, ...xyAttendus(ligne) });
  });

  it("montantAide / montantAideAnnuel (Q6) restent hors de la legende imprimee sous la ligne partagee de Montant", async ({ skip }) => {
    if (!existsSync(C1A_PDF)) skip();
    const source = readFileSync(C1A_PDF);
    const rects = await widgetRects(source, "Montant");
    const ligneQ6 = rects.find((r) => r.page === 0);
    expect(ligneQ6, "widget Montant de la page 1 (Q6) introuvable").toBeDefined();

    const fields = applyC1AImprovements([]);
    const mois = fieldById(fields, "montantAide");
    const an = fieldById(fields, "montantAideAnnuel");

    // Verrouillage en VALEUR (pas en formule) : audite le 2026-07-30. Cette
    // ligne partagee porte, contrairement aux 2 lignes de Q11 ci-dessus, une
    // legende imprimee juste EN DESSOUS du pointille ("par mois EUR (2
    // chiffres apres la virgule)" / "par an EUR", mesuree pdfplumber a
    // y=[297.4, 306.4]). Appliquer la meme formule (-4 depuis rect.y0) y
    // placerait le texte a y=304, qui EMPIETE sur cette legende de 4.5 pt
    // (mesure ET confirme par relecture visuelle du PDF genere : le nombre
    // aurait chevauche "par mois EUR..."). y=311 (valeur actuelle dans le
    // seed) degage la legende de 2.48 pt ET la question au-dessus de 3.5 pt :
    // c'est SUR, meme si la formule differe des champs ci-dessus.
    expect(mois.drawAt).toMatchObject({ page: 0, x: 322, y: 311, maxWidth: 110 });
    expect(an.drawAt).toMatchObject({ page: 0, x: 440, y: 311, maxWidth: 58 });

    // Garde-fou geometrique (pas seulement un nombre fige) : les deux doivent
    // rester strictement AU-DESSUS de la zone que couvrirait la formule -4
    // (zone de la legende), quelle que soit la valeur exacte choisie plus
    // tard pour ce champ.
    const yPlancherLegende = Math.round(ligneQ6!.y0) - 4;
    expect(mois.drawAt!.y).toBeGreaterThan(yPlancherLegende);
    expect(an.drawAt!.y).toBeGreaterThan(yPlancherLegende);
  });

  it("mandatDescription (Q10, aucun widget imprime) reste hors du libelle imprime juste au-dessus", () => {
    const fields = applyC1AImprovements([]);
    const q10 = fieldById(fields, "mandatDescription");

    // CORRECTIF de cet audit (2026-07-30) : y passait de 766 a 755. A 766, la
    // valeur chevauchait de 2.74 pt la 2e ligne du libelle imprime lui-meme
    // ("plus d'une fonction, mentionnez les tous)", mesuree via
    // pdfplumber/chars a y=[770.14, 779.14] sur le PDF reel) -- confirme
    // aussi par relecture visuelle du PDF genere (la reponse s'imprimait
    // collee sous la question, sans aucun espace). Aucun widget AcroForm
    // n'existe ici (verifie : rien en page 2, colonne de gauche, entre
    // y=690 et y=800) : rien a recalculer depuis le PDF pour ce champ,
    // valeur verrouillee a la main.
    expect(q10.drawAt).toEqual({ page: 1, x: 50, y: 755, size: 9, maxWidth: 236 });
  });

  it('revenuNetSalarieParMois / ParHeure / revenuNetIndependantParAn (Q19) restent alignes en X sur les widgets reels de "voir 19"', async ({ skip }) => {
    if (!existsSync(C1A_PDF)) skip();
    const source = readFileSync(C1A_PDF);
    const rects = await widgetRects(source, "voir 19");
    const fields = applyC1AImprovements([]);
    const parMois = fieldById(fields, "revenuNetSalarieParMois");
    const parHeure = fieldById(fields, "revenuNetSalarieParHeure");
    const parAn = fieldById(fields, "revenuNetIndependantParAn");

    // Verrouillage en VALEUR pour Y (la legende "EUR" est imprimee sur la
    // MEME ligne que le montant, pas en dessous : la formule -4 des champs
    // ci-dessus ne s'applique pas ici -- verifie par mesure ET par relecture
    // visuelle, aucun chevauchement constate avec les valeurs actuelles).
    expect(parMois.drawAt).toMatchObject({ page: 1, x: 360, y: 563, maxWidth: 62 });
    expect(parHeure.drawAt).toMatchObject({ page: 1, x: 487, y: 563, maxWidth: 46 });
    expect(parAn.drawAt).toMatchObject({ page: 1, x: 350, y: 493, maxWidth: 185 });

    // X reste verifiable sur les widgets reels (arrondi(rect.x0) + 2), sans
    // dependre de l'ordre du tableau /Kids.
    const xsAttendus = rects.filter((r) => r.page === 1).map((r) => Math.round(r.x0) + 2);
    expect(xsAttendus, "X de revenuNetSalarieParMois doit correspondre a un widget reel de voir 19").toContain(
      parMois.drawAt!.x
    );
    expect(xsAttendus, "X de revenuNetSalarieParHeure doit correspondre a un widget reel de voir 19").toContain(
      parHeure.drawAt!.x
    );
    expect(xsAttendus, "X de revenuNetIndependantParAn doit correspondre a un widget reel de voir 19").toContain(
      parAn.drawAt!.x
    );
  });
});

// ---------------------------------------------------------------------------
// Peigne positionnel des n° BCE (Q2/Q16) -- audit du 2026-07-30, rapport
// .superpowers/sdd/bce-peigne-report.md.
//
// Contexte : les deux champs `independantNumeroEntreprise` (Q2) et
// `numeroEntreprise` (Q16) s'imprimaient jusqu'ici en texte plein compact sur
// un guide en dix cases (glyphes `SymbolMT`, groupes 4-3-3 -- format BCE
// 0123.456.789), decale par rapport aux cases. `filler.ts` sait desormais
// dessiner un `printAsComb` caractere par caractere pour un champ SANS widget
// (a partir de `drawAt.x`/`y`), pas seulement pour un champ avec widget --
// cf. `placerPeigne`, factorisee pour les deux sources de geometrie.
// ---------------------------------------------------------------------------
describe("C1A - peigne positionnel des n° BCE (Q2/Q16), un chiffre par case (2026-07-30)", () => {
  // Rend visibles les deux champs BCE en ecriture positionnelle : Q2 derriere
  // `aideIndependant=oui` : Q16 derriere `disposeNumeroEntreprise=oui`
  // (elle-meme affichee seulement si `formeActivite=mandataire`), ET
  // `autreActiviteAccessoire=oui` (fusionne dans le `visibleIf` compile de
  // numeroEntreprise par `compilerRoutage`, cf. form-presentation.test.ts).
  const PAYLOAD_BCE: FormPayload = {
    aideIndependant: "oui",
    independantNumeroEntreprise: "0822.975.615",
    autreActiviteAccessoire: "oui",
    formeActivite: "mandataire",
    disposeNumeroEntreprise: "oui",
    numeroEntreprise: "1234.567.891",
  };

  interface AppelDrawText {
    text: string;
    x: number;
    y: number;
  }

  /// Espionne `PDFPage.prototype.drawText` (assignee sur le PROTOTYPE par
  /// pdf-lib -- verifie dans node_modules/pdf-lib/cjs/api/PDFPage.js -- donc
  /// interceptee quelle que soit l'instance de page) pendant un `fillForm`
  /// REEL sur le PDF officiel, puis rend l'appel d'origine pour que le PDF
  /// produit reste valide. C'est la seule facon d'observer depuis un test ce
  /// que chaque caractere du peigne a reellement recu comme coordonnees :
  /// pdf-lib n'expose aucune lecture de flux de contenu apres coup.
  async function dessinerEtCapturer(
    payload: FormPayload
  ): Promise<{ appels: AppelDrawText[]; diagnostics: unknown[] }> {
    const source = readFileSync(C1A_PDF);
    const parsed = await parsePdf(source);
    const fields = applyC1AImprovements([]);

    const appels: AppelDrawText[] = [];
    const original = PDFPage.prototype.drawText;
    const spy = vi
      .spyOn(PDFPage.prototype, "drawText")
      .mockImplementation(function (this: PDFPage, text: string, options?: PDFPageDrawTextOptions) {
        appels.push({ text, x: options?.x ?? NaN, y: options?.y ?? NaN });
        return original.call(this, text, options);
      });
    try {
      const { diagnostics } = await fillForm(source, fields, payload, {
        flatten: false,
        technicalSchema: parsed.fields,
      });
      return { appels, diagnostics };
    } finally {
      spy.mockRestore();
    }
  }

  /// Verifie qu'UN chiffre par case a ete dessine, aux abscisses attendues
  /// (pas constant `slotWidth`, plus `groupExtra` a chaque rupture de groupe),
  /// et que le dernier chiffre reste sous le bord droit mesure du guide.
  function verifierPeigne(
    appels: AppelDrawText[],
    field: PdfFormField,
    valeurAttendue: string,
    finGuideX1: number
  ): void {
    const comb = field.printAsComb;
    expect(comb, `${field.id} doit porter printAsComb`).toBeDefined();
    expect(field.drawAt, `${field.id} doit porter drawAt`).toBeDefined();

    // La ligne de base (`y`) est propre a CE champ parmi tous les `drawAt` du
    // C1A (verifie : aucune autre occurrence de 343 ni 303 dans le seed) --
    // filtrer dessus isole sans ambiguite les chiffres de ce peigne.
    const dessines = appels.filter((a) => a.y === field.drawAt!.y && /^[0-9]$/.test(a.text));
    expect(dessines.map((d) => d.text).join(""), `chiffres dessines pour ${field.id}`).toBe(valeurAttendue);

    const ruptures = new Set<number>();
    let cumul = 0;
    for (const taille of comb!.groups) {
      cumul += taille;
      ruptures.add(cumul);
    }
    let xAttendu = field.drawAt!.x;
    dessines.forEach((d, i) => {
      if (ruptures.has(i)) xAttendu += comb!.groupExtra ?? 0;
      expect(d.x, `abscisse du chiffre n°${i} de ${field.id}`).toBeCloseTo(xAttendu, 2);
      xAttendu += comb!.slotWidth!;
    });

    // Marge large (7 pt ; DejaVuSans mesure ~5.7 pt de large a 9 pt pour un
    // chiffre, cf. rapport) : le dernier chiffre ne doit pas depasser le bord
    // droit du guide, mesure separement sur le PDF officiel pour ce champ.
    const dernier = dessines[dessines.length - 1];
    expect(dernier.x + 7, `le dernier chiffre de ${field.id} deborderait du guide`).toBeLessThanOrEqual(finGuideX1);
  }

  it("independantNumeroEntreprise (Q2) : un chiffre par case, aux abscisses mesurees, sans deborder du guide", async ({
    skip,
  }) => {
    if (!existsSync(C1A_PDF)) skip();
    const { appels, diagnostics } = await dessinerEtCapturer(PAYLOAD_BCE);
    expect(diagnostics).toEqual([]);
    const fields = applyC1AImprovements([]);
    const q2 = fieldById(fields, "independantNumeroEntreprise");

    // Verrouillage des reglages MESURES (cf. rapport) : groupes 4-3-3 (format
    // BCE 0123.456.789), pas 13.02 pt, ecart de rupture 6.06 pt -- identiques
    // aux deux occurrences du guide (Q2/Q16), meme glyphe SymbolMT re-mesure
    // separement sur chaque page.
    expect(q2.printAsComb).toEqual({ groups: [4, 3, 3], slotWidth: 13.02, groupExtra: 6.06 });
    expect(q2.drawAt).toMatchObject({ page: 0, x: 113.88, y: 343 });

    // Derniere case du guide mesuree sur private/pdfs/C1A_FR.pdf (page 1) :
    // le 10e glyphe SymbolMT va de x0=243.175 a x1=252.175.
    verifierPeigne(appels, q2, "0822975615", 252.175);
  });

  it("numeroEntreprise (Q16) : meme garantie, mesuree separement sur la 2e occurrence du guide", async ({ skip }) => {
    if (!existsSync(C1A_PDF)) skip();
    const { appels, diagnostics } = await dessinerEtCapturer(PAYLOAD_BCE);
    expect(diagnostics).toEqual([]);
    const fields = applyC1AImprovements([]);
    const q16 = fieldById(fields, "numeroEntreprise");

    expect(q16.printAsComb).toEqual({ groups: [4, 3, 3], slotWidth: 13.02, groupExtra: 6.06 });
    expect(q16.drawAt).toMatchObject({ page: 1, x: 118.32, y: 303 });

    // Derniere case du guide mesuree sur private/pdfs/C1A_FR.pdf (page 2) :
    // le 10e glyphe SymbolMT va de x0=247.618 a x1=256.618.
    verifierPeigne(appels, q16, "1234567891", 256.618);
  });

  it("ne dessine aucun chiffre en peigne pour Q2/Q16 quand la question amont repond « non »", async ({ skip }) => {
    if (!existsSync(C1A_PDF)) skip();
    // `aideIndependant=non` masque Q2 (visibleIf) ; aucune valeur ni condition
    // amont pour Q16 (disposeNumeroEntreprise absent du payload).
    const { appels, diagnostics } = await dessinerEtCapturer({ aideIndependant: "non" });
    expect(diagnostics).toEqual([]);
    const fields = applyC1AImprovements([]);
    const q2 = fieldById(fields, "independantNumeroEntreprise");
    const q16 = fieldById(fields, "numeroEntreprise");

    expect(appels.some((a) => a.y === q2.drawAt!.y && /^[0-9]$/.test(a.text))).toBe(false);
    expect(appels.some((a) => a.y === q16.drawAt!.y && /^[0-9]$/.test(a.text))).toBe(false);
  });
});
