import { describe, expect, it } from "vitest";
import { diagnoseBCE, isValidBelgianBCE, isValidBelgianTVA, normalizeBelgianTVA } from "../validators";
import { buildValidator, validateFieldFormat } from "../validation";
import { PdfFormField } from "../types";

// Bug rapporté (Oraliks, 2026-07-29) : un citoyen saisit 2.189.388.879 (10
// chiffres) dans un champ BCE et reçoit "Il comporte 10 chiffres" — message
// qui ne dit pas la vraie raison du rejet (le premier chiffre doit être 0 ou
// 1). Ce fichier verrouille le diagnostic précis introduit pour corriger ça.

/// Construit un numéro BCE/TVA de checksum VALIDE à partir de 8 chiffres de
/// base (le numéro doit commencer par 0 ou 1, cf. règle SPF Économie/KBO).
/// Checksum CALCULÉ, pas inventé : check = 97 - (base mod 97).
function withValidChecksum(base8: string): string {
  const check = 97 - (parseInt(base8, 10) % 97);
  return base8 + String(check).padStart(2, "0");
}

// base "01234567" -> 1234567 % 97 = 48 -> check = 49.
const VALID_BCE = withValidChecksum("01234567"); // "0123456749"
const VALID_BCE_FORMATTED = `${VALID_BCE.slice(0, 4)}.${VALID_BCE.slice(4, 7)}.${VALID_BCE.slice(7, 10)}`;

function field(p: Partial<PdfFormField> & Pick<PdfFormField, "id" | "type">): PdfFormField {
  return { pdfFieldName: p.id, required: false, label: { fr: p.id }, ...p } as PdfFormField;
}

describe("diagnoseBCE — longueur / premier chiffre / checksum", () => {
  it("numéro valide (checksum calculé, pas inventé) → ok", () => {
    expect(VALID_BCE).toBe("0123456749");
    const d = diagnoseBCE(VALID_BCE);
    expect(d.ok).toBe(true);
    expect(d.reason).toBeUndefined();
    expect(d.digitCount).toBe(10);
    expect(d.digits).toBe(VALID_BCE);
  });

  it("préfixe BE + points/espaces, numéro valide → ok", () => {
    expect(diagnoseBCE(`BE ${VALID_BCE_FORMATTED}`).ok).toBe(true);
  });

  it("numéro valide commençant par 1 → ok (0 ET 1 sont acceptés)", () => {
    expect(diagnoseBCE(withValidChecksum("12345678")).ok).toBe(true);
  });

  it("trop court → reason 'length' avec le nombre de chiffres réellement saisis", () => {
    const d = diagnoseBCE("012345674"); // 9 chiffres
    expect(d.ok).toBe(false);
    expect(d.reason).toBe("length");
    expect(d.digitCount).toBe(9);
  });

  it("trop long → reason 'length'", () => {
    const d = diagnoseBCE(VALID_BCE + "0"); // 11 chiffres
    expect(d.reason).toBe("length");
    expect(d.digitCount).toBe(11);
  });

  it("le numéro du bug rapporté (2189388879) comporte bien 10 chiffres : rejeté pour le PREMIER CHIFFRE, pas pour la longueur", () => {
    const d = diagnoseBCE("2189388879");
    expect(d.digitCount).toBe(10); // la longueur n'est PAS le problème
    expect(d.reason).toBe("leadingDigit");
    expect(d.ok).toBe(false);
  });

  it("même diagnostic avec la saisie exacte de l'utilisateur (points en séparateurs)", () => {
    const d = diagnoseBCE("2.189.388.879");
    expect(d.digitCount).toBe(10);
    expect(d.reason).toBe("leadingDigit");
  });

  it("checksum faux mais longueur et premier chiffre corrects → reason 'checksum'", () => {
    // On altère seulement les 2 derniers chiffres d'un numéro par ailleurs valide.
    const tampered = VALID_BCE.slice(0, 8) + "00";
    expect(tampered).not.toBe(VALID_BCE);
    const d = diagnoseBCE(tampered);
    expect(d.ok).toBe(false);
    expect(d.reason).toBe("checksum");
    expect(d.digitCount).toBe(10);
  });
});

describe("isValidBelgianBCE / isValidBelgianTVA — façade booléenne (alias, single source of truth)", () => {
  it("BCE et TVA restent le même validateur (alias)", () => {
    expect(isValidBelgianBCE).toBe(isValidBelgianTVA);
  });

  it("numéro calculé valide → true", () => {
    expect(isValidBelgianBCE(VALID_BCE)).toBe(true);
    expect(isValidBelgianTVA(`BE${VALID_BCE}`)).toBe(true);
  });

  it("2189388879 → false", () => {
    expect(isValidBelgianBCE("2189388879")).toBe(false);
  });
});

