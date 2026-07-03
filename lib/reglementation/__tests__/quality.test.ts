// lib/reglementation/__tests__/quality.test.ts
import { describe, it, expect } from "vitest";
import { auditCorpus, type AuditRow } from "../quality";

function row(over: Partial<AuditRow>): AuditRow {
  return {
    riolexId: "25_11_1991-1-art_1",
    loi: "AR 25/11/1991",
    articleNumber: "1",
    title: "Titre",
    content: "Un contenu normal et suffisamment long pour ne rien déclencher.",
    contentLength: 60,
    version: null,
    datePublication: null,
    abroge: false,
    isComment: false,
    ...over,
  };
}

describe("auditCorpus", () => {
  it("corpus sain → aucune anomalie", () => {
    const res = auditCorpus([row({}), row({ articleNumber: "2" })]);
    expect(res.issues).toHaveLength(0);
    expect(res.total).toBe(2);
  });

  it("détecte un contenu vide", () => {
    const res = auditCorpus([row({ content: "   ", contentLength: 0 })]);
    expect(res.byKind["empty-content"]).toBe(1);
  });

  it("détecte un commentaire tronqué", () => {
    const res = auditCorpus([
      row({ isComment: true, content: "Le principe est […] appliqué." }),
    ]);
    expect(res.byKind["truncated-comment"]).toBe(1);
  });

  it("détecte un corps placeholder non marqué abrogé", () => {
    const res = auditCorpus([row({ content: "{1} ❌ {2} ❌ {3} ❌", contentLength: 20 })]);
    expect(res.byKind["placeholder-body"]).toBe(1);
  });

  it("ignore le placeholder si l'article est marqué abrogé", () => {
    const res = auditCorpus([
      row({ content: "{1} ❌ {2} ❌", contentLength: 12, abroge: true }),
    ]);
    expect(res.byKind["placeholder-body"]).toBe(0);
  });

  it("détecte le champ version = n° d'article", () => {
    const res = auditCorpus([row({ articleNumber: "84", version: "84" })]);
    expect(res.byKind["version-artefact"]).toBe(1);
  });
});
