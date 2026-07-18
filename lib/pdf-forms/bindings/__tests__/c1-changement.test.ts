import { describe, it, expect } from "vitest";
import type { FormPayload } from "../../types";
import { resolveStamps } from "../engine";
import { C1_CHANGEMENT_RULES } from "../per-form/c1-changement";

/// Payload « repro session Oraliks 2026-07-07 » : isolé + modificationAdresse
/// + IBAN BE68 5390 0754 7034 + compte à mon nom + hors-EEE non. Sert de
/// référence stable — chaque test le décline en changeant une case.
function baseline(): FormPayload {
  return {
    // Identité (utilisée pour titulaire-mon-nom).
    pr_nom: "Fatou",
    nom: "N'Diaye",
    niss: "80.10.15-123.45",
    // Motif : modification, chip adresse.
    motifIntroduction: "modification",
    modificationAdresse: true,
    dateDemande: "2026-07-08",
    dateModificationEffective: "",
    // Paiement.
    modePaiement: "virement",
    titulaireCompte: "mon-nom",
    iban: "BE68 5390 0754 7034",
    // Famille.
    statutFamilial: "isole",
    habiteEnColocation: "non",
    statutJugementPensionAlimentaire: "",
    // Hors-EEE.
    nationaliteHorsEEE: "non",
    // Transfert OP absent → chip transfert non coché.
    transfereOrganismePaiement: false,
  };
}

describe("Rules C1 — scénario baseline (Oraliks repro)", () => {
  it("stampe la modification, l'adresse, le titulaire, l'IBAN split, la date et les 3 non hors-EEE", () => {
    const stamps = resolveStamps(baseline(), C1_CHANGEMENT_RULES);

    // Motif : case « modification » cochée, transfert explicitement décoché
    // (les 2 cases sont mutuellement exclusives et toujours stampées).
    expect(stamps.get("je déclare une modification concernant")).toBe(true);
    expect(stamps.get("je change dorganisme de paiement à partir du 5")).toBe(false);

    // Chip adresse coché, autres 3 chips absents.
    expect(stamps.get("mon adresse à partir du")).toBe(true);
    expect(stamps.has("ma situation personnelle ou celle des membres de mon ménage 7")).toBe(false);
    expect(stamps.has("mon permis de séjour ou mon permis de travail")).toBe(false);
    expect(stamps.has("le mode de paiement de mes allocations ou mon numéro de compte6")).toBe(false);

    // IBAN belge → 4 stamps (2 + 4 + 4 + 4).
    expect(stamps.get("B E")).toBe("68");
    expect(stamps.get("undefined_11")).toBe("5390");
    expect(stamps.get("undefined_12")).toBe("0754");
    expect(stamps.get("undefined_13")).toBe("7034");
    expect(stamps.has("SEPA étranger IBAN  BIC")).toBe(false);

    // Titulaire = « mon-nom » → AUCUN stamp (le nom n'est renseigné que si le
    // compte est au nom d'une AUTRE personne). Oraliks 2026-07-10.
    expect(stamps.has("NomTitulaireSipasOk")).toBe(false);

    // Date : baseline sans `dateModificationEffective` → la ligne adresse n'est
    // PAS datée (widget vide). Le comportement daté est couvert par le describe
    // « dates par ligne de motif ».
    expect(stamps.has("DateAdresse")).toBe(false);

    // En-tête « date DA / modification » (DateDeDA) = date du motif, ici fallback
    // sur dateDemande (dateModificationEffective vide).
    expect(stamps.get("DateDeDA")).toBe("08/07/2026");

    // Remarque non émise (pas de cohousing, jugement vide).
    expect(stamps.has("Remarques 1 Haut")).toBe(false);

    // Rubrique hors-EEE : 3 « non » cochés.
    expect(stamps.get("non_17")).toBe(true);
    expect(stamps.get("non_18")).toBe(true);
    expect(stamps.get("non_19")).toBe(true);
  });
});

describe("Rules C1 — motif indépendant du champ strippé motifIntroduction", () => {
  it("motifIntroduction ABSENT (strippé par la validation) → la case modification reste cochée, transfert décoché", () => {
    // Reproduit le payload RÉEL côté serveur : `motifIntroduction` est
    // autoAnswered → exclu du schéma Zod → strippé de `result.data`. La règle
    // ne doit donc pas en dépendre (bug Oraliks 2026-07-18 : le changement
    // d'adresse déclaré n'était pas coché sur le PDF).
    const payload: FormPayload = { ...baseline(), modificationAdresse: true };
    delete payload["motifIntroduction"];
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    expect(stamps.get("je déclare une modification concernant")).toBe(true);
    expect(stamps.get("je change dorganisme de paiement à partir du 5")).toBe(false);
    // La ligne adresse est bien cochée (chip non strippé).
    expect(stamps.get("mon adresse à partir du")).toBe(true);
  });
});

