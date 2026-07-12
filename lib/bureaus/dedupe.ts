// Logique PURE de dédoublonnage des bureaux (CPAS / maisons communales).
//
// Deux responsabilités, testées isolément :
//  - `isNonGuichetName` : reconnaît les bâtiments importés par OSM qui ne sont
//    pas des guichets (archives, police, musées, cloîtres/châteaux historiques…).
//    Partagée avec l'import OSM comme garde-fou anti-doublons (lot 5).
//  - `pickSurvivor` : dans un groupe de bureaux suspectés doublons, choisit
//    celui à GARDER et liste les perdants (à désactiver) avec une raison.
//
// Règle d'or : ne JAMAIS supprimer, ne JAMAIS écraser un bureau `verified`.

/** Motifs de noms de bâtiments qui ne sont pas des guichets d'accueil. */
const NON_GUICHET_PATTERNS = [
  /\barchives?\b/i,
  /\bpavillon\b/i,
  /\bpolice\b/i,
  /\bpolitie\b/i,
  /\bklooster\b/i, // couvent / cloître (NL)
  /\bkasteel\b/i, // château (NL)
  /\bchâteau\b/i,
  /\bhistorisch\b/i, // "Historisch Stadhuis" = ancien hôtel de ville (monument)
  /\bmuseum\b/i,
  /\bmusée\b/i,
  /\bbibliothèque\b/i,
  /\bbibliotheek\b/i,
];

export function isNonGuichetName(name: string): boolean {
  return NON_GUICHET_PATTERNS.some((re) => re.test(name));
}

/** Adresse placeholder / vide = pas une vraie rue. */
export function isStubAddress(street: string): boolean {
  const s = street.trim();
  if (s.length < 3) return true;
  return /(adresse\s+à\s+confirmer|confirmer|\bstub\b|\btodo\b|^\?+$)/i.test(s);
}

export type DedupCandidate = {
  id: string;
  name: string;
  type: string;
  street: string;
  postalCode: string;
  communeId: string | null;
  phone: string | null;
  /** Nombre de créneaux d'horaires renseignés (0 = aucun). */
  hoursCount: number;
  lat: number | null;
  verified: boolean;
  updatedAt: Date;
};

export type DedupLoser = DedupCandidate & { reason: string };

export type DedupResult = {
  survivor: DedupCandidate;
  losers: DedupLoser[];
};

/**
 * Score de qualité d'un bureau (plus haut = meilleur candidat à garder).
 * L'ordre des critères EST la priorité — chaque poids domine tous les suivants.
 */
function qualityScore(b: DedupCandidate): number {
  let score = 0;
  if (b.verified) score += 1_000_000; // un bureau vérifié ne se fait jamais évincer par un import
  if (!isNonGuichetName(b.name)) score += 100_000; // vrai guichet > bâtiment annexe
  if (!isStubAddress(b.street)) score += 10_000; // adresse réelle > placeholder
  if (b.communeId) score += 5_000; // bureau lié à sa commune > orphelin
  if (b.phone && b.phone.trim()) score += 1_000;
  if (b.hoursCount > 0) score += 100;
  if (b.lat != null) score += 10;
  return score;
}

/** Raison lisible pour laquelle `loser` perd face à `winner`. */
function loserReason(loser: DedupCandidate, winner: DedupCandidate): string {
  if (winner.verified && !loser.verified) return "doublon : l'autre est vérifié manuellement";
  if (!isNonGuichetName(winner.name) && isNonGuichetName(loser.name))
    return "doublon : bâtiment annexe (non-guichet)";
  if (!isStubAddress(winner.street) && isStubAddress(loser.street))
    return "doublon : adresse placeholder, l'autre a une adresse réelle";
  if (winner.communeId && !loser.communeId)
    return "doublon : l'autre est lié à sa commune";
  if (winner.phone && !loser.phone) return "doublon : l'autre a un téléphone";
  if (winner.hoursCount > 0 && loser.hoursCount === 0) return "doublon : l'autre a des horaires";
  return "doublon : l'autre est de meilleure qualité ou plus récent";
}

export function pickSurvivor(candidates: DedupCandidate[]): DedupResult {
  if (candidates.length === 0) throw new Error("pickSurvivor: groupe vide");

  const sorted = [...candidates].sort((a, b) => {
    const d = qualityScore(b) - qualityScore(a);
    if (d !== 0) return d;
    return b.updatedAt.getTime() - a.updatedAt.getTime(); // tie-break : plus récent
  });

  const [survivor, ...losers] = sorted;
  return {
    survivor,
    losers: losers.map((l) => ({ ...l, reason: loserReason(l, survivor) })),
  };
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Regroupe les bureaux en grappes de doublons. Deux bureaux du MÊME type sont
 * considérés doublons s'ils partagent :
 *   - la même commune (communeId), OU
 *   - le même code postal ET le même nom normalisé (jumeaux dont l'un peut être
 *     orphelin de commune).
 * La relation est transitive (union-find) : A lié à B et B à C ⇒ {A,B,C}.
 * Ne retourne que les grappes de taille ≥ 2.
 */
export function groupDuplicates<T extends DedupCandidate>(candidates: T[]): T[][] {
  const parent = candidates.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  // Index par clé communeId et par clé (postalCode|nom normalisé), scindés par type.
  const byCommune = new Map<string, number>();
  const byNameCp = new Map<string, number>();
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c.communeId) {
      const key = `${c.type}|commune:${c.communeId}`;
      const prev = byCommune.get(key);
      if (prev != null) union(prev, i);
      else byCommune.set(key, i);
    }
    const nameKey = `${c.type}|cp:${c.postalCode}|name:${normalizeName(c.name)}`;
    const prevN = byNameCp.get(nameKey);
    if (prevN != null) {
      // On ne fusionne par nom+CP que si les deux ne sont pas rattachés à DEUX
      // communes différentes : même nom générique + même CP dans deux communes
      // voisines = bureaux distincts, jamais des doublons.
      const other = candidates[prevN];
      const conflictingCommunes =
        c.communeId != null && other.communeId != null && c.communeId !== other.communeId;
      if (!conflictingCommunes) union(prevN, i);
    } else {
      byNameCp.set(nameKey, i);
    }
  }

  const buckets = new Map<number, T[]>();
  for (let i = 0; i < candidates.length; i++) {
    const root = find(i);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root)!.push(candidates[i]);
  }

  return [...buckets.values()].filter((g) => g.length > 1);
}
