import { DocumentFieldType } from "./types";

/// Inférence du type de champ et du preset à partir du label détecté par l'OCR.
/// Patterns ordonnés du PLUS spécifique au PLUS générique. Premier match gagne.

export interface LabelHint {
  pattern: RegExp;
  type: DocumentFieldType;
  /// Nom EXACT du preset builtin (FieldValidationPreset.name)
  presetName?: string;
}

export const LABEL_HINTS: LabelHint[] = [
  // --- Belge (validateurs natifs) ---
  { pattern: /\bniss\b|n\.?\s*identif|registre\s*national|numero?\s*national/i, type: "niss", presetName: "NISS belge" },
  { pattern: /\biban\b|num.ro\s*de\s*compte|n\.?\s*compte\s*bancaire|compte\s*bancaire/i, type: "iban", presetName: "IBAN belge" },
  { pattern: /\bbce\b|num.ro\s*(?:d.?\s*)?entreprise|n\.?\s*entreprise/i, type: "bce", presetName: "BCE / Numéro d'entreprise" },
  { pattern: /\bn\.?\s*tva\b|num.ro\s*(?:de\s*)?tva|tva\s*intra/i, type: "tva_be", presetName: "TVA belge" },
  { pattern: /code\s*postal|^cp$/i, type: "postal_be", presetName: "Code postal belge" },
  { pattern: /(?:n\.?\s*)?(?:de\s*)?(?:t.l.phone|portable|gsm|mobile)/i, type: "phone_be", presetName: "Téléphone belge" },

  // --- Contact ---
  { pattern: /(?:adresse\s+)?e[\s\-]?mail|courriel|adresse\s*électronique/i, type: "text", presetName: "Email" },

  // --- Adresse ---
  { pattern: /\bvoie\b|\brue\b(?!\s*neuve)|\bavenue\b|\bboulevard\b|\bchauss.e\b/i, type: "text", presetName: "Rue (nom de voie)" },
  { pattern: /n\.?\s*(?:de\s*)?(?:rue|maison|voie|bo.te|bte)|num.ro\s*(?:de\s*)?rue/i, type: "text", presetName: "Numéro de rue" },
  { pattern: /\bville\b|\bcommune\b|localit.|^lieu/i, type: "text", presetName: "Ville" },

  // --- Identité (priorité aux patterns combinés avant les simples) ---
  { pattern: /nom\s*(?:complet|et\s*pr.nom)|pr.nom\s*et\s*nom/i, type: "text", presetName: "Nom complet (prénom + nom)" },
  { pattern: /\bpr.nom(?:s)?\b/i, type: "text", presetName: "Prénom" },
  { pattern: /\bnom(?:\s*de\s*famille)?\b(?!.*entreprise|.*soci.t.)/i, type: "text", presetName: "Nom de famille" },

  // --- Dates (le plus spécifique d'abord) ---
  { pattern: /date\s*de\s*naissance|n.?\s*le\b/i, type: "date", presetName: "Date de naissance" },
  { pattern: /date\s*(?:de\s*)?(?:fin|cl.ture|ch.ance)/i, type: "date", presetName: "Date passée" },
  { pattern: /date\s*(?:de\s*)?(?:d.but|entr.e|d.part|effet)/i, type: "date", presetName: "Date passée" },
  { pattern: /date\s*(?:du\s*)?(?:jour|courant|aujourd|sign)/i, type: "date" },
  { pattern: /^date\b|date\s*demand|date\s*(?:de\s*)?signature/i, type: "date" },

  // --- Financier ---
  { pattern: /salaire|r.mun.ration|appointement/i, type: "number", presetName: "Salaire mensuel brut" },
  { pattern: /montant\s*(?:brut|net)?|prix|co.t|somme/i, type: "number", presetName: "Montant en euros (positif)" },
  { pattern: /pourcentage|^%$|taux\s*\(?\s*%/i, type: "number", presetName: "Pourcentage (0–100)" },

  // --- Cases à cocher ---
  { pattern: /^(oui|non)$|^(?:o\/n)$/i, type: "checkbox" },
  { pattern: /\bj.affirme\b|\bje\s*(?:certifie|d.clare|reconna|atteste)/i, type: "checkbox" },

  // --- Signature ---
  { pattern: /signature(?!.*date)/i, type: "signature" },

  // --- Long texte ---
  { pattern: /remarques?|commentaires?|observations?|motif|note/i, type: "textarea" },
];

/// Cherche le premier hint qui matche le label. Retourne null si rien trouvé.
export function inferFromLabel(rawLabel: string): { type: DocumentFieldType; presetName?: string } | null {
  if (!rawLabel) return null;
  const cleaned = rawLabel
    .replace(/\([^)]*\)/g, "") // (1), (3), etc.
    .replace(/[¹-³⁰-⁹]/g, "") // ¹²³ exposants
    .trim();
  for (const hint of LABEL_HINTS) {
    if (hint.pattern.test(cleaned)) {
      return { type: hint.type, presetName: hint.presetName };
    }
  }
  return null;
}