describe("normalizeBelgianTVA — reste cohérent avec diagnoseBCE", () => {
  it("normalise un numéro valide en BE + 10 chiffres", () => {
    expect(normalizeBelgianTVA(VALID_BCE_FORMATTED)).toBe(`BE${VALID_BCE}`);
  });

  it("renvoie null pour un numéro invalide (premier chiffre)", () => {
    expect(normalizeBelgianTVA("2189388879")).toBeNull();
  });
});

describe("validateFieldFormat — message BCE selon la cause exacte (blur, #entrée 1)", () => {
  const bceField = field({ id: "bce", type: "bce" });

  it("numéro valide → aucune erreur", () => {
    expect(validateFieldFormat(bceField, VALID_BCE, "fr")).toBeNull();
  });

  it("2189388879 → message sur le PREMIER CHIFFRE, pas sur la longueur (reproduction du bug)", () => {
    const msg = validateFieldFormat(bceField, "2189388879", "fr");
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/0 ou 1/);
    expect(msg).not.toMatch(/10 chiffres.*saisi/i);
  });

  it("longueur incorrecte → message avec le compte de chiffres réel", () => {
    const msg = validateFieldFormat(bceField, "012345", "fr");
    expect(msg).toMatch(/10 chiffres/);
    expect(msg).toMatch(/saisi 6/);
  });

  it("checksum faux → le message dit que le numéro est bien formé mais n'existe pas (le cas le plus trompeur)", () => {
    const tampered = VALID_BCE.slice(0, 8) + "00";
    const msg = validateFieldFormat(bceField, tampered, "fr");
    expect(msg).toMatch(/aucune entreprise/);
    expect(msg).toMatch(/erreur de frappe/);
  });

  it("respecte un message personnalisé admin (errorMsg) en priorité", () => {
    const custom = field({ id: "bce", type: "bce", errorMsg: { fr: "Message perso" } });
    expect(validateFieldFormat(custom, "2189388879", "fr")).toBe("Message perso");
  });
});

describe("validateFieldFormat — message TVA garde sa spécificité BE (blur)", () => {
  const tvaField = field({ id: "tva", type: "tva_be" });

  it("numéro valide → aucune erreur", () => {
    expect(validateFieldFormat(tvaField, VALID_BCE, "fr")).toBeNull();
  });

  it("2189388879 → message mentionne BE et le premier chiffre", () => {
    const msg = validateFieldFormat(tvaField, "2189388879", "fr");
    expect(msg).toMatch(/BE/);
    expect(msg).toMatch(/0 ou 1/);
  });

  it("checksum faux → message TVA distinct du message BCE (mentionne BE + « aucune entreprise »)", () => {
    const tampered = VALID_BCE.slice(0, 8) + "00";
    const msg = validateFieldFormat(tvaField, tampered, "fr");
    expect(msg).toMatch(/BE/);
    expect(msg).toMatch(/aucune entreprise/);
  });
});

describe("buildValidator — le schéma Zod (envoi) utilise le même diagnostic (#entrée 2)", () => {
  it("bloque 2.189.388.879 avec un message sur le premier chiffre, pas la longueur", () => {
    const v = buildValidator([field({ id: "bce", type: "bce", required: true })], "fr");
    const res = v.safeParse({ bce: "2.189.388.879" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toMatch(/0 ou 1/);
      expect(res.error.issues[0].message).not.toMatch(/10 chiffres.*saisi/i);
    }
  });

  it("accepte un numéro BCE réellement valide (checksum calculé)", () => {
    const v = buildValidator([field({ id: "bce", type: "bce", required: true })], "fr");
    expect(v.safeParse({ bce: VALID_BCE }).success).toBe(true);
  });

  it("champ tva_be : même rejet, message avec la spécificité BE", () => {
    const v = buildValidator([field({ id: "tva", type: "tva_be", required: true })], "fr");
    const res = v.safeParse({ tva: "2189388879" });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].message).toMatch(/BE/);
  });

  it("message localisé en néerlandais", () => {
    const v = buildValidator([field({ id: "bce", type: "bce", required: true })], "nl");
    const res = v.safeParse({ bce: "2189388879" });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].message).toMatch(/0 of 1/);
  });

  it("message localisé en allemand", () => {
    const v = buildValidator([field({ id: "bce", type: "bce", required: true })], "de");
    const res = v.safeParse({ bce: "2189388879" });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].message).toMatch(/0 oder 1/);
  });
});
