import { describe, it, expect } from "vitest";
import { pdfToHtml, htmlToPdf, getPageGeometry, type PageGeometry, type PdfRect, type HtmlRect } from "../coords";

const A4: PageGeometry = { width: 595, height: 842, offsetX: 0, offsetY: 0 };
const LETTER: PageGeometry = { width: 612, height: 792, offsetX: 0, offsetY: 0 };
const A3_OFFSET: PageGeometry = { width: 842, height: 1191, offsetX: 36, offsetY: 24 };

function expectRect(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  expect(a.x).toBeCloseTo(b.x, 5);
  expect(a.y).toBeCloseTo(b.y, 5);
  expect(a.w).toBeCloseTo(b.w, 5);
  expect(a.h).toBeCloseTo(b.h, 5);
}

describe("pdfToHtml / htmlToPdf", () => {
  it("A4 scale=1 : champ près du bas-gauche", () => {
    const pdf: PdfRect = { x: 50, y: 50, w: 200, h: 20 };
    const html = pdfToHtml(pdf, A4, 1);
    expectRect(html, { x: 50, y: 842 - 50 - 20, w: 200, h: 20 });
    expectRect(htmlToPdf(html, A4, 1), pdf);
  });

  it("A4 scale=2 : multiplie largeur/hauteur", () => {
    const pdf: PdfRect = { x: 50, y: 50, w: 200, h: 20 };
    const html = pdfToHtml(pdf, A4, 2);
    expectRect(html, { x: 100, y: (842 - 50 - 20) * 2, w: 400, h: 40 });
    expectRect(htmlToPdf(html, A4, 2), pdf);
  });

  it("Letter scale=1 : champ au milieu de page", () => {
    const pdf: PdfRect = { x: 100, y: 400, w: 300, h: 30 };
    const html = pdfToHtml(pdf, LETTER, 1);
    expectRect(html, { x: 100, y: 792 - 400 - 30, w: 300, h: 30 });
    expectRect(htmlToPdf(html, LETTER, 1), pdf);
  });

  it("Letter scale=2 : champ au milieu", () => {
    const pdf: PdfRect = { x: 100, y: 400, w: 300, h: 30 };
    const html = pdfToHtml(pdf, LETTER, 2);
    expectRect(html, { x: 200, y: (792 - 400 - 30) * 2, w: 600, h: 60 });
    expectRect(htmlToPdf(html, LETTER, 2), pdf);
  });

  it("A3 avec CropBox offset (36,24) scale=1", () => {
    // user-space y=24 + h=20 → en haut de la CropBox visible
    const pdf: PdfRect = { x: 36, y: 24, w: 100, h: 20 };
    const html = pdfToHtml(pdf, A3_OFFSET, 1);
    expectRect(html, { x: 0, y: 1191 - 0 - 20, w: 100, h: 20 });
    expectRect(htmlToPdf(html, A3_OFFSET, 1), pdf);
  });

  it("A3 avec CropBox offset scale=2", () => {
    const pdf: PdfRect = { x: 36 + 50, y: 24 + 100, w: 120, h: 40 };
    const html = pdfToHtml(pdf, A3_OFFSET, 2);
    expectRect(html, { x: 100, y: (1191 - 100 - 40) * 2, w: 240, h: 80 });
    expectRect(htmlToPdf(html, A3_OFFSET, 2), pdf);
  });

  it("roundtrip aléatoire A4 scale=1.5", () => {
    const pdf: PdfRect = { x: 123.4, y: 456.7, w: 89, h: 17 };
    const html = pdfToHtml(pdf, A4, 1.5);
    expectRect(htmlToPdf(html, A4, 1.5), pdf);
  });

  it("roundtrip HTML→PDF→HTML reste stable", () => {
    const html: HtmlRect = { x: 200, y: 300, w: 150, h: 25 };
    const pdf = htmlToPdf(html, A4, 1.3);
    expectRect(pdfToHtml(pdf, A4, 1.3), html);
  });
});

describe("getPageGeometry", () => {
  it("lit la CropBox d'une page pdf-lib (pas la MediaBox)", () => {
    const fakePage = {
      getCropBox: () => ({ x: 10, y: 20, width: 500, height: 700 }),
    };
    const geo = getPageGeometry(fakePage);
    expect(geo).toEqual({ width: 500, height: 700, offsetX: 10, offsetY: 20 });
  });

  it("CropBox sans offset → offsets 0", () => {
    const fakePage = {
      getCropBox: () => ({ x: 0, y: 0, width: 595, height: 842 }),
    };
    expect(getPageGeometry(fakePage)).toEqual({ width: 595, height: 842, offsetX: 0, offsetY: 0 });
  });
});
