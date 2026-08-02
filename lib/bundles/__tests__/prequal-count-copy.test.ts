import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/// « 0 sur 2 questions répondue. »
///
/// Le compteur de la pré-qualification (écran d'entrée d'une démarche)
/// pluralisait le NOM sur `total` et le PARTICIPE sur `answered` — deux
/// compteurs différents pour deux mots qui doivent s'accorder entre eux. Avec
/// aucune réponse sur deux questions, le français sortait faux (relevé le
/// 2026-08-03 sur `/d/chomage-complet`).
///
/// En français l'accord se fait avec le nom : les deux blocs doivent donc
/// dépendre du MÊME compteur. Le test est STRUCTUREL (aucun moteur ICU à
/// installer) : il relève les variables de sélection et vérifie qu'il n'y en a
/// qu'une.

const FR = JSON.parse(
  readFileSync(join(process.cwd(), "messages", "fr.json"), "utf8"),
) as { public: { dossier: Record<string, string> } };

/// Variables pilotant chaque bloc `{x, plural, …}` du message, dans l'ordre.
function selecteursDePluriel(message: string): string[] {
  return [...message.matchAll(/\{\s*(\w+)\s*,\s*plural\s*,/g)].map((m) => m[1]);
}

describe("prequalAnsweredCount — accord en français", () => {
  const message = FR.public.dossier.prequalAnsweredCount;

  it("ne pluralise le nom et son participe que sur UN seul compteur", () => {
    const selecteurs = selecteursDePluriel(message);
    expect(selecteurs.length).toBeGreaterThan(0);
    expect([...new Set(selecteurs)]).toHaveLength(1);
  });

  it("accorde sur le nombre de QUESTIONS, pas sur le nombre de réponses", () => {
    // « 0 sur 2 » doit donner « questions répondues » : c'est `total` qui
    // commande, `answered` n'est qu'un chiffre affiché.
    expect(selecteursDePluriel(message)[0]).toBe("total");
  });

  it("garde les deux formes accordées entre elles", () => {
    expect(message).toContain("question répondue");
    expect(message).toContain("questions répondues");
  });
});
