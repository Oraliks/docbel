import { describe, expect, it } from "vitest";
import { C1_IMPROVEMENT_TARGETS } from "../apply-c1-improvements-core";
import type { PdfFormField } from "../../types";

/// Le parcours citoyen vouvoie — et le PDF officiel de l'ONEM aussi
/// (« Êtes-vous… », « Vous êtes chômeur temporaire si… »). Un seul document
/// était couvert par un garde-fou (le C1A) ; le tutoiement subsistait dans les
/// sept autres. Ce test balaie les 8 seeds d'un coup, en passant par la MÊME
/// porte que le re-semis (`C1_IMPROVEMENT_TARGETS`) : un document ajouté à
/// cette liste est contrôlé sans qu'on ait rien à écrire ici.
///
/// Ne concerne que les textes rédigés par DocBel. Les libellés recopiés du
/// formulaire officiel s'y trouvent aussi, mais l'ONEM vouvoyant déjà, ils ne
/// déclenchent rien — sauf un piège traité plus bas (« Je joins : … »).

// `\b` de JS est ASCII-only : une frontière apparaîtrait à tort entre deux
// lettres accentuées. On définit la frontière nous-mêmes, accents inclus.
const LETTRE = "A-Za-zÀ-ÖØ-öø-ÿ";

/// 1ʳᵉ voie — pronoms et déterminants. Sans ambiguïté possible.
const PRONOMS = new RegExp(
  `(?<![${LETTRE}])(tu|ton|ta|tes|toi|tien|tienne|tiens)(?![${LETTRE}])`,
  "i",
);

/// 2ᵉ voie — impératifs à la 2ᵉ personne du singulier, que la 1ʳᵉ ne voit pas :
/// « joins une copie », « laisse vide », « tape le début ». Ils ont fait passer
/// onze aides à travers le premier balayage (rapport /verif-reglementation).
///
/// La liste écarte volontairement `complète`, `compte`, `demande` et `précise` :
/// dans ce corpus ce sont des noms ou des adjectifs (« pension de retraite
/// complète », « n° de compte », « date de la demande », « une date précise »),
/// jamais des ordres. Les inclure ferait échouer le test sur du texte officiel.
const IMPERATIFS =
  "joins|laisse|tape|indique|coche|vérifie|remplis|choisis|écris|ajoute|envoie|prends|mets|réfère|renseigne|commence|réponds|fais|dis";
const IMPERATIF_RE = new RegExp(`(?<![${LETTRE}])(${IMPERATIFS})(?![${LETTRE}z])`, "gi");

/// Littérale, PAS construite par interpolation : une classe assemblée dans un
/// gabarit perd ses antislashs (`\\s` y devient `s`, et l'espace cesse d'être
/// reconnu) — piège qui avait rendu muette la détection du mot précédent.
const EST_LETTRE = /[A-Za-zÀ-ÖØ-öø-ÿ]/;

