import type { DecisionTreeContent, OptionNode } from "./types";

/**
 * Correspondances certaines entre des choix de l'arbre ONEM 2026 et les
 * questions du dossier chômage complet. Elles ne servent qu'au préremplissage
 * modifiable : aucune décision d'éligibilité n'en dépend.
 */
export const ONEM_2026_CANONICAL_TAGS = {
  "opt_perte-emploi-fin-contrat": {
    key: "a_deja_travaille",
    value: "oui",
  },
  "opt_perte-emploi-fin-contrat_premiere-demande-apres-emploi": {
    key: "demande_chomage_precedente",
    value: "non",
  },
  "opt_perte-emploi-fin-contrat_redemande-apres-interruption": {
    key: "demande_chomage_precedente",
    value: "oui",
  },
  "opt_sortie-etudes-jeune_jeune-a-travaille-apres-etudes": {
    key: "a_deja_travaille",
    value: "oui",
  },
} as const;

export type OnemCanonicalOptionId = keyof typeof ONEM_2026_CANONICAL_TAGS;

/**
 * Ajoute les tags sans muter le contenu reçu. Une absence de nœud est une
 * erreur : elle signale que le seed ONEM a changé et évite un préremplissage
 * silencieusement périmé. Un tag admin différent n'est jamais écrasé.
 */
export function applyOnem2026CanonicalTags(
  content: DecisionTreeContent,
): DecisionTreeContent {
  const nodes = { ...content.nodes };

  for (const [id, canonical] of Object.entries(ONEM_2026_CANONICAL_TAGS)) {
    const node = nodes[id];
    if (!node || node.type !== "option") {
      throw new Error(`Option ONEM canonique introuvable : ${id}`);
    }
    if (
      node.canonical &&
      (node.canonical.key !== canonical.key ||
        node.canonical.value !== canonical.value)
    ) {
      throw new Error(`Conflit de tag canonique sur l'option ONEM : ${id}`);
    }
    nodes[id] = { ...node, canonical } satisfies OptionNode;
  }

  return { ...content, nodes };
}
