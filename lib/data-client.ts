// Data client for fetching public datasets
// Future: These functions will be replaced with API calls to /api/data/*

import commissionsData from './data/commissions-paritaires-belgique.json';

export interface CommissionParitaire {
  code: string;
  numero: string;
  numeroOfficiel: string;
  codeOfficiel5: string;
  suffixeInterne: string;
  type: 'commission_paritaire' | 'sous_commission_paritaire';
  nom: string;
  label: string;
  searchText: string;
}

export interface CommissionsResponse {
  source: string;
  generatedAt: string;
  note: string;
  count: number;
  items: CommissionParitaire[];
}

/**
 * Get all commissions paritaires
 * TODO: Replace with API call when available
 * fetch('/api/data/commissions-paritaires')
 */
export async function getCommissionsParitaires(): Promise<CommissionParitaire[]> {
  // For now, return the imported JSON data
  // In the future, this will call your public API
  return commissionsData.items as CommissionParitaire[];
}

/**
 * Search commissions by query (code, numero, or nom)
 */
export function searchCommissions(
  commissions: CommissionParitaire[],
  query: string
): CommissionParitaire[] {
  if (!query.trim()) return commissions;

  const lowercaseQuery = query.toLowerCase();

  // Try numeric filter first (e.g., "100" → codes 100-199)
  const numQuery = parseInt(query);
  if (!isNaN(numQuery) && query.length <= 3) {
    const min = numQuery * 10000; // code format: "1000000", "1010000"
    const max = (numQuery + 1) * 10000;
    return commissions.filter(c => {
      const codeNum = parseInt(c.code);
      return codeNum >= min && codeNum < max;
    });
  }

  // Text search (code, numero, nom, searchText)
  return commissions.filter(c =>
    c.searchText.includes(lowercaseQuery)
  );
}
