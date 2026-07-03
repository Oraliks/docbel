// lib/reglementation/__tests__/parse-amendments.test.ts
import { describe, it, expect } from "vitest";
import {
  parseAmendmentRef,
  parseInline,
  extractAmendments,
  latestEV,
} from "../parse-amendments";

describe("parseAmendmentRef", () => {
  it("parse une ref complète AR - MB - EV", () => {
    const r = parseAmendmentRef("(AR 30.7.2022 - MB 23.8 - EV 1.10)");
    expect(r).not.toBeNull();
    expect(r!.nature).toBe("AR");
    expect(r!.dateActe).toBe("30/07/2022");
    expect(r!.dateMB).toBe("23/08/2022"); // année héritée de l'acte
    expect(r!.dateEV).toBe("01/10/2022"); // année héritée de l'acte
    expect(r!.evYear).toBe(2022);
  });

  it("parse une Loi-programme avec EV daté", () => {
    const r = parseAmendmentRef("(Loi-programme 18.7.2025 - MB 29.7 - EV 1.3.2026)");
    expect(r!.nature).toBe("Loi-programme");
    expect(r!.dateActe).toBe("18/07/2025");
    expect(r!.dateEV).toBe("01/03/2026");
    expect(r!.evYear).toBe(2026);
  });

  it("parse une ref courte sans MB ni EV", () => {
    const r = parseAmendmentRef("(AM 30.11.1995)");
    expect(r!.nature).toBe("AM");
    expect(r!.dateActe).toBe("30/11/1995");
    expect(r!.dateMB).toBeNull();
    expect(r!.dateEV).toBeNull();
  });

  it("parse une ref avec MB sans EV", () => {
    const r = parseAmendmentRef("(AR 25.2.1994 - MB 29.3)");
    expect(r!.nature).toBe("AR");
    expect(r!.dateMB).toBe("29/03/1994");
    expect(r!.dateEV).toBeNull();
  });

  it("EV non daté (« à déterminer ») → conservé en texte", () => {
    const r = parseAmendmentRef("(AR 1.1.2020 - EV à déterminer)");
    expect(r!.dateEV).toBe("à déterminer");
    expect(r!.evYear).toBeNull();
  });

  it("renvoie null pour une parenthèse non-amendement", () => {
    expect(parseAmendmentRef("(Gouvernement fédéral)")).toBeNull();
    expect(parseAmendmentRef("(l'article 7 de l'arrêté-loi)")).toBeNull();
    expect(parseAmendmentRef("(présent arrêté)")).toBeNull();
  });
});

describe("parseInline", () => {
  it("texte simple → un seul segment texte", () => {
    const seg = parseInline("Le chômeur complet doit être disponible.");
    expect(seg).toHaveLength(1);
    expect(seg[0]).toEqual({ t: "text", text: "Le chômeur complet doit être disponible." });
  });

  it("extrait une ref d'amendement en segment cliquable", () => {
    const seg = parseInline(
      "le travailleur des arts.(AR 30.7.2022 - MB 23.8 - EV 1.10)",
    );
    const amd = seg.find((s) => s.t === "amendment");
    expect(amd).toBeTruthy();
    expect(seg[0]).toMatchObject({ t: "text" });
  });

  it("« {n} ❌ » → segment supprimé (consomme l'accolade et la croix)", () => {
    const seg = parseInline("maintien des droits {2} ❌, le travailleur");
    expect(seg.some((s) => s.t === "deleted")).toBe(true);
    // la croix et l'accolade ne restent pas dans le texte
    const joined = seg.filter((s) => s.t === "text").map((s) => (s as { text: string }).text).join("");
    expect(joined).not.toContain("❌");
    expect(joined).not.toContain("{2}");
  });

  it("« {n} » seul → segment modifié", () => {
    const seg = parseInline("Abrogé. (AR 22.11.1995){1}");
    expect(seg.some((s) => s.t === "modified")).toBe(true);
  });

  it("plusieurs {n} ❌ consécutifs (corps d'article abrogé)", () => {
    const seg = parseInline("{1} ❌ {2} ❌ {3} ❌");
    expect(seg.filter((s) => s.t === "deleted")).toHaveLength(3);
  });

  it("ne jette jamais sur entrée vide", () => {
    expect(parseInline("")).toEqual([]);
    expect(() => parseInline("   ")).not.toThrow();
  });
});

describe("extractAmendments", () => {
  it("collecte toutes les refs d'un texte multi-lignes", () => {
    const raw = [
      "a) texte (AR 30.7.2022 - MB 23.8 - EV 1.10)",
      "b) autre (AM 15.7.1993)",
      "c) inchangé sans ref",
    ].join("\n");
    const refs = extractAmendments(raw);
    expect(refs).toHaveLength(2);
  });

  it("déduplique les refs identiques", () => {
    const refs = extractAmendments("x (AM 15.7.1993) y (AM 15.7.1993)");
    expect(refs).toHaveLength(1);
  });
});

describe("latestEV", () => {
  it("renvoie la date EV la plus récente", () => {
    const refs = extractAmendments(
      "a (AR 30.7.2022 - MB 23.8 - EV 1.10) b (Loi-programme 18.7.2025 - MB 29.7 - EV 1.3.2026)",
    );
    expect(latestEV(refs)).toBe("01/03/2026");
  });

  it("aucune EV → null", () => {
    expect(latestEV(extractAmendments("x (AM 30.11.1995)"))).toBeNull();
  });
});