describe("Rules C1 — transfert d'organisme de paiement (règle indépendante)", () => {
  it("transfert SEUL (aucun motif de modification) → transfert coché, modification décochée", () => {
    const payload = {
      ...baseline(),
      transfereOrganismePaiement: true,
      modificationAdresse: false,
    };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);

    expect(stamps.get("je change dorganisme de paiement à partir du 5")).toBe(true);
    // Aucun motif de modification coché → case modification décochée.
    expect(stamps.get("je déclare une modification concernant")).toBe(false);
  });

  it("modification ET transfert cochés → les DEUX cases cochées (règles indépendantes, Oraliks 2026-07-18)", () => {
    // Le point clé : cocher le transfert ne décoche PLUS « je déclare une
    // modification concernant » — un motif de modification suffit à la cocher.
    const payload = {
      ...baseline(),
      modificationAdresse: true,
      transfereOrganismePaiement: true,
    };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    expect(stamps.get("je déclare une modification concernant")).toBe(true);
    expect(stamps.get("je change dorganisme de paiement à partir du 5")).toBe(true);
  });

  it("chaque autre motif de modification coche aussi la case parente (indépendamment du transfert)", () => {
    for (const motif of [
      "modificationSituationFamiliale",
      "modificationPermisSejour",
      "modificationCompte",
    ]) {
      const payload = { ...baseline(), modificationAdresse: false, [motif]: true };
      const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
      expect(stamps.get("je déclare une modification concernant"), motif).toBe(true);
    }
  });
});

describe("Rules C1 — IBAN étranger", () => {
  it("route la valeur brute vers le widget SEPA sans splitter", () => {
    const payload = { ...baseline(), iban: "FR76 3000 6000 0112 3456 7890 189" };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);

    expect(stamps.get("SEPA étranger IBAN  BIC")).toBe("FR76 3000 6000 0112 3456 7890 189");
    // Aucun split BE.
    expect(stamps.has("B E")).toBe(false);
    expect(stamps.has("undefined_11")).toBe(false);
  });

  it("IBAN belge de 15 chiffres (trop court) → aucun split", () => {
    const payload = { ...baseline(), iban: "BE68 5390 0754 703" };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    expect(stamps.has("B E")).toBe(false);
  });

  it("IBAN vide → ni split, ni routage étranger", () => {
    const payload = { ...baseline(), iban: "" };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    expect(stamps.has("B E")).toBe(false);
    expect(stamps.has("SEPA étranger IBAN  BIC")).toBe(false);
  });
});

describe("Rules C1 — titulaire compte", () => {
  it("titulaire = autre-nom → prend la valeur saisie manuellement", () => {
    const payload = {
      ...baseline(),
      titulaireCompte: "autre-nom",
      titulaireCompteNom: "  Marie Dupont  ",
    };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    // Trimé.
    expect(stamps.get("NomTitulaireSipasOk")).toBe("Marie Dupont");
  });

  it("titulaire = autre-nom mais champ vide → aucun stamp", () => {
    const payload = {
      ...baseline(),
      titulaireCompte: "autre-nom",
      titulaireCompteNom: "",
    };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    expect(stamps.has("NomTitulaireSipasOk")).toBe(false);
  });

  it("modePaiement = cheque → aucun stamp titulaire même si titulaireCompte = mon-nom", () => {
    const payload = {
      ...baseline(),
      modePaiement: "cheque",
      iban: "",
    };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    expect(stamps.has("NomTitulaireSipasOk")).toBe(false);
  });
});

