import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/// Quatre dossiers (`changement-situation-personnelle`, `chomage-complet`,
/// `chomage-frontalier`, `prepension`) tutoyaient le citoyen dans leurs
/// questions d'orientation, avertissements et étapes de parcours — seule
/// fausse note d'un parcours vouvoyant partout ailleurs (relevé le
/// 2026-08-03 sur `/d/chomage-complet`).
///
/// Deux endroits portent le même texte : le module TS (repli, et ce que
/// voient les locales sans traduction dédiée) ET `messages/fr.json` sous
/// `public.dossierContent.*` (la traduction FR, PRÉFÉRÉE dès qu'elle existe —
/// cf. `DossierWarning.titleKey` etc. dans lib/dossiers/types.ts). Corriger
/// l'un sans l'autre laisse le tutoiement visible à l'écran : c'était le cas
/// avant ce correctif, malgré des chaînes FR déjà « propres » dans le module.
///
/// Le test lit les DEUX sources. Il ignore les faux positifs connus :
///   - « Êtes-vous » : `\b` ne reconnaît pas systématiquement l'accent
///     capital, et scinde à tort « tes » hors du mot ;
///   - les identifiants de code (`camelCase`, clés JSON) ne sont pas du texte
///     affiché — on ne scanne que les valeurs de chaîne visibles.
const MOTS_TUTOIEMENT = new Set(["tu", "ton", "ta", "tes", "toi"]);

/// Découpe en mots sur tout ce qui n'est pas une lettre (accents compris) et
/// garde ceux qui sont un mot de tutoiement — approche par ENSEMBLE plutôt
/// que par regex à limites de mot : une regex `\b…\b` glissée d'un match au
/// suivant peut sauter un mot adjacent séparé par un seul caractère déjà
/// consommé (ex. « tu ta » : le second serait manqué). Découper d'abord en
/// mots élimine ce risque par construction.
///
/// Un mot de tutoiement peut apparaître sans faute dans un nom propre ou un
/// terme technique — aucun cas de ce genre dans ces dossiers à ce jour, mais
/// la fonction reste le seul endroit à modifier si un jour ça change.
function motsTutoiementDansTexte(texte: string): string[] {
  const mots = texte.toLowerCase().split(/[^a-zà-ÿ]+/i).filter(Boolean);
  return mots.filter((m) => MOTS_TUTOIEMENT.has(m));
}

/// Parcourt récursivement un objet JSON et collecte toutes les VALEURS de
/// type string (les clés ne sont jamais du texte affiché).
function valeursDeChaine(o: unknown, acc: string[] = []): string[] {
  if (typeof o === "string") acc.push(o);
  else if (Array.isArray(o)) for (const v of o) valeursDeChaine(v, acc);
  else if (o && typeof o === "object") for (const v of Object.values(o)) valeursDeChaine(v, acc);
  return acc;
}

const DOSSIERS = [
  "changement-situation-personnelle",
  "chomage-complet",
  "chomage-frontalier",
  "prepension",
] as const;

/// Clé `dossierContent` correspondant à chaque slug — PAS le même nom que le
/// slug pour trois des quatre (cf. registre : `prepension` → `rcc`,
/// `chomage-complet` → `complet`, `chomage-frontalier` → `frontalier`).
const CLE_CONTENU: Record<(typeof DOSSIERS)[number], string> = {
  "changement-situation-personnelle": "changementSituation",
  "chomage-complet": "complet",
  "chomage-frontalier": "frontalier",
  prepension: "rcc",
};

describe("Vouvoiement des 4 dossiers d'orientation", () => {
  it.each(DOSSIERS)("le module TS de %s ne tutoie plus", (slug) => {
    const source = readFileSync(
      join(process.cwd(), "lib", "dossiers", slug, "index.ts"),
      "utf8",
    );
    // On ne scanne QUE les chaînes entre guillemets/backticks — pas les
    // identifiants de code (ex. `titleKey`, `visibleIf`) qui utilisent
    // légitimement des mots proches.
    const chaines = [...source.matchAll(/"((?:[^"\\]|\\.)*)"|`([^`]*)`/gs)].map(
      (m) => m[1] ?? m[2] ?? "",
    );
    const trouves = chaines.flatMap((c) => motsTutoiementDansTexte(c));
    expect(trouves, `tutoiement résiduel dans ${slug}/index.ts : ${trouves.join(", ")}`).toEqual(
      [],
    );
  });

  it.each(DOSSIERS)("la traduction FR de %s ne tutoie plus", (slug) => {
    const fr = JSON.parse(
      readFileSync(join(process.cwd(), "messages", "fr.json"), "utf8"),
    ) as { public: { dossierContent: Record<string, unknown> } };
    const bloc = fr.public.dossierContent[CLE_CONTENU[slug]];
    // Un bloc absent serait un défaut du TEST (mauvaise clé) plutôt qu'un
    // succès silencieux — on le distingue de « bloc présent, zéro mot trouvé ».
    expect(bloc, `messages/fr.json ne porte aucune clé dossierContent.${CLE_CONTENU[slug]}`).toBeDefined();
    const trouves = valeursDeChaine(bloc).flatMap((c) => motsTutoiementDansTexte(c));
    expect(
      trouves,
      `tutoiement résiduel dans messages/fr.json → dossierContent.${CLE_CONTENU[slug]} : ${trouves.join(", ")}`,
    ).toEqual([]);
  });

  it("ne signale pas « Êtes-vous » comme un faux tutoiement", () => {
    // Contrôle négatif : sans lui, un test qui passe pourrait aussi bien
    // signifier « le détecteur ne détecte rien du tout ».
    expect(motsTutoiementDansTexte("Êtes-vous déjà inscrit(e) ?")).toEqual([]);
    expect(motsTutoiementDansTexte("Tu dois rester inscrit.")).toEqual(["tu"]);
  });
});
