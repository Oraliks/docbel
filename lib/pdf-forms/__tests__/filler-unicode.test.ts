import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parsePdf } from "../acroform-parser";
import { fillForm } from "../filler";
import { applyC1Improvements } from "../seed/c1-fields-improvements";

/// Un nom hors Latin-1 faisait planter la génération en 500.
///
/// pdf-lib encode les apparences en WinAnsi tant qu'aucune police Unicode
/// n'est embarquée, et `doc.save()` LÈVE sur le premier caractère qu'il ne
/// sait pas écrire (`WinAnsi cannot encode "Ł"`). Le chemin de police pointait
/// sur un fichier jamais déposé dans le dépôt : le repli silencieux était donc
/// toujours actif, et tout citoyen polonais, turc, tchèque ou roumain se
/// heurtait à une erreur serveur au moment de générer son document.
///
/// Ce test verrouille les deux moitiés du correctif : la police est bien là,
/// et le PDF se génère.
const PDF = join(process.cwd(), "private", "pdfs", "C1_FR.pdf");

describe("filler — noms hors Latin-1", () => {
  it("embarque la police Unicode et génère sans lever", async ({ skip }) => {
    if (!existsSync(PDF)) skip();

    const source = readFileSync(PDF);
    const parsed = await parsePdf(source);
    const fields = applyC1Improvements([], {
      defaultMotif: "modification",
      restrictMotifTo5Situations: true,
      technicalSchema: parsed.fields,
    });

    const result = await fillForm(
      source,
      fields,
      { nom: "Łukasz-Gökhan", pr_nom: "Ștefan", niss: "85073003328" },
      { technicalSchema: parsed.fields },
    );

    // Sans ça, le repli Helvetica reprend et le bug revient en silence.
    expect(result.unicodeFont, "la police Unicode doit être embarquée").toBe(true);
    expect(result.bytes.length).toBeGreaterThan(1000);
  });
});
