import { describe, expect, it, vi } from "vitest";
import {
  commitLocaleChoice,
  hasLocaleCookie,
  LOCALE_STORAGE_KEY,
} from "@/i18n/client-locale";

describe("commitLocaleChoice", () => {
  it("reconnaît uniquement un cookie de locale valide", () => {
    expect(hasLocaleCookie("theme=dark; BELDOC_LOCALE=nl")).toBe(true);
    expect(hasLocaleCookie("BELDOC_LOCALE=inconnue")).toBe(false);
  });

  it("conserve le succès du cookie quand le stockage navigateur est indisponible", async () => {
    const persistLocale = vi.fn().mockResolvedValue(undefined);
    const getStorage = vi.fn(() => {
      throw new DOMException("Storage disabled", "SecurityError");
    });

    await expect(
      commitLocaleChoice("nl", { persistLocale, getStorage }),
    ).resolves.toBe("changed");
    expect(persistLocale).toHaveBeenCalledWith("nl");
  });

  it("ne marque pas le choix local quand l'écriture du cookie échoue", async () => {
    const persistLocale = vi.fn().mockRejectedValue(new Error("Action failed"));
    const setItem = vi.fn();

    await expect(
      commitLocaleChoice("en", {
        persistLocale,
        getStorage: () => ({ setItem }),
      }),
    ).resolves.toBe("failed");
    expect(setItem).not.toHaveBeenCalled();
  });

  it("ferme sans réécriture quand la langue sélectionnée est déjà active", async () => {
    const persistLocale = vi.fn().mockResolvedValue(undefined);
    const setItem = vi.fn();

    await expect(
      commitLocaleChoice("fr", {
        currentLocale: "fr",
        persistLocale,
        getStorage: () => ({ setItem }),
      }),
    ).resolves.toBe("unchanged");
    expect(persistLocale).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalledWith(LOCALE_STORAGE_KEY, "fr");
  });
});
