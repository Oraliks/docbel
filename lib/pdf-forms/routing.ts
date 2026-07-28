// Compilateur d'arbre de renvois.
//
// Les formulaires ONEM ne sont pas des questionnaires plats : ils impriment des
// renvois (« oui → voir 2 · non → voir 9 »), et les questions sautées ne
// doivent pas être remplies. Décrire cet arbre revient à recopier ce qui est
// imprimé ; en déduire les conditions d'affichage, en revanche, demande de
// suivre toutes les dépendances transitives — Q8 exige Q7 = oui ET Q3 = oui ET
// Q1 = oui. C'est là que la main se trompe, et c'est ce que cette fonction fait
// à sa place.
//
// Le résultat n'a jamais besoin de disjonction : une question atteignable par
// plusieurs chemins l'est, dans ces formulaires, par TOUS les chemins — elle
// est donc simplement toujours visible.

import type { VisibleIf } from "./types";

/// Renvoi d'une question : soit une suite unique, soit un aiguillage par valeur.
export type Renvoi = { next: string } | { on: Record<string, string> };

/// Arbre complet, recopié du document : clé = identifiant du champ qui porte la
/// question, valeur = son renvoi imprimé.
export type TableRoutage = Record<string, Renvoi>;

/// Marqueur de fin de parcours — une cible qui n'est pas une question.
export const FIN = "fin";

type Chemin = Array<{ fieldId: string; value: string }>;

function estAiguillage(r: Renvoi): r is { on: Record<string, string> } {
  return "on" in r;
}

/// Conditions d'affichage de chaque question, dérivées de l'arbre.
/// `undefined` = toujours visible.
export function compilerRoutage(
  table: TableRoutage,
  depart: string,
): Record<string, VisibleIf | undefined> {
  // Chemins d'accès distincts menant à chaque question.
  const acces = new Map<string, Chemin[]>();

  function parcourir(question: string, chemin: Chemin, pile: string[]): void {
    if (question === FIN) return;
    if (pile.includes(question)) {
      throw new Error(`Cycle détecté dans l'arbre de routage : ${[...pile, question].join(" → ")}`);
    }
    const renvoi = table[question];
    if (!renvoi) {
      throw new Error(`Renvoi vers une question inconnue : « ${question} »`);
    }

    const dejaVus = acces.get(question) ?? [];
    dejaVus.push(chemin);
    acces.set(question, dejaVus);

    const pileSuivante = [...pile, question];
    if (estAiguillage(renvoi)) {
      for (const [valeur, cible] of Object.entries(renvoi.on)) {
        parcourir(cible, [...chemin, { fieldId: question, value: valeur }], pileSuivante);
      }
    } else {
      parcourir(renvoi.next, chemin, pileSuivante);
    }
  }

  parcourir(depart, [], []);

  const conditions: Record<string, VisibleIf | undefined> = {};
  for (const [question, chemins] of acces) {
    // Conditions communes à TOUS les chemins menant ici. Ce qui n'est pas
    // commun ne peut pas être exprimé sans disjonction — et n'apparaît pas
    // dans ces formulaires.
    const premier = chemins[0];
    const communes = premier.filter((cond) =>
      chemins.every((c) => c.some((x) => x.fieldId === cond.fieldId && x.value === cond.value)),
    );
    if (communes.length === 0) {
      conditions[question] = undefined;
      continue;
    }
    // La condition la plus proche en tête, les ancêtres dans `and` : c'est
    // l'ordre de lecture naturel quand on relit le schéma.
    const [proche, ...ancetres] = [...communes].reverse();
    conditions[question] = {
      fieldId: proche.fieldId,
      op: "equals",
      value: proche.value,
      ...(ancetres.length
        ? { and: ancetres.map((a) => ({ fieldId: a.fieldId, op: "equals" as const, value: a.value })) }
        : {}),
    };
  }
  return conditions;
}
