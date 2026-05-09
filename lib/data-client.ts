// Client helpers for fetching the commissions paritaires dataset from the public API.

export interface CommissionParitaire {
  code: string;
  numero: string;
  numeroOfficiel: string;
  codeOfficiel5: string;
  suffixeInterne: string;
  type: 'commission_paritaire' | 'sous_commission_paritaire' | 'sous_secteur_officieux_ou_interne';
  nom: string;
  label: string;
  searchText: string;
}

export interface CommissionsResponse {
  count: number;
  lastUpdated: string;
  items: CommissionParitaire[];
}

let inMemoryCache:
  | { items: CommissionParitaire[]; lastUpdated: string; expiresAt: number }
  | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getCommissionsParitaires(): Promise<CommissionParitaire[]> {
  return (await getCommissionsParitairesPayload()).items;
}

export async function getCommissionsParitairesPayload(): Promise<{
  items: CommissionParitaire[];
  lastUpdated: string;
}> {
  const now = Date.now();
  if (inMemoryCache && inMemoryCache.expiresAt > now) {
    return { items: inMemoryCache.items, lastUpdated: inMemoryCache.lastUpdated };
  }

  try {
    const res = await fetch('/api/data/commissions', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as CommissionsResponse;
    const items = json.items ?? [];
    const lastUpdated = json.lastUpdated ?? '';
    inMemoryCache = { items, lastUpdated, expiresAt: now + CACHE_TTL_MS };
    return { items, lastUpdated };
  } catch (err) {
    console.error('Failed to fetch commissions paritaires:', err);
    return {
      items: inMemoryCache?.items ?? [],
      lastUpdated: inMemoryCache?.lastUpdated ?? '',
    };
  }
}

export function searchCommissions(
  commissions: CommissionParitaire[],
  query: string
): CommissionParitaire[] {
  if (!query.trim()) return commissions;

  const lowercaseQuery = query.toLowerCase();

  // Numeric prefix filter (e.g., "100" → all CP starting by 100)
  const numQuery = parseInt(query);
  if (!isNaN(numQuery) && query.length <= 3) {
    const min = numQuery * 10000;
    const max = (numQuery + 1) * 10000;
    return commissions.filter((c) => {
      const codeNum = parseInt(c.code);
      return codeNum >= min && codeNum < max;
    });
  }

  return commissions.filter((c) => c.searchText.includes(lowercaseQuery));
}
