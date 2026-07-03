/**
 * Thématiques métier du corpus chômage (« hashtags »).
 *
 * Vocabulaire contrôlé dérivé du glossaire ONEM : chaque thème regroupe des
 * mots-clés du langage du guichet. On DÉRIVE les thèmes d'un article par simple
 * présence de mots-clés dans son texte (heuristique pure, sans IA) — le
 * conseiller peut alors filtrer « tout ce qui touche à l'AGR » sans deviner le
 * vocabulaire exact du législateur.
 *
 * 100 % pur, testé unitairement.
 */

export interface Theme {
  key: string;
  label: string;
  keywords: string[];
}

export const THEMES: Theme[] = [
  {
    key: "admissibilite",
    label: "Admissibilité",
    keywords: ["admissibilité", "stage", "jours de travail", "conditions d’admission", "période de référence"],
  },
  {
    key: "sanction",
    label: "Sanctions",
    keywords: ["sanction", "exclusion", "avertissement", "récupération", "allocation indue", "indu"],
  },
  {
    key: "disponibilite",
    label: "Disponibilité",
    keywords: ["disponible pour le marché", "disponibilité", "recherche d’emploi", "emploi convenable", "refus d’emploi"],
  },
  {
    key: "agr",
    label: "AGR / temps partiel",
    keywords: ["garantie de revenus", "travailleur à temps partiel", "temps partiel volontaire", "complément horaire"],
  },
  {
    key: "insertion",
    label: "Allocations d’insertion",
    keywords: ["allocation d’insertion", "allocations d’insertion", "stage d’insertion", "allocation de transition"],
  },
  {
    key: "chomage-temporaire",
    label: "Chômage temporaire",
    keywords: ["chômage temporaire", "force majeure", "intempéries", "raisons économiques", "suspension de l’exécution"],
  },
  {
    key: "degressivite",
    label: "Montant / dégressivité",
    keywords: ["dégressivité", "dégressif", "montant de l’allocation", "montant journalier", "période d’indemnisation"],
  },
  {
    key: "controle",
    label: "Contrôle / carte",
    keywords: ["carte de contrôle", "déclaration de la situation", "formulaire de contrôle"],
  },
  {
    key: "famille",
    label: "Situation familiale",
    keywords: ["cohabitant", "travailleur isolé", "charge de famille", "situation familiale", "travailleur ayant charge"],
  },
  {
    key: "dispense",
    label: "Dispenses",
    keywords: ["dispense", "dispensé", "reprise d’études", "formation professionnelle"],
  },
];

const BY_KEY = new Map(THEMES.map((th) => [th.key, th]));

export function themeByKey(key: string): Theme | undefined {
  return BY_KEY.get(key);
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");

/** Thèmes détectés dans un texte (présence d'au moins un mot-clé), max `limit`. */
export function deriveThemes(text: string, limit = 5): Theme[] {
  const hay = norm(text ?? "");
  if (!hay) return [];
  const out: Theme[] = [];
  for (const th of THEMES) {
    if (th.keywords.some((kw) => hay.includes(norm(kw)))) {
      out.push(th);
      if (out.length >= limit) break;
    }
  }
  return out;
}
