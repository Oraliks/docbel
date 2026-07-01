import { describe, it, expect } from "vitest";
import { allowedVisibilities } from "../context";

/**
 * Contrat de sécurité du gating du corpus légal RioLex.
 * Le retrieval (buildKnowledgeContext / buildKnowledgeContextRag) applique
 * `visibility = ANY(visibilities)` avec un défaut sécurisé `["public"]`.
 * Ces tests verrouillent le mapping rôle → visibilités autorisées : un viewer
 * citoyen/public ne doit JAMAIS pouvoir récupérer une source partner/admin.
 */
describe("allowedVisibilities — gating corpus légal", () => {
  it("public / citoyen → uniquement 'public'", () => {
    expect(allowedVisibilities("public")).toEqual(["public"]);
  });

  it("public ne contient jamais partner ni admin", () => {
    const v = allowedVisibilities("public");
    expect(v).not.toContain("partner");
    expect(v).not.toContain("admin");
  });

  it("partenaire → 'public' + 'partner', mais jamais 'admin'", () => {
    const v = allowedVisibilities("partner");
    expect(v).toContain("public");
    expect(v).toContain("partner");
    expect(v).not.toContain("admin");
  });

  it("admin → 'public' + 'partner' + 'admin'", () => {
    expect([...allowedVisibilities("admin")].sort()).toEqual([
      "admin",
      "partner",
      "public",
    ]);
  });
});
