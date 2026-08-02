// Page de garde A4 « Et maintenant ? » ajoutée en tête du zip et de l'e-mail.
// Page d'AIDE, pas un formulaire : bandeau explicite pour qu'elle ne soit
// jamais confondue avec un document officiel (spec). Helvetica standard
// (WinAnsi) : pas de police embarquée, pas de caractères hors CP1252.

import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { OP_LABELS, type FeuilleDeRoute } from "./model";

const A4: [number, number] = [595.28, 841.89];
const MARGE = 50;
const ENCRE = rgb(0.13, 0.12, 0.2);
const DOUX = rgb(0.35, 0.33, 0.45);

/// Helvetica n'encode que WinAnsi (CP1252). Les titres de documents viennent
/// de la base (localisables) : un glyphe hors charte ferait jeter drawText et
/// priverait le zip de sa page d'aide. On remplace l'inconnu par « ? » —
/// dégradé lisible plutôt que crash.
function winAnsiSafe(text: string): string {
  // Latin-1 imprimable + extras CP1252 usuels (guillemets typographiques,
  // tirets, points de suspension, œ/Œ, €).
  return text.replace(/[^\x20-\x7E\xA0-\xFF‘’“”–—…Œœ€]/g, "?");
}

/// Découpe un texte en lignes tenant dans maxWidth (pdf-lib ne wrappe pas).
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const mots = text.split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  let ligne = "";
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (font.widthOfTextAtSize(essai, size) <= maxWidth) ligne = essai;
    else {
      if (ligne) lignes.push(ligne);
      ligne = mot;
    }
  }
  if (ligne) lignes.push(ligne);
  return lignes.length > 0 ? lignes : [""];
}

export async function buildPageDeGarde(feuille: FeuilleDeRoute): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(A4);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const largeur = A4[0] - 2 * MARGE;
  let y = A4[1] - MARGE;

  const ecrit = (
    text: string,
    opts: { font?: PDFFont; size?: number; gap?: number; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10.5;
    for (const ligne of wrap(winAnsiSafe(text), font, size, largeur)) {
      y -= size + 3;
      page.drawText(ligne, { x: MARGE, y, size, font, color: opts.color ?? ENCRE });
    }
    y -= opts.gap ?? 6;
  };

  ecrit("Et maintenant ?", { font: bold, size: 20, gap: 2 });
  ecrit(
    "Page d'aide Docbel - à conserver avec vos documents, ne pas envoyer à l'ONEM ni à votre organisme de paiement.",
    { size: 9, color: DOUX, gap: 14 },
  );

  ecrit("1. Où déposer vos documents", { font: bold, size: 13, gap: 4 });
  if (feuille.depot.mode === "bureau") {
    const b = feuille.depot.bureau;
    ecrit(
      `Déposez l'ensemble de vos documents auprès de votre organisme de paiement (${OP_LABELS[feuille.depot.opCode]}).`,
    );
    ecrit(`${b.nom} - ${b.adresse}`, { font: bold });
    if (b.telephone) ecrit(`Téléphone : ${b.telephone}`);
    if (b.siteWeb) ecrit(`Site : ${b.siteWeb}`);
  } else if (feuille.depot.mode === "choix") {
    ecrit(
      "Déposez l'ensemble de vos documents auprès de VOTRE organisme de paiement (celui auprès duquel vous êtes inscrit). Bureaux compétents" +
        (feuille.communeName ? ` pour ${feuille.communeName}` : "") +
        " :",
    );
    for (const b of feuille.depot.bureaux) {
      ecrit(`${OP_LABELS[b.opCode]} : ${b.nom} - ${b.adresse}`);
    }
  } else {
    ecrit(
      "Déposez l'ensemble de vos documents auprès de votre organisme de paiement (CAPAC ou votre organisme syndical). Retrouvez le bureau compétent pour votre commune sur la page Bureaux de Docbel.",
    );
  }
  y -= 8;

  ecrit("2. Signatures et exemplaires", { font: bold, size: 13, gap: 4 });
  for (const c of feuille.consignes) {
    const ex = c.exemplaires > 1 ? `${c.exemplaires} exemplaires` : "1 exemplaire";
    ecrit(`- ${c.titre} : ${c.signatures} (${ex})`);
  }
  y -= 8;

  if (feuille.pieces.length > 0) {
    ecrit("3. Documents de votre dossier", { font: bold, size: 13, gap: 4 });
    for (const p of feuille.pieces) ecrit(`- ${p.titre}`);
    y -= 8;
  }

  ecrit(feuille.prudence, { size: 9, color: DOUX });
  return doc.save();
}
