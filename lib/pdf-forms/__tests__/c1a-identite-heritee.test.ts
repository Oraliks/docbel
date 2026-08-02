// C1A — l'identité disparaît de l'écran, PAS du papier.
//
// Oraliks (2026-07-29) : « la partie identité ne doit pas être disponible
// puisqu'on l'a déjà via la C1 [...] donc étape à retirer du form runner mais
// laisser en code pour générer correctement le pdf ».
//
// Ce fichier tient les DEUX moitiés de cette phrase à la fois, sur le vrai
// C1A_FR.pdf, en suivant la chaîne complète que parcourt une valeur héritée :
//
//   payload du C1 → extractCanonical → canonicalToPrefill
//     → applyDossierInheritance (le champ quitte l'écran)
//     → buildInitialValues (le runner le porte quand même)
//     → buildValidator.safeParse (la valeur survit)
//     → applyServerAutoFields + fillForm (le widget est tamponné)
//
// Le mode de panne qu'il interdit est précis : un champ retiré du parcours dont
// la valeur ne suit pas produit une déclaration officielle envoyée à l'ONEM
// SANS NOM ni NISS — invisible pour tout le monde jusqu'à l'usager.
//
// Et la moitié qu'on oublie : ce même C1A est publié sur son URL publique
// (`/document/onem/c1a`), où AUCUN C1 n'a été rempli. L'identité doit y rester
// posée à l'écran, et le serveur doit refuser une soumission sans elle.

import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFPage, PDFTextField } from "pdf-lib";
import type { PDFPageDrawTextOptions } from "pdf-lib";
import { parsePdf } from "../acroform-parser";
import { applyC1AImprovements } from "../seed/c1a-fields";
import { applyC1Improvements } from "../seed/c1-fields-improvements";
import { toPublicField } from "../public-serializer";
import { extractCanonical, canonicalToPrefill } from "../canonical/extract";
import { applyDossierInheritance } from "../dossier-inheritance";
import { buildInitialValues } from "../initial-values";
import { buildMacroSteps } from "../build-steps";
import { getFormPresentation } from "../form-presentation";
import { buildValidator, visiblePayload } from "../validation";
import { applyServerAutoFields } from "../auto-fields";
import { resolveStamps } from "../bindings/engine";
import { getRulesForSlug } from "../bindings/registry";
import { fillForm } from "../filler";
import { todayISO } from "../system-values";
import type { FormPayload, PdfFormField } from "../types";
import type { PublicField } from "../public-serializer";
import type { CanonicalKey } from "../canonical/vocabulary";

const PDF_DIR = join(process.cwd(), "private", "pdfs");
const C1A_PDF = join(PDF_DIR, "C1A_FR.pdf");
const C1_PDF = join(PDF_DIR, "C1_FR.pdf");

/// Identité telle que le citoyen l'a écrite sur son C1, désignée par CLÉS
/// CANONIQUES et non par identifiants de champs : le test suit alors le pont
/// réel entre les deux documents, sans recopier les `id` du C1.
const IDENTITE: Partial<Record<CanonicalKey, string>> = {
  "identity.nom": "Dupont",
  "identity.prenom": "Jean",
  "identity.niss": "85073003328",
  "adresse.rue": "Rue de la Loi",
  "adresse.numero": "16",
  "adresse.codePostal": "1000",
  "adresse.commune": "Bruxelles",
};

/// Le chemin le plus court du C1A : « non » à tout ce que l'arbre demande.
/// Les questions des branches non prises sont invisibles (`visibleIf` posé par
/// `appliquerRoutage`) et ne sont donc pas exigées.
const REPONSES_CHEMIN_COURT: FormPayload = {
  aideIndependant: "non",
  mandatPolitiqueOuJuge: "non",
  autreActiviteAccessoire: "non",
  estChomeurTemporaire: "non",
  independantTitrePrincipal: "non",
  affirmationSincerite: true,
};

const IDS_IDENTITE = ["nomEtPrenom", "niss", "rue", "numero", "codePostal", "commune"];

async function schemaC1A(): Promise<PdfFormField[]> {
  return applyC1AImprovements([]);
}

async function schemaC1(): Promise<PdfFormField[]> {
  const parsed = await parsePdf(readFileSync(C1_PDF));
  return applyC1Improvements([], {
    defaultMotif: "modification",
    restrictMotifTo5Situations: true,
    technicalSchema: parsed.fields,
  });
}

