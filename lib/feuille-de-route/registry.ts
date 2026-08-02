// Faits statiques par document — UNIQUEMENT ceux imprimés sur le PDF officiel
// (règle anti-invention du dépôt). Un document absent du registre reçoit les
// faits par défaut : signé par le déclarant, un exemplaire. On n'invente
// jamais un délai ni une consigne : ce qui n'est pas sourçable n'existe pas
// ici (spec V1 — les délais réglementaires sont hors périmètre).

export interface FaitsDocument {
  signatures: string;
  exemplaires: number;
}

export const FAITS_PAR_DEFAUT: FaitsDocument = {
  signatures: "À signer par vous.",
  exemplaires: 1,
};

const FAITS: Record<string, FaitsDocument> = {
  // Source : bandeau imprimé du C1-PARTENAIRE « À COMPLÉTER PAR LE CHÔMEUR ET
  // LE PARTENAIRE EN 3 EXEMPLAIRES » (private/pdfs/C1-Partenaire_FR.pdf,
  // vérifié au markitdown le 2026-08-02 — cf. aussi NEXT_ACTIONS #40). La
  // case du partenaire n'est pas signable dans Docbel (un formulaire = un
  // signataire, cf. docs/context/PDF_FORMS_RULES.md) : elle se signe à la
  // main sur le papier imprimé.
  "c1-partenaire": {
    signatures:
      "À signer par vous ET par votre partenaire — sa case se signe à la main, sur le papier imprimé.",
    exemplaires: 3,
  },
};

export function faitsPourDocument(slug: string): FaitsDocument {
  return FAITS[slug] ?? FAITS_PAR_DEFAUT;
}
