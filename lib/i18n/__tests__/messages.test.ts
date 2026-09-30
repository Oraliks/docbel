import { beforeEach, describe, expect, it, vi } from "vitest";

const loaded = vi.hoisted(() => ({ fr: vi.fn(), nl: vi.fn(), de: vi.fn() }));

vi.mock("../../../messages/fr.json", () => {
  loaded.fr();
  return { default: { public: { title: "Bonjour", fallback: "Repli", nested: { a: "A", b: "B" } } } };
});
vi.mock("../../../messages/nl.json", () => {
  loaded.nl();
  return { default: { public: { title: "Hallo", nested: { a: "NL" } } } };
});
vi.mock("../../../messages/de.json", () => {
  loaded.de();
  return { default: { public: { title: "Hallo DE" } } };
});

describe("chargement des catalogues à la demande", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("ne charge aucun catalogue à l'import et seulement FR pour une visite FR", async () => {
    const { loadMessages } = await import("../../../i18n/messages");
    expect(loaded.fr).not.toHaveBeenCalled();
    expect(await loadMessages("fr")).toHaveProperty("public.title", "Bonjour");
    expect(loaded.fr).toHaveBeenCalledOnce();
    expect(loaded.nl).not.toHaveBeenCalled();
    expect(loaded.de).not.toHaveBeenCalled();
  });

  it("fusionne les clés imbriquées avec le repli FR sans modifier la base", async () => {
    const { loadMessages } = await import("../../../i18n/messages");
    const first = loadMessages("nl");
    expect(loadMessages("nl")).toBe(first);
    expect(await first).toEqual({ public: { title: "Hallo", fallback: "Repli", nested: { a: "NL", b: "B" } } });
    expect(await loadMessages("fr")).toHaveProperty("public.nested.a", "A");
    expect(loadMessages("nl")).toBe(first);
    expect(loaded.de).not.toHaveBeenCalled();
  });
});
