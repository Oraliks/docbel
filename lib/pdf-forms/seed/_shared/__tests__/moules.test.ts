import { describe, it, expect } from "vitest";
import {
  appliquerGroupes,
  carteDesGroupes,
  champDateDeSignature,
  champNISS,
  champSignature,
  SECTION_IDENTITE,
  SECTION_SIGNATURE,
} from "../moules";
import type { PdfFormField } from "../../../types";

// Les moules partagés (lot S13). Ce qu'on teste ici, ce sont les INVARIANTS
// qu'un document ne doit jamais pouvoir perdre en les branchant — pas la forme
// exacte de leur sortie, dont la stabilité est prouvée par le diff runtime
// avant/après et par les suites `seeds-vs-pdf` / `widget-geometry`.

/// Champ minimal, juste de quoi porter un id et une section.
function champ(id: string, section: string): PdfFormField {
  return { id, pdfFieldName: "", type: "text", required: false, label: { fr: id }, section, order: 0 };
}

describe("carteDesGroupes", () => {
  it("fait de chaque question son propre groupe", () => {
    const carte = carteDesGroupes(["organisme1", "signature"], {});
    expect(carte.get("organisme1")).toBe("organisme1");
    expect(carte.get("signature")).toBe("signature");
  });

  it("rattache un champ satellite à la question qu'il complète", () => {
    const carte = carteDesGroupes(["cadreDemande"], { cadreDemande: ["dateDA"] });
    expect(carte.get("dateDA")).toBe("cadreDemande");
  });
});

describe("appliquerGroupes", () => {
  const carte = carteDesGroupes(["cadreDemande"], { cadreDemande: ["dateDA"] });
  const opts = {
    parChamp: carte,
    groupeEntete: "identite",
    sectionsEntete: [SECTION_IDENTITE, "adresse"],
  };

  it("verse les champs des sections d'en-tête dans le groupe d'en-tête", () => {
    const [identite, adresse] = appliquerGroupes(
      [champ("niss", SECTION_IDENTITE), champ("rue", "adresse")],
      opts,
    );
    expect(identite.stepGroup).toBe("identite");
    expect(adresse.stepGroup).toBe("identite");
  });

  it("laisse SANS groupe un champ inconnu des deux tables", () => {
    // Repli volontaire : il atterrit dans « Autres informations » de la
    // dernière étape. Lui inventer un groupe le ferait disparaître de l'écran.
    const [orphelin] = appliquerGroupes([champ("divers", "mes-revenus")], opts);
    expect(orphelin.stepGroup).toBeUndefined();
  });

  it("fait primer la carte des questions sur le repli par section", () => {
    // Un champ rattaché à une question MAIS posé dans une section d'en-tête
    // doit suivre sa question, sinon il quitte son étape.
    const [rattache] = appliquerGroupes([champ("dateDA", SECTION_IDENTITE)], opts);
    expect(rattache.stepGroup).toBe("cadreDemande");
  });

  it("ne mute pas les champs reçus", () => {
    const source = champ("niss", SECTION_IDENTITE);
    appliquerGroupes([source], opts);
    expect(source.stepGroup).toBeUndefined();
  });
});

describe("champNISS", () => {
  const niss = champNISS({
    pdfFieldName: "NISS",
    printAsComb: { groups: [6, 3, 2], slotWidth: 12, groupExtra: 5, startX: 4 },
    section: SECTION_IDENTITE,
    order: -99,
  });

  it("porte les deux clés dont dépendent l'héritage de dossier et le profil", () => {
    // Sans `canonicalKey`, le NISS saisi sur le C1 ne descend plus dans les
    // compagnons ; sans `prefillFrom`, celui du profil ne remonte plus.
    expect(niss.canonicalKey).toBe("identity.niss");
    expect(niss.prefillFrom).toBe("profile.niss");
    expect(niss.inheritedFromDossier).toBe(true);
  });

  it("est obligatoire et typé niss (le masque et la somme de contrôle en dépendent)", () => {
    expect(niss.type).toBe("niss");
    expect(niss.required).toBe(true);
  });
});

describe("champSignature", () => {
  it("est obligatoire, typé signature, et rangé dans la section signature", () => {
    const sig = champSignature({ pdfFieldName: "Signature", order: 201 });
    expect(sig.id).toBe("signature");
    expect(sig.type).toBe("signature");
    expect(sig.required).toBe(true);
    expect(sig.section).toBe(SECTION_SIGNATURE);
  });
});

describe("champDateDeSignature", () => {
  it("se pré-remplit à la date du jour", () => {
    // C'est le défaut réparé sur le C46 le 2026-07-31 : sa case de date partait
    // BLANCHE sur chaque document généré, faute de `prefillFrom`.
    const date = champDateDeSignature({
      pdfFieldName: "AUJOURD'HUI",
      fontSize: 8,
      printAsComb: { groups: [2, 2, 4], slotWidth: 11, groupExtra: 5, startX: 2 },
      order: 1000,
    });
    expect(date.prefillFrom).toBe("system.today");
    expect(date.type).toBe("date");
    expect(date.required).toBe(true);
    expect(date.section).toBe(SECTION_SIGNATURE);
  });
});