/// Reproduit le geste de `app/document/[...path]/page.tsx` : les valeurs
/// canoniques des AUTRES documents du dossier, converties en pré-remplissage
/// pour celui-ci.
function prefillDepuisLeC1(c1Fields: PdfFormField[], c1aFields: PublicField[]) {
  const payloadC1: FormPayload = {};
  for (const f of c1Fields) {
    const valeur = f.canonicalKey ? IDENTITE[f.canonicalKey as CanonicalKey] : undefined;
    if (valeur) payloadC1[f.id] = valeur;
  }
  return canonicalToPrefill(c1aFields, extractCanonical(c1Fields, payloadC1));
}

describe("C1A dans un dossier — l'identité quitte l'écran", () => {
  it("le C1 transmet bien les sept valeurs d'identité attendues", async ({ skip }) => {
    if (!existsSync(C1A_PDF) || !existsSync(C1_PDF)) skip();
    const c1a = (await schemaC1A()).map(toPublicField);
    const prefill = prefillDepuisLeC1(await schemaC1(), c1a);

    // Le nom composite est reconstitué par `canonicalToPrefill` à partir des
    // deux clés séparées du C1 — c'est ce qui rend la reprise automatique.
    expect(prefill.nomEtPrenom).toEqual({ first: "Jean", last: "Dupont" });
    expect(prefill.niss).toBe("85073003328");
    expect(prefill.rue).toBe("Rue de la Loi");
    expect(prefill.numero).toBe("16");
    expect(prefill.codePostal).toBe("1000");
    expect(prefill.commune).toBe("Bruxelles");
  });

  it("les six champs d'identité deviennent auto, et l'étape disparaît du parcours", async ({
    skip,
  }) => {
    if (!existsSync(C1A_PDF) || !existsSync(C1_PDF)) skip();
    const c1a = (await schemaC1A()).map(toPublicField);
    const prefill = prefillDepuisLeC1(await schemaC1(), c1a);
    const ecran = applyDossierInheritance(c1a, prefill);

    expect(ecran.filter((f) => f.autoAnswered).map((f) => f.id).sort()).toEqual(
      [...IDS_IDENTITE].sort(),
    );

    const ordre = getFormPresentation("c1a").stepGroupOrder ?? [];
    const valeurs = { ...buildInitialValues(ecran, prefill), ...REPONSES_CHEMIN_COURT };
    const etapes = buildMacroSteps(ecran, valeurs, ordre)?.map((s) => s.id) ?? [];

    expect(etapes).not.toContain("identite");
    // Le parcours s'ouvre désormais sur la première VRAIE question.
    expect(etapes[0]).toBe("aideIndependant");
  });

  it("la valeur héritée arrive jusqu'au PDF officiel — aucune case blanche", async ({ skip }) => {
    if (!existsSync(C1A_PDF) || !existsSync(C1_PDF)) skip();
    const fields = await schemaC1A();
    const c1a = fields.map(toPublicField);
    const prefill = prefillDepuisLeC1(await schemaC1(), c1a);

    // 1. L'écran : les six champs d'identité n'y sont plus.
    const ecran = applyDossierInheritance(c1a, prefill);
    for (const id of IDS_IDENTITE) {
      expect(ecran.find((f) => f.id === id)?.autoAnswered, id).toBe(true);
    }

    // 2. Le runner porte quand même leurs valeurs, donc il les soumet.
    const soumis: FormPayload = {
      ...buildInitialValues(ecran, prefill),
      ...REPONSES_CHEMIN_COURT,
    };

    // 3. Validation serveur — le schéma STOCKÉ, celui qui n'a jamais vu
    //    `autoAnswered` : l'identité y est donc validée normalement.
    const res = buildValidator(fields, "fr").safeParse(soumis);
    expect(
      res.success ? [] : res.error.issues.map((i) => `${String(i.path[0])} : ${i.message}`),
    ).toEqual([]);
    const valide = applyServerAutoFields(fields, res.success ? (res.data as FormPayload) : {}, todayISO());
    expect(valide.nomEtPrenom).toEqual({ first: "Jean", last: "Dupont" });
    expect(valide.niss).toBe("85073003328");

    // 4. Le papier. Même geste que la route /generate (`flatten: false` pour
    //    pouvoir relire les widgets).
    const parsed = await parsePdf(readFileSync(C1A_PDF));
    // Les chiffres du NISS ne passent plus par la valeur du widget mais par des
    // `drawText` case par case : on les capte au vol pour pouvoir les relire.
    const chiffres: { c: string; y: number }[] = [];
    const originalDrawText = PDFPage.prototype.drawText;
    const spy = vi
      .spyOn(PDFPage.prototype, "drawText")
      .mockImplementation(function (this: PDFPage, text: string, options?: PDFPageDrawTextOptions) {
        // Un peigne dessine UN caractère à la fois. On note l'ordonnée pour
        // pouvoir distinguer le peigne de la page 1 du rappel d'en-tête de la
        // page 2, qui écrit le MÊME NISS ailleurs (règle `niss-header-p2`).
        if (/^\d$/.test(text)) chiffres.push({ c: text, y: options?.y ?? NaN });
        return originalDrawText.call(this, text, options);
      });
    let bytes: Uint8Array;
    let diagnostics: Awaited<ReturnType<typeof fillForm>>["diagnostics"];
    try {
      ({ bytes, diagnostics } = await fillForm(readFileSync(C1A_PDF), fields, valide, {
        flatten: false,
        technicalSchema: parsed.fields,
        extraStamps: resolveStamps(visiblePayload(fields, valide), getRulesForSlug("c1a")),
      }));
    } finally {
      spy.mockRestore();
    }
    expect(diagnostics.filter((d) => IDS_IDENTITE.includes(d.fieldId))).toEqual([]);

    const acro = (await PDFDocument.load(bytes)).getForm();
    const texte = (widget: string) => (acro.getField(widget) as PDFTextField).getText() ?? "";

    // Nom : « Nom et prénom » imprimé → assemblé dans cet ordre par le filler.
    expect(texte("Nom et prénom")).toBe("Dupont Jean");
    // Le NISS ne se relit PLUS par la valeur du widget : depuis le 2026-08-02
    // il s'imprime en PEIGNE, un chiffre par case du guide (le widget ne sert
    // plus que de repère géométrique, sa valeur reste vide). Ce sont donc les
    // onze appels de dessin qu'on compte — même garantie, « aucune case
    // blanche », mesurée là où l'encre se pose vraiment.
    //
    // Ligne de base du peigne : rect du widget NISS (y=572,6) + baselineY 1,3.
    const peigneP1 = chiffres.filter((d) => Math.abs(d.y - 573.9) < 1);
    expect(peigneP1.map((d) => d.c).join("")).toBe("85073003328");
    // Et le rappel d'en-tête de la page 2 porte le MÊME numéro : deux endroits,
    // une seule valeur, aucun des deux blanc.
    expect(chiffres.filter((d) => Math.abs(d.y - 573.9) >= 1).map((d) => d.c).join("")).toBe(
      "85073003328",
    );
    // Adresse : deux widgets du PDF fusionnent chacun deux informations, ce
    // sont les règles serveur du C1A qui les recomposent.
    expect(texte("Rue")).toBe("Rue de la Loi 16");
    expect(texte("Code postal et commune")).toBe("1000 Bruxelles");
  });
});

