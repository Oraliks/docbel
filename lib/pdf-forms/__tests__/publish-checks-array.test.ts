import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parsePdf } from "../acroform-parser";
import { checkPublishable } from "../publish-checks";
import { applyC1Improvements } from "../seed/c1-fields-improvements";
import type { AcroFieldRaw, PdfFormField } from "../types";

/// Les ancres d'une grille échappaient à la publication.
///
/// `checkPublishable` vérifiait `pdfFieldName` mais ni `pdfFieldNameTemplate`
/// ni `firstMatchMapping`. Une seule faute de frappe dans le template de la
/// grille cohabitants rendait donc CINQ cases blanches — une par ligne — avec
/// une publication acceptée et une génération muette. Le seul filet était le
/// test seeds↔PDF, qui ne couvre pas un schéma édité à la main dans l'admin.
///
/// Ces tests injectent la faute dans le vrai schéma C1, confronté au vrai PDF.

const C1 = join(process.cwd(), "private", "pdfs", "C1_FR.pdf");
const source = existsSync(C1) ? readFileSync(C1) : null;
const skip = source ? it : it.skip;

async function schemaC1(): Promise<{ fields: PdfFormField[]; tech: AcroFieldRaw[] }> {
  const tech = (await parsePdf(source!)).fields;
  return { fields: applyC1Improvements([], { technicalSchema: tech }), tech };
}

function erreurs(fields: PdfFormField[], tech: AcroFieldRaw[]) {
  return checkPublishable(fields, tech, ["fr"]).filter((i) => i.level === "error");
}

/// Copie profonde du champ `array` visé, pour ne jamais muter le seed partagé.
function withCohabitants(
  fields: PdfFormField[],
  mutate: (grid: PdfFormField) => void
): PdfFormField[] {
  const out = fields.map((f) =>
    f.type === "array"
      ? { ...f, itemFields: (f.itemFields ?? []).map((s) => ({ ...s })), firstMatchMapping: f.firstMatchMapping ? { ...f.firstMatchMapping, fields: { ...f.firstMatchMapping.fields } } : undefined }
      : f
  );
  const grid = out.find((f) => f.type === "array");
  if (!grid) throw new Error("aucun champ array dans le schéma C1");
  mutate(grid);
  return out;
}

describe("checkPublishable — ancres des grilles", () => {
  skip("le schéma C1 réel est publiable (aucun faux positif)", async () => {
    const { fields, tech } = await schemaC1();
    expect(erreurs(fields, tech)).toEqual([]);
  });

  skip("refuse une faute de frappe dans un template de colonne", async () => {
    const { fields, tech } = await schemaC1();
    const casse = withCohabitants(fields, (grid) => {
      const sub = grid.itemFields!.find((s) => s.pdfFieldNameTemplate);
      if (!sub) throw new Error("aucune colonne à template");
      sub.pdfFieldNameTemplate = sub.pdfFieldNameTemplate!.replace("Personne", "Persone");
    });

    const errs = erreurs(casse, tech);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.some((e) => /champ\(s\) PDF inexistant/.test(e.message))).toBe(true);
  });

  skip("refuse une faute de frappe dans un report first-match", async () => {
    const { fields, tech } = await schemaC1();
    const casse = withCohabitants(fields, (grid) => {
      const fm = grid.firstMatchMapping;
      if (!fm) throw new Error("aucun firstMatchMapping");
      const [premier] = Object.keys(fm.fields);
      fm.fields[premier] = "widget_qui_nexiste_pas";
    });

    const errs = erreurs(casse, tech);
    expect(errs.some((e) => /pointe vers un champ PDF inexistant/.test(e.message))).toBe(true);
  });

  skip("refuse un champ pipe dont le type n'est plus radio", async () => {
    // Le scénario admin : on bascule un champ pipe vers « select » depuis
    // l'éditeur. `stampPipeRadio` ne traite que les radio — plus rien n'est
    // coché, et le contrôle d'arité était lui-même gaté sur le type.
    const { fields, tech } = await schemaC1();
    const casse = fields.map((f) =>
      f.type === "radio" && f.pdfFieldName.includes("|")
        ? ({ ...f, type: "select" } as PdfFormField)
        : f
    );

    const errs = erreurs(casse, tech);
    expect(errs.some((e) => /convention pipe/.test(e.message))).toBe(true);
  });
});
