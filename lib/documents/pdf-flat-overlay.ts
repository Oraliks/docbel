import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DocumentField, GenerationPayload } from "./types";

export interface OverlayOptions {
  /// Image PNG (data URL ou Buffer) à apposer comme signature.
  signature?: { dataUrl?: string; buffer?: Buffer } | null;
  /// Position explicite de la signature (override le champ de type "signature" si fourni).
  signaturePosition?: { page: number; x: number; y: number; w: number; h: number } | null;
}

export async function overlayPdfFlat(
  buffer: Buffer,
  fields: DocumentField[],
  payload: GenerationPayload,
  options: OverlayOptions = {}
): Promise<Buffer> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  // Préparer image signature si fournie
  let signatureImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (options.signature) {
    const sigBuffer = options.signature.buffer
      ? options.signature.buffer
      : options.signature.dataUrl
        ? Buffer.from(
            options.signature.dataUrl.replace(/^data:image\/\w+;base64,/, ""),
            "base64"
          )
        : null;
    if (sigBuffer) {
      try {
        signatureImage = await doc.embedPng(sigBuffer);
      } catch {
        // Si PNG échoue, tenter JPG
        try {
          signatureImage = await doc.embedJpg(sigBuffer);
        } catch {
          signatureImage = null;
        }
      }
    }
  }

  for (const field of fields) {
    if (!field.position) continue;

    const page = pages[field.position.page];
    if (!page) continue;

    const fontSize = field.position.fontSize || 11;

    // Champ signature : on appose l'image si dispo
    if (field.type === "signature") {
      if (signatureImage) {
        const w = field.position.w > 0 ? field.position.w : 150;
        const h = field.position.h > 0 ? field.position.h : 50;
        // Préserver l'aspect ratio de la signature dans la zone définie
        const imgRatio = signatureImage.width / signatureImage.height;
        const boxRatio = w / h;
        let drawW = w;
        let drawH = h;
        if (imgRatio > boxRatio) {
          drawH = w / imgRatio;
        } else {
          drawW = h * imgRatio;
        }
        page.drawImage(signatureImage, {
          x: field.position.x + (w - drawW) / 2,
          y: field.position.y + (h - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      }
      continue;
    }

    const v = payload[field.id];
    if (v === null || v === undefined || v === "") continue;

    if (field.type === "checkbox") {
      if (v && v !== "false" && v !== "0") {
        page.drawText("X", {
          x: field.position.x,
          y: field.position.y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
      continue;
    }

    const text = String(v);
    page.drawText(text, {
      x: field.position.x,
      y: field.position.y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth: field.position.w > 0 ? field.position.w : undefined,
    });
  }

  // Position de signature explicite (override) — utile si pas de champ "signature" dans le schema
  if (options.signaturePosition && signatureImage) {
    const sp = options.signaturePosition;
    const page = pages[sp.page];
    if (page) {
      const imgRatio = signatureImage.width / signatureImage.height;
      const boxRatio = sp.w / sp.h;
      let drawW = sp.w;
      let drawH = sp.h;
      if (imgRatio > boxRatio) {
        drawH = sp.w / imgRatio;
      } else {
        drawW = sp.h * imgRatio;
      }
      page.drawImage(signatureImage, {
        x: sp.x + (sp.w - drawW) / 2,
        y: sp.y + (sp.h - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    }
  }

  const out = await doc.save();
  return Buffer.from(out);
}
