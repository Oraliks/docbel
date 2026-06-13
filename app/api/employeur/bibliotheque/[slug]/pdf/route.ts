/**
 * Export PDF d'un article de la bibliothèque employeur (Module 4).
 *
 * Style DOCBEL aligné sur lib/employeur/export-checklist-pdf.ts (en-tête, sections
 * numérotées, pied de page, encart d'avertissement obligatoire `PDF_DISCLAIMER`).
 * Renvoie un application/pdf. Auth : employeur ou admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireEmployerOrAdminAuth } from "@/lib/auth-check";
import { getSourceMap } from "@/lib/employeur/queries";
import { getArticle } from "@/lib/employeur/library/articles";
import { PDF_DISCLAIMER } from "@/lib/employeur/export-checklist-pdf";

const VIOLET: [number, number, number] = [124, 58, 237];
const VIOLET_DARK: [number, number, number] = [88, 28, 135];
const NAVY: [number, number, number] = [30, 27, 75];
const GREY: [number, number, number] = [115, 115, 125];

export async function GET(_req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const auth = await requireEmployerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { slug } = await context.params;
  const article = getArticle(slug);
  if (!article) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const sourceMap = await getSourceMap();

  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 14;
    const contentW = W - 2 * M;
    let y = 0;

    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-BE");
    const timeStr = now.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });

    const ensure = (needed: number) => {
      if (y + needed > H - 22) {
        doc.addPage();
        y = M + 4;
      }
    };

    /* En-tête DOCBEL */
    doc.setFillColor(...VIOLET);
    doc.roundedRect(M, 12, 9, 9, 2, 2, "F");
    doc.setFontSize(18);
    doc.setFont("", "bold");
    doc.setTextColor(...NAVY);
    doc.text("DOCBEL", M + 12, 18.5);
    doc.setFontSize(7.5);
    doc.setFont("", "normal");
    doc.setTextColor(...VIOLET);
    doc.text("Espace Employeur", M + 12, 23);
    doc.setFontSize(8.5);
    doc.setTextColor(...GREY);
    doc.text(`Généré le ${dateStr} à ${timeStr}`, W - M, 15, { align: "right" });
    doc.text("https://www.docbel.be", W - M, 19.5, { align: "right" });

    /* Titre + résumé */
    doc.setFontSize(16);
    doc.setFont("", "bold");
    doc.setTextColor(...VIOLET_DARK);
    const titleLines = doc.splitTextToSize(article.title, contentW) as string[];
    doc.text(titleLines, W / 2, 33, { align: "center" });
    let headerBottom = 33 + titleLines.length * 7;
    doc.setFontSize(9);
    doc.setFont("", "normal");
    doc.setTextColor(...GREY);
    const summaryLines = doc.splitTextToSize(article.summary, contentW - 10) as string[];
    doc.text(summaryLines, W / 2, headerBottom, { align: "center" });
    headerBottom += summaryLines.length * 4.4;
    y = headerBottom + 6;

    let sectionNo = 0;
    const sectionHeader = (label: string) => {
      sectionNo += 1;
      ensure(14);
      doc.setFillColor(...VIOLET);
      doc.roundedRect(M, y, 6, 6, 1.4, 1.4, "F");
      doc.setFontSize(9);
      doc.setFont("", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(String(sectionNo), M + 3, y + 4.2, { align: "center" });
      doc.setFontSize(10.5);
      doc.setTextColor(...VIOLET_DARK);
      doc.text(label.toUpperCase(), M + 9, y + 4.6, { charSpace: 0.4 });
      y += 9;
    };

    const bulletSection = (label: string, items: string[]) => {
      if (items.length === 0) return;
      sectionHeader(label);
      for (const item of items) {
        const lines = doc.splitTextToSize(`•  ${item}`, contentW - 4) as string[];
        ensure(lines.length * 4.4 + 1.5);
        doc.setFont("", "normal");
        doc.setFontSize(9);
        doc.setTextColor(25, 25, 25);
        doc.text(lines, M + 2, y);
        y += lines.length * 4.4 + 1.5;
      }
      y += 3;
    };

    bulletSection("Ce que vous devez savoir", article.whatToKnow);
    bulletSection("À faire", article.todo);
    bulletSection("Documents nécessaires", article.documents);
    bulletSection("Erreurs fréquentes", article.commonMistakes);

    /* Sources officielles */
    if (article.sourceCodes.length > 0) {
      sectionHeader("Sources officielles");
      for (const code of article.sourceCodes) {
        const s = sourceMap.get(code);
        ensure(8);
        doc.setFont("", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(20, 20, 20);
        doc.text(`${code} — ${s?.title ?? code}`, M + 2, y);
        y += 4;
        doc.setFont("", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...GREY);
        doc.text(`${s?.institution ?? ""} · ${s?.url ?? ""}`, M + 2, y);
        y += 5;
      }
      y += 2;
    }

    /* Avertissement obligatoire */
    const warnLines = doc.splitTextToSize(PDF_DISCLAIMER, contentW - 14) as string[];
    const warnH = warnLines.length * 4 + 8;
    ensure(warnH + 2);
    doc.setFillColor(255, 249, 240);
    doc.setDrawColor(240, 200, 120);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, y, contentW, warnH, 2, 2, "FD");
    doc.setFillColor(230, 160, 30);
    doc.circle(M + 6, y + warnH / 2, 2.4, "F");
    doc.setFont("", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("!", M + 6, y + warnH / 2 + 1.4, { align: "center" });
    doc.setFont("", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 100, 20);
    doc.text(warnLines, M + 11, y + 6);

    /* Bandeau de pied */
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p += 1) {
      doc.setPage(p);
      doc.setFillColor(...VIOLET);
      doc.rect(0, H - 11, W, 11, "F");
      doc.setFont("", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(`Docbel © ${now.getFullYear()}  |  https://www.docbel.be`, M, H - 4);
      doc.text(`${p} / ${pages}`, W - M, H - 4, { align: "right" });
    }

    const buffer = Buffer.from(doc.output("arraybuffer"));
    const filename = `docbel-bibliotheque-${article.slug}.pdf`;
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[employeur] bibliotheque pdf generation failed:", error);
    return NextResponse.json({ error: "Échec de la génération du PDF." }, { status: 500 });
  }
}
