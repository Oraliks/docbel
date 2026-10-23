import { describe, expect, it } from "vitest";
import { isPublicJourney, isPublicNavActive } from "../public-navigation";

describe("public navigation", () => {
  it.each(["/d/chomage", "/document/onem/c1", "/onboarding", "/outils/ma-situation-familiale"])("reserves action space for %s", path => {
    expect(isPublicJourney(path)).toBe(true);
    expect(isPublicNavActive(path, path.startsWith("/outils/") ? "/outils" : "/mon-dossier")).toBe(true);
  });
  it.each(["/", "/outils", "/actualites", "/aide", "/d", "/documents", "/mon-dossier"])("keeps general navigation for %s", path => {
    expect(isPublicJourney(path)).toBe(false);
  });
  it("has exactly one active destination for the family tool", () => {
    const active = ["/", "/mon-dossier", "/outils", "/aide"].filter(href => isPublicNavActive("/outils/ma-situation-familiale", href));
    expect(active).toEqual(["/outils"]);
  });
  it("matches route segments, not loose prefixes", () => {
    expect(isPublicNavActive("/outils/calcul", "/outils")).toBe(true);
    expect(isPublicNavActive("/outils-annexes", "/outils")).toBe(false);
    expect(isPublicNavActive("/aide", "/")).toBe(false);
    expect(isPublicNavActive("/reprendre", "/mon-dossier")).toBe(true);
  });
});
