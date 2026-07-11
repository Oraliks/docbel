import { describe, it, expect } from "vitest";
import { loadPublishedTreeContent } from "@/lib/decision-builder/loader";

describe("loadPublishedTreeContent", () => {
  it("est exportée et renvoie une promesse", () => {
    expect(typeof loadPublishedTreeContent).toBe("function");
    // Flag runtime OFF par défaut en test → null, sans toucher la DB.
    return expect(loadPublishedTreeContent("chomage")).resolves.toBeNull();
  });
});
