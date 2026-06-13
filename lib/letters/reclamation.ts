// Générateur de courrier de réclamation (PDF A4, 1 page) pour réclamer un
// document à fournir par un tiers (employeur ou autre organisme) dans le
// cadre de l'assemblage d'un dossier administratif.
//
// Fonction PURE : aucune dépendance à Prisma / au réseau. La route se charge
// de résoudre l'identité du citoyen puis appelle `buildReclamationLetterPdf`.
//
// Confidentialité : le texte est une rédaction française formelle ORIGINALE,
// volontairement générique. Aucune citation de loi ni source privée.

import { PDFDocument, StandardFonts, PDFFont, PDFPage } from "pdf-lib";

/// Bloc expéditeur (le citoyen). Tous les champs sont optionnels : quand
/// l'identité n'est pas connue, on rend des lignes vierges à compléter à la
/// main.
export interface LetterSender {
  firstName?: string | null;
  lastName?: string | null;
  street?: string | null;
  streetNum?: string | null;
  postalCode?: string | null;
  city?: string | null;
}

export type LetterResponsibility = "employer" | "external";

export interface ReclamationLetterInput {
  sender: LetterSender;
  /// Titre humain du document réclamé (ex. « Attestation C4 »).
  docTitle: string;
  responsibility: LetterResponsibility;
  /// Date déjà formatée (ex. « le 13 juin 2026 »). Fournie par la route pour
  /// garder la fonction pure (pas de dépendance à l'horloge ni à la locale).
  dateLabel: string;
}

// Dimensions A4 en points (1 pt = 1/72 inch).
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56; // ~2 cm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const SIZE_BODY = 11;
const SIZE_SMALL = 10;
const LINE_GAP = 5; // espace inter-ligne additionnel

/// Découpe un paragraphe en lignes qui tiennent dans `maxWidth` (points),
/// en respectant les frontières de mots. Les mots trop longs sont laissés
/// intacts (débordement très improbable pour un courrier).
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

