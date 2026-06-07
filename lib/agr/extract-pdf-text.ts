/**
 * Extraction du texte d'un WECH 506.
 *
 * On utilise `pdf-parse` (sans worker) plutôt que pdfjs : fiable côté serveur
 * (y compris serverless) et sans le problème de résolution du worker dans le
 * bundle Next. Le WECH 506 (généré par Apache FOP) ressort en lignes propres,
 * ce qui suffit au parseur (`parse-wech506.ts`), grille comprise.
 *
 * Server-only.
 */

interface PdfParsePage {
  text?: string;
}
interface PdfParseResult {
  text?: string | null;
  pages?: PdfParsePage[];
}

export async function extractWechText(data: Uint8Array): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  try {
    const res = (await parser.getText()) as PdfParseResult;
    const raw =
      res.text ??
      (res.pages ?? []).map((p) => p.text ?? "").filter(Boolean).join("\n");
    return (raw ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/^-+ \d+ of \d+ -+$/gm, "") // marqueurs de page « -- 1 of 6 -- »
      .trim();
  } finally {
    await parser.destroy();
  }
}
