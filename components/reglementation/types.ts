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
}

export interface Neighbor {
  riolexId: string;
  title: string;
}
