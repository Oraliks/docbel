import { describe, expect, it } from "vitest";
import { bicFromForeignIban } from "../bic-lookup";

describe("bicFromForeignIban", () => {
  it("propose localement le BIC d'un IBAN allemand valide", () => {
    expect(bicFromForeignIban("DE51 5001 0517 9975 3416 34")).toBe("INGDDEFFXXX");
  });

  it("couvre aussi un IBAN français", () => {
    expect(bicFromForeignIban("FR76 3000 6000 0112 3456 7890 189")).toBe("AGRIFRPPXXX");
  });

  it("utilise un BIC d'agence quand la table générique ne le référence pas", () => {
    expect(bicFromForeignIban("FR76 3000 1007 9412 3456 7890 185")).toBe("BDFEFRPPCCT");
  });

  it("ne propose pas de BIC pour un IBAN belge ou un pays non couvert", () => {
    expect(bicFromForeignIban("BE68 5390 0754 7034")).toBeNull();
    expect(bicFromForeignIban("PT50 0002 0123 1234 5678 9015 4")).toBeNull();
  });

  it("ne propose rien pour un IBAN invalide", () => {
    expect(bicFromForeignIban("DE51 5001 0517 9975 3416 35")).toBeNull();
  });
});
