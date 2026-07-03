// lib/reglementation/__tests__/query-intent.test.ts
import { describe, it, expect } from "vitest";
import { parseQueryIntent } from "../query-intent";

describe("parseQueryIntent", () => {
  it("détecte « art. 79 »", () => {
    expect(parseQueryIntent("art. 79")).toEqual({ articleNumber: "79", nature: null });
  });

  it("détecte « article 131bis »", () => {
    expect(parseQueryIntent("article 131bis").articleNumber).toBe("131bis");
  });

  it("détecte un numéro nu « 79bis »", () => {
    expect(parseQueryIntent("79bis").articleNumber).toBe("79bis");
  });

  it("détecte la nature « am 75ter »", () => {
    expect(parseQueryIntent("am 75ter")).toEqual({ articleNumber: "75ter", nature: "AM" });
  });

  it("détecte « AR article 44 »", () => {
    expect(parseQueryIntent("AR article 44")).toEqual({ articleNumber: "44", nature: "AR" });
  });

  it("ne confond pas « art » avec la nature AR", () => {
    expect(parseQueryIntent("art. 100").nature).toBeNull();
  });

  it("requête conceptuelle → aucun numéro", () => {
    expect(parseQueryIntent("allocation de garantie de revenus").articleNumber).toBeNull();
  });

  it("vide → null/null", () => {
    expect(parseQueryIntent("")).toEqual({ articleNumber: null, nature: null });
  });
});
