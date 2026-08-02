import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ANONYMIZE_DAYS } from "../retention";
import { RESUME_CODE_DEFAULT_TTL_DAYS } from "../resume-code";

/// Ce que la page « Mes démarches » PROMET au citoyen doit être ce que le code
/// FAIT.
///
/// Elle affichait les deux à la fois (2026-08-03) : « Le code expire au bout de
/// 30 jours sans activité, et les données saisies sont supprimées », puis, dix
/// lignes plus bas, « Vos réponses sont conservées 60 jours après votre
/// dernière activité, puis anonymisées ». La seconde est exacte
/// (`ANONYMIZE_DAYS = 60`) ; la première annonçait une suppression qui n'a
/// jamais lieu à cette date — à 30 jours seul le CODE expire, les réponses sont
/// anonymisées à 60 jours et la ligne supprimée à 180.
///
/// Deux durées différentes pour la même donnée, sur le même écran, dont une
/// fausse : c'est une promesse RGPD, pas une tournure.
///
/// Le test lit le catalogue FR (référence du projet) et le confronte aux
/// CONSTANTES : changer `ANONYMIZE_DAYS` sans toucher la phrase le fera échouer.

interface Catalogue {
  public: { dossier: Record<string, string> };
}

const FR: Catalogue = JSON.parse(
  readFileSync(join(process.cwd(), "messages", "fr.json"), "utf8"),
);

const dossier = FR.public.dossier;

describe("Copie « Mes démarches » ↔ politique de rétention", () => {
  it("annonce la durée d'anonymisation réellement appliquée", () => {
    expect(dossier.mesDemarchesRetention).toContain(`${ANONYMIZE_DAYS} jours`);
  });

  it("n'attache PAS la suppression des données à l'expiration du code", () => {
    const note = dossier.resumeNoCodeNote;
    // La note parle bien du code, et de sa durée à lui.
    expect(note).toContain(`${RESUME_CODE_DEFAULT_TTL_DAYS} jours`);
    // …mais elle ne doit pas promettre que les données disparaissent avec lui.
    expect(note.toLowerCase()).not.toMatch(/supprim/);
  });

  it("garde les deux durées distinctes — le code n'est pas la donnée", () => {
    // Garde-fou contre la « correction » inverse : aligner le code sur 60 jours
    // (ou l'anonymisation sur 30) rendrait les phrases cohérentes… et fausses.
    expect(RESUME_CODE_DEFAULT_TTL_DAYS).not.toBe(ANONYMIZE_DAYS);
  });
});