describe("C1A hors dossier (URL publique) — l'identité reste posée", () => {
  it("aucun champ n'est masqué faute de pré-remplissage", async ({ skip }) => {
    if (!existsSync(C1A_PDF)) skip();
    const c1a = (await schemaC1A()).map(toPublicField);
    const ecran = applyDossierInheritance(c1a, undefined);

    expect(ecran.filter((f) => f.autoAnswered)).toEqual([]);
    const ordre = getFormPresentation("c1a").stepGroupOrder ?? [];
    const etapes = buildMacroSteps(ecran, REPONSES_CHEMIN_COURT, ordre)?.map((s) => s.id) ?? [];
    // Présente ET en tête : sans l'entrée maintenue dans `stepGroupOrder`, elle
    // tomberait en fin de parcours, après la signature.
    expect(etapes[0]).toBe("identite");
  });

  it("le serveur REFUSE une soumission sans identité (jamais de PDF anonyme)", async ({ skip }) => {
    if (!existsSync(C1A_PDF)) skip();
    const fields = await schemaC1A();
    // C'est la garantie que le schéma stocké apporte et qu'un `autoAnswered`
    // écrit en base aurait détruite : `autoAnswered` neutralise `required`, si
    // bien qu'un C1A ouvert hors dossier serait parti sans nom ni NISS.
    const res = buildValidator(fields, "fr").safeParse(REPONSES_CHEMIN_COURT);
    expect(res.success).toBe(false);
    const refuses = res.success ? [] : res.error.issues.map((i) => String(i.path[0]));
    for (const id of IDS_IDENTITE) expect(refuses, id).toContain(id);
  });
});
