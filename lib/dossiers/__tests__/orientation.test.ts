import { describe, expect, it } from "vitest";

import { parseOrientationAnswers } from "../orientation";
import { allocationsInsertion } from "../allocations-insertion";
import { chomageComplet } from "../chomage-complet";

/** Encode comme le fait dossier-wizard.tsx (document.cookie). */
function cookieValue(obj: unknown): string {
  return encodeURIComponent(JSON.stringify(obj));
}

describe("parseOrientationAnswers — parsing du cookie wizard", () => {
  it("aplati la forme { clé: { value } } posée par le wizard (percent-encodée)", () => {
    const raw = cookieValue({
      situation: { value: "jeune-etudes" },
      subOption: { value: "25-plus" },
      refine: { value: "jamais" },
      slug: { value: "allocations-insertion" },
    });
    expect(parseOrientationAnswers(raw)).toEqual({
      situation: "jeune-etudes",
      subOption: "25-plus",
      refine: "jamais",
      slug: "allocations-insertion",
    });
  });

  it("tolère la forme déjà aplatie (BundleRun.orientationAnswers)", () => {
    const raw = JSON.stringify({ situation: "perte-emploi", slug: "chomage-complet" });
    expect(parseOrientationAnswers(raw)).toEqual({
      situation: "perte-emploi",
      slug: "chomage-complet",
    });
  });

  it("renvoie null sur toute forme inattendue (jamais de throw)", () => {
    expect(parseOrientationAnswers(undefined)).toBeNull();
    expect(parseOrientationAnswers("")).toBeNull();
    expect(parseOrientationAnswers("pas-du-json")).toBeNull();
    expect(parseOrientationAnswers(JSON.stringify([1, 2]))).toBeNull();
    expect(parseOrientationAnswers(JSON.stringify({ autre: { value: "x" } }))).toBeNull();
    expect(parseOrientationAnswers("%E0%A4%A")).toBeNull(); // % malformé
  });
});

describe("prefillFromOrientation — allocations-insertion", () => {
  const prefill = allocationsInsertion.prefillFromOrientation!;

  it("mappe « 25 ans ou plus » du wizard vers la tranche d'âge du dossier", () => {
    expect(prefill({ situation: "jeune-etudes", subOption: "25-plus" })).toEqual({
      age: "25-plus",
    });
  });

  it("ne préremplit PAS l'âge depuis « moins-25 » (plus grossier que nos tranches)", () => {
    expect(prefill({ situation: "jeune-etudes", subOption: "moins-25" })).toEqual({});
  });

  it("« je sors des études » n'a plus de préremplissage (question supprimée 2026-07)", () => {
    expect(prefill({ situation: "perte-emploi", subOption: "sors-etudes" })).toEqual({});
  });
});

describe("prefillFromOrientation — chomage-complet", () => {
  const prefill = chomageComplet.prefillFromOrientation!;

  it("« première demande » / « redemande » remplit aDejaTouche", () => {
    expect(prefill({ refine: "premiere" }).aDejaTouche).toBe("false");
    expect(prefill({ refine: "redemande" }).aDejaTouche).toBe("true");
  });

  it("les chemins « passé salarié » remplissent le statut", () => {
    expect(prefill({ subOption: "passe-travail-be" }).statut).toBe("salarie");
    expect(prefill({ refine: "a-travaille" }).statut).toBe("salarie");
  });

  it("aucun préremplissage sans correspondance sûre", () => {
    expect(prefill({ situation: "fin-carriere", subOption: "demission" })).toEqual({});
  });
});