describe("Rules C1 — remarque situation familiale", () => {
  it("cohousing = isolé + colocation → « cohousing » sur Remarques 1", () => {
    const payload = {
      ...baseline(),
      statutFamilial: "isole",
      habiteEnColocation: "oui",
    };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    expect(stamps.get("Remarques 1 Haut")).toBe("cohousing");
  });

  it("jugement en-cours et pas-encore-recu concaténés avec « ; »", () => {
    // Cas isolé : cohousing seul.
    const cohousingOnly = {
      ...baseline(),
      statutFamilial: "isole",
      habiteEnColocation: "oui",
    };
    expect(resolveStamps(cohousingOnly, C1_CHANGEMENT_RULES).get("Remarques 1 Haut")).toBe("cohousing");

    // Cas jugement en cours seul.
    const enCours = { ...baseline(), statutJugementPensionAlimentaire: "en-cours" };
    expect(resolveStamps(enCours, C1_CHANGEMENT_RULES).get("Remarques 1 Haut")).toBe("jugement en cours");

    // Cas « pas encore reçu ».
    const pasRecu = { ...baseline(), statutJugementPensionAlimentaire: "pas-encore-recu" };
    expect(resolveStamps(pasRecu, C1_CHANGEMENT_RULES).get("Remarques 1 Haut")).toBe(
      "je n'ai pas encore reçu mon jugement"
    );

    // Cas combiné cohousing + en-cours.
    const combo = {
      ...baseline(),
      statutFamilial: "isole",
      habiteEnColocation: "oui",
      statutJugementPensionAlimentaire: "en-cours",
    };
    expect(resolveStamps(combo, C1_CHANGEMENT_RULES).get("Remarques 1 Haut")).toBe(
      "cohousing ; jugement en cours"
    );
  });
});

describe("Rules C1 — dates par ligne de motif (widgets scindés 2026-07-10)", () => {
  it("date la ligne de CHAQUE chip modification coché avec dateModificationEffective", () => {
    const payload = {
      ...baseline(),
      modificationAdresse: true,
      modificationCompte: true,
      modificationSituationFamiliale: false,
      dateModificationEffective: "2026-06-15",
    };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    expect(stamps.get("DateAdresse")).toBe("15/06/2026");
    expect(stamps.get("DateBanque")).toBe("15/06/2026");
    // Situation familiale non cochée → sa ligne reste vide.
    expect(stamps.has("DatePersonnelleOuMenage")).toBe(false);
    // Le transfert n'est pas concerné.
    expect(stamps.has("DateDeTransfert")).toBe(false);
  });

  it("le transfert d'organisme porte SA propre date (dateChangementOrganisme), pas celle de modif", () => {
    const payload = {
      ...baseline(),
      modificationAdresse: false,
      transfereOrganismePaiement: true,
      dateChangementOrganisme: "2026-08-01",
      dateModificationEffective: "2026-06-15",
    };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    expect(stamps.get("DateDeTransfert")).toBe("01/08/2026");
    // La date de modif ne fuit pas sur les lignes modification (chips décochés).
    expect(stamps.has("DateAdresse")).toBe(false);
    expect(stamps.has("DateBanque")).toBe(false);
  });

  it("aucune date saisie → aucune ligne datée", () => {
    const payload = { ...baseline(), dateModificationEffective: "", dateChangementOrganisme: "" };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    expect(stamps.has("DateAdresse")).toBe(false);
    expect(stamps.has("DateBanque")).toBe(false);
    expect(stamps.has("DatePersonnelleOuMenage")).toBe(false);
    expect(stamps.has("DateDeTransfert")).toBe(false);
  });
});

describe("Rules C1 — en-tête « date DA / modification » page 2 (DateDeDA)", () => {
  it("= la date de modification quand c'est un changement", () => {
    const payload = { ...baseline(), dateModificationEffective: "2026-06-15" };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    // Identique à la date des lignes de motif cochées.
    expect(stamps.get("DateDeDA")).toBe("15/06/2026");
  });

  it("= la date de transfert quand c'est un changement d'organisme (pas de date modif)", () => {
    const payload = {
      ...baseline(),
      dateModificationEffective: "",
      transfereOrganismePaiement: true,
      dateChangementOrganisme: "2026-08-01",
    };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    expect(stamps.get("DateDeDA")).toBe("01/08/2026");
  });

  it("retombe sur la date de demande si ni modif ni transfert", () => {
    const payload = { ...baseline(), dateDemande: "2026-05-20", dateModificationEffective: "", dateChangementOrganisme: "" };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    expect(stamps.get("DateDeDA")).toBe("20/05/2026");
  });
});

describe("Rules C1 — hors-EEE", () => {
  it("nationaliteHorsEEE = oui → aucune règle non_17/18/19 activée", () => {
    const payload = { ...baseline(), nationaliteHorsEEE: "oui" };
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    expect(stamps.has("non_17")).toBe(false);
    expect(stamps.has("non_18")).toBe(false);
    expect(stamps.has("non_19")).toBe(false);
  });

  it("nationaliteHorsEEE absent → aucune règle activée (pas de default)", () => {
    const payload = { ...baseline() };
    delete payload.nationaliteHorsEEE;
    const stamps = resolveStamps(payload, C1_CHANGEMENT_RULES);
    expect(stamps.has("non_17")).toBe(false);
  });
});
