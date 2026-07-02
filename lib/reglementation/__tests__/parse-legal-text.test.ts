// lib/reglementation/__tests__/parse-legal-text.test.ts
import { describe, it, expect } from "vitest";
import { parseLegalText, splitOnemCommentary } from "../parse-legal-text";

describe("parseLegalText", () => {
  it("texte vide → []", () => {
    expect(parseLegalText("")).toEqual([]);
    expect(parseLegalText("   \n  ")).toEqual([]);
  });

  it("détecte les paragraphes § et les alinéas numérotés", () => {
    const raw = [
      "§ 1er. Le chômeur complet doit être disponible.",
      "",
      "§ 2. Le Roi peut, par arrêté délibéré :",
      "1° les catégories concernées ;",
      "2° les conditions.",
    ].join("\n");
    const blocks = parseLegalText(raw);
    expect(blocks[0]).toMatchObject({ type: "section", marker: "§ 1er" });
    expect(blocks.find((b) => b.type === "section" && b.marker === "§ 2")).toBeTruthy();
    const items = blocks.filter((b) => b.type === "list-item");
    expect(items).toHaveLength(2);
    expect(items[0].marker).toBe("1°");
  });

  it("détecte les listes à tirets", () => {
    const blocks = parseLegalText("- une semaine ;\n- six semaines ;");
    expect(blocks.filter((b) => b.type === "list-item")).toHaveLength(2);
  });

  it("marque un article abrogé", () => {
    const blocks = parseLegalText("[Abrogé. (AM 5.3.2006 - MB 15.3)]");
    expect(blocks[0].type).toBe("abroge");
  });

  it("ne jette jamais (entrée bizarre → au moins 1 bloc paragraphe)", () => {
    const blocks = parseLegalText("texte sans structure particulière 123 %%%");
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0].type).toBe("paragraph");
  });
});

describe("splitOnemCommentary", () => {
  it("découpe plusieurs 'Commentaire N' avec date/institution", () => {
    const raw = [
      "Commentaire 1",
      "(23/04/2018) (Gouvernement fédéral)",
      "Les préavis notifiés avant le 1.5.2018 continuent.",
      "Commentaire 2",
      "(01/01/2020) (ONEM)",
      "Autre précision.",
    ].join("\n");
    const cs = splitOnemCommentary(raw);
    expect(cs).toHaveLength(2);
    expect(cs[0].index).toBe(1);
    expect(cs[0].date).toBe("23/04/2018");
    expect(cs[0].institution).toBe("Gouvernement fédéral");
    expect(cs[0].text).toContain("préavis");
  });

  it("aucun marqueur → un seul bloc", () => {
    const cs = splitOnemCommentary("Simple note sans marqueur.");
    expect(cs).toHaveLength(1);
    expect(cs[0].index).toBe(1);
  });

  it("vide → []", () => {
    expect(splitOnemCommentary("")).toEqual([]);
  });
});
