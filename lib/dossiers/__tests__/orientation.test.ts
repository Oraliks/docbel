import { describe, expect, it } from "vitest";

import {
  orientationAnswersToC1Prefill,
  parseOrientationAnswers,
} from "../orientation";
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

  it("tolère directement le JSON imbriqué déjà stocké sur BundleRun", () => {
    expect(parseOrientationAnswers({
      subOption: { value: "opt_changement-situation-personnelle_compte-bancaire" },
      slug: { value: "changement-situation-personnelle" },
    })).toEqual({
      subOption: "opt_changement-situation-personnelle_compte-bancaire",
      slug: "changement-situation-personnelle",
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

describe("orientationAnswersToC1Prefill", () => {
  it.each([
    ["situation-familiale-assistant", "modificationSituationFamiliale"],
    ["adresse", "modificationAdresse"],
    ["situation-personnelle-menage", "modificationSituationFamiliale"],
    ["permis-sejour-travail", "modificationPermisSejour"],
    ["compte-bancaire", "modificationCompte"],
    ["organisme-paiement", "transfereOrganismePaiement"],
  ])("pré-coche %s dans le C1", (option, fieldId) => {
    expect(orientationAnswersToC1Prefill({
      subOption: {
        value: `opt_changement-situation-personnelle_${option}`,
      },
      slug: { value: "changement-situation-personnelle" },
    })).toEqual({ [fieldId]: true });
  });

  it("accepte aussi l'ancienne valeur courte du wizard", () => {
    expect(orientationAnswersToC1Prefill({
      subOption: "compte-bancaire",
      slug: "changement-situation-personnelle",
    })).toEqual({ modificationCompte: true });
  });

  it("ignore une orientation d'un autre dossier ou une option inconnue", () => {
    expect(orientationAnswersToC1Prefill({
      subOption: "compte-bancaire",
      slug: "chomage-complet",
    })).toEqual({});
    expect(orientationAnswersToC1Prefill({
      subOption: "option-inconnue",
      slug: "changement-situation-personnelle",
    })).toEqual({});
  });
});

// Le bloc « prefillFromOrientation — allocations-insertion » vivait ici
// jusqu'au 2026-07-28 : le dossier a été supprimé pour être refait sur la base
// du form runner du C1. Le parsing du cookie wizard ci-dessus couvre toujours
// le cas d'une orientation qui pointe vers un dossier absent.

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
