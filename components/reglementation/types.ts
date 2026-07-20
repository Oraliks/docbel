import type { LookupCodeRef } from "@/lib/dossiers/types";

export interface ResultItem {
  id: string;
  riolexId: string;
  title: string;
  loi: string;
  natureJuridique: string;
  articleNumber: string;
  abroge: boolean;
  statut: string | null;
  dateEntreeVigueur: string | null;
  datePublication: string | null;
  sourceUrl: string | null;
  headline: string | null;
  reforme2026?: boolean;
  lastEV?: string | null;
}

export interface LegalMeta {
  riolexId?: string;
  loi?: string;
  natureJuridique?: string;
  articleNumber?: string;
  datePublication?: string | null;
  dateEntreeVigueur?: string | null;
  dateMoniteur?: string | null;
  statut?: string | null;
  abroge?: boolean;
  isOnemCommentary?: boolean;
  refs?: string[];
  /// Codes ONEM liés (encart éditorial). JSON libre en base, normalisé au rendu
  /// via `normalizeLookupRefs`. Peuplé par scripts/attach-lookup-refs.ts.
  lookupRefs?: LookupCodeRef[];
}

export interface Neighbor {
  riolexId: string;
  title: string;
}