/// Construit la ligne « Prénom Nom » de l'expéditeur, ou null si inconnue.
function senderName(s: LetterSender): string | null {
  const parts = [s.firstName, s.lastName].map((p) => (p ?? "").trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

/// Construit la ligne « N° rue » de l'expéditeur, ou null si inconnue.
function senderStreet(s: LetterSender): string | null {
  const parts = [s.streetNum, s.street].map((p) => (p ?? "").trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

/// Construit la ligne « 1000 Bruxelles » de l'expéditeur, ou null si inconnue.
function senderCity(s: LetterSender): string | null {
  const parts = [s.postalCode, s.city].map((p) => (p ?? "").trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

/// Petit utilitaire de rendu vertical : écrit une ligne et renvoie le nouveau y.
function drawLine(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; size: number; font: PDFFont }
): number {
  page.drawText(text, { x: opts.x, y: opts.y, size: opts.size, font: opts.font });
  return opts.y - (opts.size + LINE_GAP);
}

/// Génère le PDF du courrier de réclamation et renvoie ses octets.
export async function buildReclamationLetterPdf(
  input: ReclamationLetterInput
): Promise<Buffer> {
  const { sender, docTitle, responsibility, dateLabel } = input;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const left = MARGIN;
  let y = PAGE_HEIGHT - MARGIN;

  // --- Bloc expéditeur (haut-gauche) ---
  const name = senderName(sender);
  const street = senderStreet(sender);
  const city = senderCity(sender);
  if (name || street || city) {
    if (name) y = drawLine(page, name, { x: left, y, size: SIZE_BODY, font: bold });
    if (street) y = drawLine(page, street, { x: left, y, size: SIZE_BODY, font });
    if (city) y = drawLine(page, city, { x: left, y, size: SIZE_BODY, font });
  } else {
    // Identité inconnue : lignes vierges à compléter à la main.
    y = drawLine(page, "Nom et prénom : ______________________________", { x: left, y, size: SIZE_BODY, font });
    y = drawLine(page, "Adresse : _____________________________________", { x: left, y, size: SIZE_BODY, font });
    y = drawLine(page, "Code postal et localité : ____________________", { x: left, y, size: SIZE_BODY, font });
  }

  // --- Bloc destinataire (à droite, un peu plus bas) ---
  y -= 24;
  const recipientX = PAGE_WIDTH - MARGIN - 230;
  let ry = y;
  if (responsibility === "employer") {
    ry = drawLine(page, "À l'attention de mon (ex-)employeur", { x: recipientX, y: ry, size: SIZE_BODY, font: bold });
  } else {
    ry = drawLine(page, "À l'attention de l'organisme concerné", { x: recipientX, y: ry, size: SIZE_BODY, font: bold });
  }
  ry = drawLine(page, "Nom / société : _____________________", { x: recipientX, y: ry, size: SIZE_SMALL, font });
  ry = drawLine(page, "Adresse : __________________________", { x: recipientX, y: ry, size: SIZE_SMALL, font });
  ry = drawLine(page, "Code postal et localité : ___________", { x: recipientX, y: ry, size: SIZE_SMALL, font });

  // Le bloc destinataire est plus haut que le curseur principal ; on reprend
  // sous le plus bas des deux.
  y = Math.min(y, ry) - 28;

  // --- Lieu et date (à droite) ---
  const dateText = `Fait à ____________________, ${dateLabel}.`;
  const dateWidth = font.widthOfTextAtSize(dateText, SIZE_BODY);
  page.drawText(dateText, {
    x: PAGE_WIDTH - MARGIN - dateWidth,
    y,
    size: SIZE_BODY,
    font,
  });
  y -= SIZE_BODY + 24;

  // --- Objet ---
  const objet = `Objet : demande de remise du document « ${docTitle} »`;
  for (const line of wrapText(objet, bold, SIZE_BODY, CONTENT_WIDTH)) {
    y = drawLine(page, line, { x: left, y, size: SIZE_BODY, font: bold });
  }
  y -= 14;

  // --- Corps (paragraphes formels génériques, rédaction originale) ---
  y = drawLine(page, "Madame, Monsieur,", { x: left, y, size: SIZE_BODY, font });
  y -= 8;

  const recipientPhrase =
    responsibility === "employer"
      ? "Dans le cadre de la constitution d'un dossier administratif me concernant, je suis tenu(e) de fournir le document mentionné en objet, qui relève de votre responsabilité en tant qu'(ex-)employeur."
      : "Dans le cadre de la constitution d'un dossier administratif me concernant, je suis tenu(e) de fournir le document mentionné en objet, qui relève de votre responsabilité.";

  const paragraphs = [
    recipientPhrase,
    "Je vous saurais gré de bien vouloir me remettre ce document dans les meilleurs délais, ce dernier étant nécessaire pour compléter mon dossier et éviter tout retard dans son traitement.",
    "Je reste à votre disposition pour vous transmettre toute information complémentaire qui vous serait utile, et vous remercie par avance de l'attention que vous porterez à ma demande.",
  ];

  for (const para of paragraphs) {
    for (const line of wrapText(para, font, SIZE_BODY, CONTENT_WIDTH)) {
      y = drawLine(page, line, { x: left, y, size: SIZE_BODY, font });
    }
    y -= 8;
  }

  // --- Formule de politesse ---
  y -= 2;
  for (const line of wrapText(
    "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
    font,
    SIZE_BODY,
    CONTENT_WIDTH
  )) {
    y = drawLine(page, line, { x: left, y, size: SIZE_BODY, font });
  }

  // --- Bloc signature ---
  y -= 40;
  const signatureX = PAGE_WIDTH - MARGIN - 230;
  page.drawText("Signature :", { x: signatureX, y, size: SIZE_BODY, font });
  if (name) {
    page.drawText(name, { x: signatureX, y: y - (SIZE_BODY + 18), size: SIZE_BODY, font: bold });
  } else {
    page.drawText("____________________________", {
      x: signatureX,
      y: y - (SIZE_BODY + 18),
      size: SIZE_BODY,
      font,
    });
  }

  return Buffer.from(await pdf.save());
}
