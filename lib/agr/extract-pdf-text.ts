/**
 * Extraction du texte d'un WECH 506.
 *
 * On utilise `unpdf` (build pdfjs « serverless », sans worker ni dépendance
 * native `canvas`) : fiable en local ET sur Vercel/edge, là où pdfjs-dist /
 * pdf-parse échouent (« Cannot find module pdf.worker.mjs » côté lambda).
 *
 * On reconstruit les lignes par ordonnée (y) puis on ordonne par abscisse (x),
 * indispensable pour lire la grille de travail (colonnes Jours/Code/Heure).
 *
 * Server-only.
 */

interface TextItem {
  str?: string;
  transform?: number[];
}

export async function extractWechText(data: Uint8Array): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(data);

  const out: string[] = [];
  const maxPages = Math.min(pdf.numPages, 12);
  for (let pg = 1; pg <= maxPages; pg++) {
    const page = await pdf.getPage(pg);
    const tc = await page.getTextContent();
    const items = (tc.items as TextItem[])
      .filter((i) => i.str && i.str.trim().length > 0 && i.transform)
      .map((i) => ({
        s: i.str as string,
        x: Math.round(i.transform![4]),
        y: Math.round(i.transform![5]),
      }));

    const lines: { y: number; parts: { s: string; x: number }[] }[] = [];
    for (const it of items) {
      let line = lines.find((l) => Math.abs(l.y - it.y) <= 3);
      if (!line) {
        line = { y: it.y, parts: [] };
        lines.push(line);
      }
      line.parts.push({ s: it.s, x: it.x });
    }
    lines.sort((a, b) => b.y - a.y);
    for (const l of lines) {
      l.parts.sort((a, b) => a.x - b.x);
      out.push(l.parts.map((p) => p.s).join(" ").replace(/\s+/g, " ").trim());
    }
  }
  return out.join("\n").trim();
}
