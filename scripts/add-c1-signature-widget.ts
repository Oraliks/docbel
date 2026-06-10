// Ajoute un widget AcroForm texte « Signature » au PDF officiel C1_FR.pdf.
//
// Contexte : le PDF source ONEM ne contient pas de widget texte dédié à la
// signature électronique « façon Adobe » que notre filler dépose (nom + mention
// « Signé par » + horodatage ISO). Il existe bien un widget AcroForm de type
// /Sig nommé « Signature1 » au bas de la page 2, mais pdf-lib (et donc notre
// filler) ne sait pas l'utiliser pour stamper un bloc texte — il faut un
// PDFTextField. Ce script crée ce widget une seule fois, en place, dans la
// zone vide du bas de la page 2.
//
// Comportement :
//   - charge private/pdfs/C1_FR.pdf
//   - si un champ AcroForm nommé « Signature » existe déjà → no-op
//   - sinon : crée un PDFTextField « Signature » sur la page 2 au rectangle
//     (x=350, y=40, w=200, h=50) — zone vide entre les annexes (y≈90) et le
//     bord bas de page (PDF coords, origine bas-gauche)
//   - écrit le PDF en place (overwrite)
//
// Idempotent : à relancer sans risque, n'ajoutera pas de second widget.
//
// Usage :
//   npx tsx scripts/add-c1-signature-widget.ts          (dry-run par défaut)
//   npx tsx scripts/add-c1-signature-widget.ts --yes    (applique la modif)

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFTextField } from "pdf-lib";

const APPLY = process.argv.includes("--yes");

// Coordonnées du widget signature à créer (espace utilisateur PDF, origine
// bas-gauche). On le place sur la page 2 dans la zone vide juste au-dessus du
// pied de page, à droite — laisse de la marge sous les annexes (y≈90) et reste
// au-dessus du widget Date2_af_date (x=100, y=42) déjà présent.
const SIGNATURE_FIELD_NAME = "Signature";
const SIGNATURE_PAGE_INDEX = 1; // page 2 (0-based)
const SIGNATURE_RECT = { x: 350, y: 40, width: 200, height: 50 };

async function main(): Promise<void> {
  const pdfPath = join(process.cwd(), "private", "pdfs", "C1_FR.pdf");
  console.log(`Mode : ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Cible : ${pdfPath}\n`);

  const buf = readFileSync(pdfPath);
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const form = doc.getForm();

  // Idempotence : si un champ portant ce nom existe déjà (peu importe son
  // type), on n'ajoute rien. On évite ainsi les widgets en double si le script
  // est relancé après un --yes.
  const existing = form.getFields().find((f) => f.getName() === SIGNATURE_FIELD_NAME);
  if (existing) {
    console.log(
      `Un champ « ${SIGNATURE_FIELD_NAME} » existe déjà (type=${existing.constructor.name}). Rien à faire.`,
    );
    return;
  }

  const { x, y, width, height } = SIGNATURE_RECT;
  console.log(
    `Action prévue : ajouter le widget texte « ${SIGNATURE_FIELD_NAME} » ` +
      `à la page ${SIGNATURE_PAGE_INDEX + 1} au rect (x=${x}, y=${y}, w=${width}, h=${height}).`,
  );

  if (!APPLY) {
    console.log("\nDry-run terminé. Passe --yes pour appliquer.");
    return;
  }

  const pages = doc.getPages();
  if (pages.length <= SIGNATURE_PAGE_INDEX) {
    throw new Error(
      `Le PDF n'a que ${pages.length} page(s), impossible d'ajouter le widget sur la page ${
        SIGNATURE_PAGE_INDEX + 1
      }.`,
    );
  }
  const page = pages[SIGNATURE_PAGE_INDEX];

  const field = form.createTextField(SIGNATURE_FIELD_NAME);
  field.addToPage(page, { x, y, width, height });
  // Apparence neutre : le filler dessine son propre cadre + texte par-dessus,
  // on évite donc de définir une valeur par défaut visible côté Acrobat.
  field.setText("");
  // Garde le champ éditable côté PDF brut (le filler le rendra read-only via
  // flatten() après stamping).
  if (field instanceof PDFTextField) {
    // Empêche le multiline — un bloc signature tient sur une ligne logique.
    field.disableMultiline();
  }

  const out = await doc.save();
  writeFileSync(pdfPath, out);
  console.log(`\nPDF mis à jour (${out.byteLength} bytes écrits).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
