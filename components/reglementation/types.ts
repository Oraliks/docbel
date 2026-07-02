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
}