/// Dernier mot du texte qui précède l'impératif, sans ponctuation ni guillemets.
function motPrecedent(avant: string): string {
  let fin = avant.length;
  while (fin > 0 && !EST_LETTRE.test(avant[fin - 1])) fin--;
  let debut = fin;
  while (debut > 0 && (EST_LETTRE.test(avant[debut - 1]) || avant[debut - 1] === "'")) debut--;
  return avant.slice(debut, fin).toLowerCase().replace(/'$/, "");
}

/// Mots qui, juste avant, prouvent qu'on n'a PAS affaire à un ordre donné au
/// citoyen. « je » est le plus important : le C1B, le C1C et le C46 impriment
/// « Je joins : … », recopié mot pour mot du formulaire officiel — le
/// réécrire serait une faute bien plus grave que le tutoiement qu'on corrige.
/// Volontairement SANS « et » ni « ne » : un ordre s'enchaîne souvent à un
/// autre (« précisez ici…, et joignez-en une copie ») et se donne aussi à la
/// forme négative (« ne remplis pas… »). Les exclure rendait ces deux
/// tournures invisibles — deux défauts attrapés par le garde-fou ci-dessous.
/// La négation d'un verbatim à la 1ʳᵉ personne reste couverte par le mot qui
/// précède réellement le verbe (« si je ne LE fais pas » → « le »).
const PAS_UN_ORDRE = new Set([
  "je", "j", "il", "elle", "on", "qui", "que",
  "le", "la", "les", "un", "une", "du", "des", "de", "d",
  "ce", "cette", "ces", "mon", "ma", "mes", "son", "sa", "ses",
  "votre", "vos", "notre", "nos", "leur", "leurs", "au", "aux", "est",
]);

export function tutoie(texte: string): boolean {
  if (PRONOMS.test(texte)) return true;
  IMPERATIF_RE.lastIndex = 0;
  for (let m = IMPERATIF_RE.exec(texte); m; m = IMPERATIF_RE.exec(texte)) {
    if (!PAS_UN_ORDRE.has(motPrecedent(texte.slice(0, m.index)))) return true;
  }
  return false;
}

function texteFr(loc?: { fr?: string }): string[] {
  return loc?.fr ? [loc.fr] : [];
}

/// Tous les textes FR visibles d'un champ, sous-champs de tableau compris.
function collecterTextes(f: PdfFormField): string[] {
  const textes = [
    ...texteFr(f.label),
    ...texteFr(f.labelShort),
    ...texteFr(f.help),
    ...texteFr(f.helpShort),
    ...texteFr(f.placeholder),
    ...texteFr(f.errorMsg),
    ...texteFr(f.addRowLabel),
    ...texteFr(f.notice?.text),
    ...(f.options ?? []).flatMap((o) => texteFr(o.label)),
  ];
  for (const sf of f.itemFields ?? []) textes.push(...collecterTextes(sf));
  return textes;
}

describe("voix des seeds — vouvoiement sur les 8 documents", () => {
  it("garde-fou : ni les mots contenant « tu/ton/ta/tes », ni les noms homographes d'un impératif", () => {
    for (const sain of [
      // Contiennent « tu/ton/ta/tes » sans être ces mots.
      "Toute l'année", "toutes", "statut", "situation", "actuellement", "habituellement",
      "vertu", "gratuit", "ponctuel", "virtuel", "total", "capital", "entreprise",
      "toujours", "cette", "entretien", "attestation", "montant", "cotisation",
      // Noms / adjectifs homographes d'un impératif — présents tels quels dans les seeds.
      "pension de retraite complète", "déclaration sincère et complète",
      "N° de compte bancaire", "Date de la demande d'allocations",
      "à partir d'une date précise (art. 114)", "cette personne compte toujours",
      // Verbatim officiel à la 1ʳᵉ personne : ne doit JAMAIS être signalé.
      "Je joins : décision(s) d'octroi d'institutions belges",
      "Je joins en annexe(s)", "si je ne le fais pas je peux être sanctionné",
    ]) {
      expect(tutoie(sain), sain).toBe(false);
    }
    for (const tutoyant of [
      "Tu dois compléter", "pour ton employeur", "sur ta carte", "tes revenus",
      "aide pour toi", "la tienne",
      // Impératifs : invisibles à la seule détection par pronoms.
      "joins une copie de la décision", "Laisse vide si le partenaire est indépendant",
      "tape le début du nom", "Ne remplis pas les détails du colocataire",
      "et joins-en une copie",
    ]) {
      expect(tutoie(tutoyant), tutoyant).toBe(true);
    }
  });

  it("balaie bien les 8 documents (le test ne passe pas à vide)", () => {
    expect(C1_IMPROVEMENT_TARGETS).toHaveLength(8);
    for (const target of C1_IMPROVEMENT_TARGETS) {
      expect(target.improve([]).length, target.slug).toBeGreaterThan(0);
    }
  });

  it.each(C1_IMPROVEMENT_TARGETS.map((t) => [t.slug, t] as const))(
    "%s : aucun texte FR ne tutoie",
    (slug, target) => {
      const fautifs: string[] = [];
      for (const f of target.improve([])) {
        for (const texte of collecterTextes(f)) {
          if (tutoie(texte)) fautifs.push(`${slug} · ${f.id} → « ${texte} »`);
        }
      }
      // Le motif d'un déclencheur s'affiche au citoyen au même titre qu'une
      // aide — il était hors du balayage initial, et c'est précisément là que
      // se cachait « Ne remplis pas les détails du colocataire… ».
      for (const tr of target.triggers) {
        for (const texte of texteFr(tr.reason)) {
          if (tutoie(texte)) fautifs.push(`${slug} · trigger ${tr.requiresFormSlug} → « ${texte} »`);
        }
      }
      expect(fautifs).toEqual([]);
    },
  );
});
