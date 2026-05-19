import { DocumentFieldType } from "./types";

/// Inférence du type de champ et du preset à partir du label détecté par l'OCR.
/// Patterns ordonnés du PLUS spécifique au PLUS générique. Premier match gagne.

export interface LabelHint {
  pattern: RegExp;
  type: DocumentFieldType;
  /// Nom EXACT du preset builtin (FieldValidationPreset.name)
  presetName?: string;
}

/// Noms exacts des presets canoniques (cf. prisma/seeds/field-validation-presets.ts).
/// **Source de vérité** : si on renomme un preset là-bas, il faut aussi le mettre
/// à jour ici sinon les détections perdent leur lien preset.
export const LABEL_HINTS: LabelHint[] = [
  // --- Belge (validateurs natifs) ---
  { pattern: /\bniss\b|n\.?\s*identif|registre\s*national|numero?\s*national/i, type: "niss", presetName: "NISS" },
  { pattern: /\biban\b|num.ro\s*de\s*compte|n\.?\s*compte\s*bancaire|compte\s*bancaire/i, type: "iban", presetName: "IBAN" },
  { pattern: /\bbce\b|num.ro\s*(?:d.?\s*)?entreprise|n\.?\s*entreprise/i, type: "bce", presetName: "N° BCE" },
  { pattern: /\bn\.?\s*tva\b|num.ro\s*(?:de\s*)?tva|tva\s*intra/i, type: "tva_be", presetName: "N° BCE" },
  { pattern: /code\s*postal|^cp$/i, type: "postal_be", presetName: "Code postal" },
  { pattern: /(?:n\.?\s*)?(?:de\s*)?(?:t.l.phone|portable|gsm|mobile)/i, type: "phone_be", presetName: "Téléphone" },

  // --- Contact ---
  { pattern: /(?:adresse\s+)?e[\s\-]?mail|courriel|adresse\s*électronique/i, type: "text", presetName: "Email" },

  // --- Adresse ---
  { pattern: /\bvoie\b|\brue\b(?!\s*neuve)|\bavenue\b|\bboulevard\b|\bchauss.e\b/i, type: "text", presetName: "Rue" },
  { pattern: /n\.?\s*(?:de\s*)?(?:rue|maison|voie)/i, type: "text", presetName: "Numéro de rue" },
  { pattern: /n\.?\s*(?:de\s*)?(?:bo.te|bte)/i, type: "text", presetName: "Numéro de boîte" },
  { pattern: /\bville\b|\bcommune\b|localit.|^lieu/i, type: "text", presetName: "Commune" },
  { pattern: /\bpays\b/i, type: "text", presetName: "Pays" },

  // --- Identité (priorité aux patterns combinés avant les simples) ---
  { pattern: /nom\s*(?:complet|et\s*pr.nom)|pr.nom\s*et\s*nom/i, type: "text", presetName: "Prénom et nom" },
  { pattern: /\bpr.nom(?:s)?\b/i, type: "text", presetName: "Prénom" },
  { pattern: /\bnom(?:\s*de\s*famille)?\b(?!.*entreprise|.*soci.t.)/i, type: "text", presetName: "Nom" },
  { pattern: /date\s*de\s*naissance|n.?\s*le\b/i, type: "date", presetName: "Date de naissance" },
  { pattern: /lieu\s*de\s*naissance/i, type: "text", presetName: "Lieu de naissance" },
  { pattern: /nationalit/i, type: "text", presetName: "Nationalité" },
  { pattern: /\bsexe\b/i, type: "select", presetName: "Sexe" },

  // --- Bancaire ---
  { pattern: /\bbic\b|swift/i, type: "text", presetName: "BIC" },
  { pattern: /titulaire\s*(?:du\s*)?compte/i, type: "text", presetName: "Titulaire du compte" },

  // --- Employeur ---
  { pattern: /\bonss\b/i, type: "text", presetName: "N° ONSS" },
  { pattern: /nom\s*(?:de\s*l.?\s*)?employeur|raison\s*sociale/i, type: "text", presetName: "Nom employeur" },
  { pattern: /(?:ouvrier|employ.|statut\s*professionnel)/i, type: "select", presetName: "Statut professionnel" },

  // --- Dates spécifiques ---
  { pattern: /date\s*(?:de\s*)?(?:d.but|entr.e|d.part|effet)/i, type: "date", presetName: "Période - date de début" },
  { pattern: /date\s*(?:de\s*)?(?:fin|cl.ture|ch.ance)/i, type: "date", presetName: "Période - date de fin" },
  { pattern: /date\s*(?:de\s*)?signature/i, type: "date", presetName: "Date de signature" },
  { pattern: /^date\b/i, type: "date", presetName: "Date générique" },

  // --- Financier ---
  { pattern: /salaire|r.mun.ration|appointement|montant\s*(?:brut|net|mensuel)/i, type: "number", presetName: "Montant mensuel brut" },

  // --- Social (chômage) ---
  { pattern: /situation\s*familiale/i, type: "select", presetName: "Situation familiale" },
  { pattern: /lien\s*de\s*parent/i, type: "text", presetName: "Lien de parenté" },
  { pattern: /(?:type\s*de\s*)?demandeur|ch.meur|temps\s*partiel/i, type: "select", presetName: "Type de demandeur" },
  { pattern: /cotisation\s*syndicale/i, type: "select", presetName: "Autorisation cotisation syndicale" },
  { pattern: /incapacit/i, type: "select", presetName: "Incapacité travail permanente" },

  // --- Cases à cocher ---
  { pattern: /^(oui|non)$|^(?:o\/n)$/i, type: "checkbox" },
  { pattern: /\bj.affirme\b|\bje\s*(?:certifie|d.clare|reconna|atteste)/i, type: "checkbox", presetName: "Déclaration sur l'honneur" },

  // --- Signature ---
  { pattern: /signature\s*(?:du\s*)?travailleur/i, type: "signature", presetName: "Signature travailleur" },
  { pattern: /signature\s*(?:de\s*l.?\s*)?employeur/i, type: "signature", presetName: "Signature employeur" },
  { pattern: /signature(?!.*date)/i, type: "signature", presetName: "Signature travailleur" },

  // --- Long texte ---
  { pattern: /remarques?|commentaires?|observations?|motif|note/i, type: "textarea", presetName: "Remarques" },
];

/// Cherche le premier hint qui matche le label. Retourne null si rien trouvé.
export function inferFromLabel(rawLabel: string): { type: DocumentFieldType; presetName?: string } | null {
  if (!rawLabel) return null;
  const cleaned = rawLabel
    .replace(/(([^)]*))/g, "") // (1), (3), etc.
    .replace(/[²³¹⁰-⁹]/g, "") // exposants superscript
    .trim();
  for (const hint of LABEL_HINTS) {
    if (hint.pattern.test(cleaned)) {
      return { type: hint.type, presetName: hint.presetName };
    }
  }
  return null;
}
