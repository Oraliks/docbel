// Feuille de route « Et maintenant ? » — modèle pur, importable client ET
// serveur (aucun import runtime : le panneau React construit la feuille
// lui-même, le choix d'organisme de paiement ne quitte donc pas le client).
// Spec : docs/superpowers/specs/2026-08-02-feuille-de-route-design.md.

/// Miroir volontaire de la constante privée OP_CODES de
/// lib/bureaus/resolve.ts (qui importe prisma, donc inutilisable ici côté
/// client). Toute évolution se fait dans les DEUX fichiers.
export const OP_CODES = ["capac", "fgtb", "csc", "synova"] as const;
export type OpCode = (typeof OP_CODES)[number];

/// Acronymes officiels — pas des libellés inventés.
export const OP_LABELS: Record<OpCode, string> = {
  capac: "CAPAC",
  fgtb: "FGTB",
  csc: "CSC",
  synova: "SYNOVA",
};

export function isOpCode(v: unknown): v is OpCode {
  return typeof v === "string" && (OP_CODES as readonly string[]).includes(v);
}

/// Projection minimale d'un SerializedBureau (lib/bureaus/types.ts) : ce que
/// la feuille affiche, rien de plus — le mapping se fait côté serveur.
export interface BureauFeuille {
  opCode: OpCode;
  nom: string;
  adresse: string;
  telephone: string | null;
  siteWeb: string | null;
  rendezVousUrl: string | null;
}

export interface PieceFeuille {
  slug: string;
  titre: string;
}

export interface ConsigneDocument {
  slug: string;
  titre: string;
  signatures: string;
  exemplaires: number;
}

export type DepotFeuille =
  | { mode: "bureau"; opCode: OpCode; bureau: BureauFeuille }
  | { mode: "choix"; bureaux: BureauFeuille[] }
  | { mode: "generique" };

export interface FeuilleDeRoute {
  pieces: PieceFeuille[];
  consignes: ConsigneDocument[];
  depot: DepotFeuille;
  communeName: string | null;
  prudence: string;
}

/// Ce que la route GET feuille-de-route renvoie au panneau. `null` côté
/// consommateur = repli générique (commune non extractible, aucun bureau).
export interface FeuilleServerData {
  communeName: string | null;
  bureauxParOp: BureauFeuille[];
}

/// Item #35 de NEXT_ACTIONS — formulation reprise telle quelle.
export const PRUDENCE =
  "Docbel ne remplace pas une décision de l'ONEM ou de votre organisme de paiement.";

/// Texte métier À FAIRE VALIDER PAR ORALIKS à la review du lot (spec,
/// section Écran). Factuel : la CAPAC est l'organisme public, les trois
/// autres sont les organismes syndicaux.
export const EXPLICATION_OP =
  "Votre organisme de paiement est celui auprès duquel vous êtes inscrit pour vos allocations : la CAPAC (organisme public) ou votre organisme syndical. Si vous ne savez pas lequel choisir, voici les bureaux compétents pour votre commune.";
