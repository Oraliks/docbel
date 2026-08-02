// Assemble la feuille de route à partir des pièces du run, des bureaux résolus
// côté serveur et du choix d'organisme de paiement (state client, jamais
// stocké). Fonction PURE : le panneau React et la page de garde PDF
// construisent la même feuille — écran et papier ne peuvent pas diverger.

import {
  PRUDENCE,
  type FeuilleDeRoute,
  type FeuilleServerData,
  type OpCode,
  type PieceFeuille,
  type DepotFeuille,
} from "./model";
import { faitsPourDocument } from "./registry";

export function buildFeuilleDeRoute(input: {
  pieces: PieceFeuille[];
  serverData: FeuilleServerData | null;
  opChoice: OpCode | null;
}): FeuilleDeRoute {
  const consignes = input.pieces.map((p) => ({
    slug: p.slug,
    titre: p.titre,
    ...faitsPourDocument(p.slug),
  }));

  const bureaux = input.serverData?.bureauxParOp ?? [];
  let depot: DepotFeuille;
  if (bureaux.length === 0) {
    depot = { mode: "generique" };
  } else if (input.opChoice) {
    const bureau = bureaux.find((b) => b.opCode === input.opChoice);
    // OP choisi introuvable dans la liste (données incomplètes pour cette
    // commune) : on montre le choix complet plutôt qu'un bloc vide.
    depot = bureau
      ? { mode: "bureau", opCode: input.opChoice, bureau }
      : { mode: "choix", bureaux };
  } else {
    depot = { mode: "choix", bureaux };
  }

  return {
    pieces: input.pieces,
    consignes,
    depot,
    communeName: input.serverData?.communeName ?? null,
    prudence: PRUDENCE,
  };
}
